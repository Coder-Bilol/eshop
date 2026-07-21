import {
  type AuthenticationInput,
  type AuthenticationResponse,
  type AuthIdentityProviderService,
} from "@medusajs/framework/types";
import {
  AbstractAuthModuleProvider,
  MedusaError,
} from "@medusajs/framework/utils";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type {
  VkIdAuthProviderOptions,
  VkIdAuthState,
  VkIdTokenResponse,
  VkIdUserProfile,
} from "./types";

const VK_AUTHORIZATION_URL = "https://id.vk.com/authorize";
const VK_TOKEN_URL = "https://id.vk.com/oauth2/auth";
const VK_USER_INFO_URL = "https://id.vk.com/oauth2/user_info";
const STATE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const SANITIZED_FAILURE = "VK authentication failed";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const secureEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const normalizeUserId = (value: unknown) => {
  const normalized = typeof value === "number" ? String(value) : value;

  return typeof normalized === "string" && /^[1-9]\d*$/.test(normalized)
    ? normalized
    : null;
};

const normalizeEmail = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
};

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 100) : undefined;
};

export default class VkIdAuthService extends AbstractAuthModuleProvider {
  static identifier = "vkid";
  static DISPLAY_NAME = "VK ID";

  protected readonly options_: VkIdAuthProviderOptions;
  private readonly stateClaims_ = new Set<string>();

  static validateOptions(options: VkIdAuthProviderOptions) {
    for (const name of ["clientId", "serviceToken", "callbackUrl"] as const) {
      if (!options[name]?.trim()) {
        throw new Error(`VK ID ${name} is required`);
      }
    }

    const callbackUrl = new URL(options.callbackUrl);
    if (!['http:', 'https:'].includes(callbackUrl.protocol)) {
      throw new Error("VK ID callbackUrl must use HTTP(S)");
    }
  }

  constructor(_: Record<string, unknown>, options: VkIdAuthProviderOptions) {
    super();
    VkIdAuthService.validateOptions(options);
    this.options_ = options;
  }

  async register(): Promise<AuthenticationResponse> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "VK ID does not support registration; use authenticate"
    );
  }

  async authenticate(
    _: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    try {
      const stateKey = randomBytes(32).toString("base64url");
      const codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = this.createCodeChallenge_(codeVerifier);
      const state: VkIdAuthState = {
        callbackUrl: this.options_.callbackUrl,
        codeChallenge,
        codeVerifier,
        expiresAt: Date.now() + STATE_TTL_MS,
      };

      await authIdentityService.setState(stateKey, { ...state });

      const location = new URL(VK_AUTHORIZATION_URL);
      location.searchParams.set("response_type", "code");
      location.searchParams.set("client_id", this.options_.clientId);
      location.searchParams.set("redirect_uri", this.options_.callbackUrl);
      location.searchParams.set("scope", "email");
      location.searchParams.set("state", stateKey);
      location.searchParams.set("code_challenge", codeChallenge);
      location.searchParams.set("code_challenge_method", "S256");

      return { success: true, location: location.toString() };
    } catch {
      return this.failure_();
    }
  }

  async validateCallback(
    request: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const query = request.query ?? {};
    const body = request.body ?? {};
    const stateKey = query.state ?? body.state;

    if (!stateKey || !/^[A-Za-z0-9_-]{43}$/.test(stateKey)) {
      return this.failure_();
    }

    try {
      const state = await this.claimState_(stateKey, authIdentityService);
      if (!state || query.error || body.error) {
        return this.failure_();
      }

      const code = query.code ?? body.code;
      const deviceId = query.device_id ?? body.device_id;
      if (!code?.trim() || !deviceId?.trim()) {
        return this.failure_();
      }

      const challenge = this.createCodeChallenge_(state.codeVerifier);
      if (!secureEqual(challenge, state.codeChallenge)) {
        return this.failure_();
      }

      const tokenResponse = await this.exchangeCode_(
        code,
        deviceId,
        stateKey,
        state
      );
      const tokenUserId = normalizeUserId(tokenResponse.user_id);
      if (
        !tokenUserId ||
        !secureEqual(tokenResponse.state, stateKey) ||
        !tokenResponse.access_token
      ) {
        return this.failure_();
      }

      const profile = await this.getUserProfile_(tokenResponse.access_token);
      const profileUserId = normalizeUserId(profile.user_id);
      const email = normalizeEmail(profile.email);
      if (!profileUserId || profileUserId !== tokenUserId || !email) {
        return this.failure_();
      }

      let authIdentity;
      try {
        authIdentity = await authIdentityService.retrieve({
          entity_id: tokenUserId,
        });
      } catch (error) {
        if (
          !isRecord(error) ||
          error.type !== MedusaError.Types.NOT_FOUND
        ) {
          return this.failure_();
        }

        authIdentity = await authIdentityService.create({
          entity_id: tokenUserId,
          user_metadata: {
            email,
            first_name: normalizeName(profile.first_name),
            last_name: normalizeName(profile.last_name),
          },
        });
      }

      return { success: true, authIdentity };
    } catch {
      return this.failure_();
    }
  }

  private async claimState_(
    stateKey: string,
    authIdentityService: AuthIdentityProviderService
  ): Promise<VkIdAuthState | null> {
    const stored = await authIdentityService.getState(stateKey);
    if (!stored || this.stateClaims_.has(stateKey)) {
      return null;
    }

    this.stateClaims_.add(stateKey);
    try {
      await authIdentityService.setState(stateKey, {
        consumed: true,
        expiresAt:
          typeof stored.expiresAt === "number" ? stored.expiresAt : Date.now(),
      });
    } finally {
      this.stateClaims_.delete(stateKey);
    }

    if (
      stored.consumed === true ||
      typeof stored.callbackUrl !== "string" ||
      stored.callbackUrl !== this.options_.callbackUrl ||
      typeof stored.codeChallenge !== "string" ||
      typeof stored.codeVerifier !== "string" ||
      typeof stored.expiresAt !== "number" ||
      stored.expiresAt <= Date.now()
    ) {
      return null;
    }

    return stored as unknown as VkIdAuthState;
  }

  private async exchangeCode_(
    code: string,
    deviceId: string,
    stateKey: string,
    state: VkIdAuthState
  ): Promise<VkIdTokenResponse> {
    const payload = new URLSearchParams({
      client_id: this.options_.clientId,
      service_token: this.options_.serviceToken,
      code,
      code_verifier: state.codeVerifier,
      device_id: deviceId,
      grant_type: "authorization_code",
      redirect_uri: state.callbackUrl,
      state: stateKey,
    });
    const response = await this.postForm_(VK_TOKEN_URL, payload);

    if (
      !isRecord(response) ||
      typeof response.access_token !== "string" ||
      typeof response.state !== "string"
    ) {
      throw new Error(SANITIZED_FAILURE);
    }

    return response as unknown as VkIdTokenResponse;
  }

  private async getUserProfile_(accessToken: string): Promise<VkIdUserProfile> {
    const response = await this.postForm_(
      VK_USER_INFO_URL,
      new URLSearchParams({
        access_token: accessToken,
        client_id: this.options_.clientId,
      })
    );
    const profile = isRecord(response) && isRecord(response.user)
      ? response.user
      : response;

    if (!isRecord(profile)) {
      throw new Error(SANITIZED_FAILURE);
    }

    return profile as unknown as VkIdUserProfile;
  }

  private async postForm_(url: string, body: URLSearchParams): Promise<unknown> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(SANITIZED_FAILURE);
    }

    return response.json();
  }

  private createCodeChallenge_(verifier: string) {
    return createHash("sha256").update(verifier).digest("base64url");
  }

  private failure_(): AuthenticationResponse {
    return { success: false, error: SANITIZED_FAILURE };
  }
}
