import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

import type { AuthIdentityProviderService } from "@medusajs/framework/types";
import {
  AbstractAuthModuleProvider,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";

import providerModule from "../modules/auth-vkid";
import VkIdAuthService from "../modules/auth-vkid/service";

const backendRoot = path.resolve(__dirname, "..", "..");
const sanitizedFailure = "VK authentication failed";
const accessTokenMarker = "synthetic-access-token-must-not-persist";
const refreshTokenMarker = "synthetic-refresh-token-must-not-persist";
const idTokenMarker = "synthetic-id-token-must-not-persist";
const rawFailureMarker = "raw-upstream-detail-must-not-escape";
const options = {
  clientId: "synthetic-vk-client-id",
  serviceToken: "synthetic-vk-service-token",
  callbackUrl: "http://localhost:9000/auth/customer/vkid/complete",
};

type FetchCall = {
  body: URLSearchParams;
  url: string;
};

type FetchMode = {
  missingEmail?: boolean;
  networkFailure?: boolean;
  profileUserId?: string;
  tokenState?: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const createProviderDouble = () => {
  const calls: FetchCall[] = [];
  const mode: FetchMode = {};
  const fetchDouble: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ url, body });

    if (mode.networkFailure) {
      throw new Error(rawFailureMarker);
    }

    if (url.endsWith("/oauth2/auth")) {
      const validExchange =
        body.get("client_id") === options.clientId &&
        body.get("service_token") === options.serviceToken &&
        body.get("client_secret") === null &&
        body.get("code") === "synthetic-authorization-code" &&
        body.get("device_id") === "synthetic-device-id";
      if (!validExchange) {
        return jsonResponse({ error: rawFailureMarker }, 400);
      }

      return jsonResponse({
        access_token: accessTokenMarker,
        refresh_token: refreshTokenMarker,
        id_token: idTokenMarker,
        state: mode.tokenState ?? body.get("state"),
        user_id: "424242",
      });
    }

    if (url.endsWith("/oauth2/user_info")) {
      return jsonResponse({
        user: {
          user_id: mode.profileUserId ?? "424242",
          ...(mode.missingEmail ? {} : { email: " Buyer@Example.COM " }),
          first_name: " Buyer ",
          last_name: " Example ",
        },
      });
    }

    return jsonResponse({ error: rawFailureMarker }, 500);
  };

  return { calls, fetchDouble, mode };
};

const createIdentityDouble = () => {
  const states = new Map<string, Record<string, unknown>>();
  const creates: Array<Record<string, unknown>> = [];
  const service: AuthIdentityProviderService = {
    async retrieve() {
      throw { type: MedusaError.Types.NOT_FOUND };
    },
    async create(data) {
      creates.push(data);
      return {
        id: "auth_synthetic_vkid",
        app_metadata: {},
        provider_identities: [],
        user_metadata: data.user_metadata,
        created_at: new Date(),
        updated_at: new Date(),
      } as never;
    },
    async update() {
      throw new Error("Unexpected identity update");
    },
    async setState(key, value) {
      states.set(key, { ...value });
    },
    async getState(key) {
      return states.get(key) ?? null;
    },
  };

  return { creates, service, states };
};

const startLogin = async (
  provider: VkIdAuthService,
  identityService: AuthIdentityProviderService
) => {
  const response = await provider.authenticate({}, identityService);
  assert.equal(response.success, true);
  assert.ok(response.location);

  const location = new URL(response.location);
  const stateKey = location.searchParams.get("state");
  assert.ok(stateKey);

  return { location, stateKey };
};

const completeLogin = (
  provider: VkIdAuthService,
  identityService: AuthIdentityProviderService,
  state: string,
  overrides: Record<string, string> = {}
) =>
  provider.validateCallback(
    {
      query: {
        code: "synthetic-authorization-code",
        device_id: "synthetic-device-id",
        state,
        ...overrides,
      },
    },
    identityService
  );

const assertSanitizedFailure = (response: {
  success: boolean;
  error?: string;
}) => {
  assert.equal(response.success, false);
  assert.equal(response.error, sanitizedFailure);
  assert.ok(!JSON.stringify(response).includes(rawFailureMarker));
  assert.ok(!JSON.stringify(response).includes(accessTokenMarker));
};

async function runAuthVkidContract() {
  assert.ok(
    VkIdAuthService.prototype instanceof AbstractAuthModuleProvider,
    "VK ID provider must extend AbstractAuthModuleProvider"
  );
  assert.equal(VkIdAuthService.identifier, "vkid");
  assert.equal(
    (providerModule as { module: string }).module,
    Modules.AUTH
  );
  assert.deepEqual(
    (providerModule as { services: unknown[] }).services,
    [VkIdAuthService]
  );

  const loggerCalls: unknown[] = [];
  const provider = new VkIdAuthService(
    {
      logger: new Proxy(
        {},
        { get: () => (...args: unknown[]) => loggerCalls.push(args) }
      ),
    },
    options
  );
  const providerDouble = createProviderDouble();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = providerDouble.fetchDouble;

  try {
    const identity = createIdentityDouble();
    const startTime = Date.now();
    const started = await startLogin(provider, identity.service);
    const state = identity.states.get(started.stateKey);

    assert.equal(started.location.origin, "https://id.vk.com");
    assert.equal(started.location.pathname, "/authorize");
    assert.equal(started.location.searchParams.get("response_type"), "code");
    assert.equal(started.location.searchParams.get("client_id"), options.clientId);
    assert.equal(
      started.location.searchParams.get("redirect_uri"),
      options.callbackUrl
    );
    assert.equal(started.location.searchParams.get("scope"), "email");
    assert.equal(
      started.location.searchParams.get("code_challenge_method"),
      "S256"
    );
    assert.match(started.stateKey, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(state);
    assert.equal(state.callbackUrl, options.callbackUrl);
    assert.equal(typeof state.codeVerifier, "string");
    assert.equal(
      state.codeChallenge,
      createHash("sha256")
        .update(String(state.codeVerifier))
        .digest("base64url")
    );
    assert.equal(
      started.location.searchParams.get("code_challenge"),
      state.codeChallenge
    );
    assert.ok(Number(state.expiresAt) > startTime);
    assert.ok(Number(state.expiresAt) <= startTime + 10 * 60 * 1000 + 1000);

    const completed = await completeLogin(
      provider,
      identity.service,
      started.stateKey
    );
    assert.equal(completed.success, true);
    assert.equal(identity.creates.length, 1);
    assert.deepEqual(identity.creates[0], {
      entity_id: "424242",
      user_metadata: {
        email: "buyer@example.com",
        first_name: "Buyer",
        last_name: "Example",
      },
    });
    assert.deepEqual(identity.states.get(started.stateKey), {
      consumed: true,
      expiresAt: state.expiresAt,
    });
    assert.equal(providerDouble.calls.length, 2);

    const tokenCall = providerDouble.calls[0];
    assert.ok(tokenCall.url.endsWith("/oauth2/auth"));
    assert.equal(tokenCall.body.get("code_verifier"), state.codeVerifier);
    assert.equal(tokenCall.body.get("device_id"), "synthetic-device-id");
    assert.equal(tokenCall.body.get("state"), started.stateKey);
    assert.equal(tokenCall.body.get("service_token"), options.serviceToken);
    assert.equal(tokenCall.body.get("client_secret"), null);
    const userInfoCall = providerDouble.calls[1];
    assert.ok(userInfoCall.url.endsWith("/oauth2/user_info"));
    assert.equal(userInfoCall.body.get("access_token"), accessTokenMarker);

    const persisted = JSON.stringify({
      creates: identity.creates,
      states: [...identity.states.values()],
    });
    for (const token of [
      accessTokenMarker,
      refreshTokenMarker,
      idTokenMarker,
    ]) {
      assert.ok(!persisted.includes(token));
    }
    assert.deepEqual(loggerCalls, []);

    const replayCalls = providerDouble.calls.length;
    assertSanitizedFailure(
      await completeLogin(provider, identity.service, started.stateKey)
    );
    assert.equal(providerDouble.calls.length, replayCalls);

    const concurrentIdentity = createIdentityDouble();
    const concurrentStart = await startLogin(provider, concurrentIdentity.service);
    const concurrentResults = await Promise.all([
      completeLogin(provider, concurrentIdentity.service, concurrentStart.stateKey),
      completeLogin(provider, concurrentIdentity.service, concurrentStart.stateKey),
    ]);
    assert.equal(concurrentResults.filter((result) => result.success).length, 1);
    assert.equal(concurrentResults.filter((result) => !result.success).length, 1);

    const expiredIdentity = createIdentityDouble();
    const expiredStart = await startLogin(provider, expiredIdentity.service);
    expiredIdentity.states.set(expiredStart.stateKey, {
      ...expiredIdentity.states.get(expiredStart.stateKey),
      expiresAt: Date.now() - 1,
    });
    const callsBeforeExpired = providerDouble.calls.length;
    assertSanitizedFailure(
      await completeLogin(provider, expiredIdentity.service, expiredStart.stateKey)
    );
    assert.equal(providerDouble.calls.length, callsBeforeExpired);

    const pkceIdentity = createIdentityDouble();
    const pkceStart = await startLogin(provider, pkceIdentity.service);
    pkceIdentity.states.set(pkceStart.stateKey, {
      ...pkceIdentity.states.get(pkceStart.stateKey),
      codeVerifier: "tampered-verifier",
    });
    const callsBeforePkce = providerDouble.calls.length;
    assertSanitizedFailure(
      await completeLogin(provider, pkceIdentity.service, pkceStart.stateKey)
    );
    assert.equal(providerDouble.calls.length, callsBeforePkce);

    const missingDeviceIdentity = createIdentityDouble();
    const missingDeviceStart = await startLogin(
      provider,
      missingDeviceIdentity.service
    );
    const callsBeforeMissingDevice = providerDouble.calls.length;
    assertSanitizedFailure(
      await provider.validateCallback(
        {
          query: {
            code: "synthetic-authorization-code",
            state: missingDeviceStart.stateKey,
          },
        },
        missingDeviceIdentity.service
      )
    );
    assert.equal(providerDouble.calls.length, callsBeforeMissingDevice);

    const mismatchedDeviceIdentity = createIdentityDouble();
    const mismatchedDeviceStart = await startLogin(
      provider,
      mismatchedDeviceIdentity.service
    );
    const callsBeforeMismatchedDevice = providerDouble.calls.length;
    assertSanitizedFailure(
      await completeLogin(
        provider,
        mismatchedDeviceIdentity.service,
        mismatchedDeviceStart.stateKey,
        { device_id: "mismatched-device-id" }
      )
    );
    assert.equal(
      providerDouble.calls.length,
      callsBeforeMismatchedDevice + 1
    );
    assert.equal(
      providerDouble.calls.at(-1)?.body.get("device_id"),
      "mismatched-device-id"
    );
    assert.equal(mismatchedDeviceIdentity.creates.length, 0);

    const cancelIdentity = createIdentityDouble();
    const cancelStart = await startLogin(provider, cancelIdentity.service);
    assertSanitizedFailure(
      await provider.validateCallback(
        {
          query: {
            error: "access_denied",
            error_description: rawFailureMarker,
            state: cancelStart.stateKey,
          },
        },
        cancelIdentity.service
      )
    );

    const networkIdentity = createIdentityDouble();
    const networkStart = await startLogin(provider, networkIdentity.service);
    providerDouble.mode.networkFailure = true;
    assertSanitizedFailure(
      await completeLogin(provider, networkIdentity.service, networkStart.stateKey)
    );
    providerDouble.mode.networkFailure = false;

    const missingEmailIdentity = createIdentityDouble();
    const missingEmailStart = await startLogin(
      provider,
      missingEmailIdentity.service
    );
    providerDouble.mode.missingEmail = true;
    assertSanitizedFailure(
      await completeLogin(
        provider,
        missingEmailIdentity.service,
        missingEmailStart.stateKey
      )
    );
    assert.equal(missingEmailIdentity.creates.length, 0);
    providerDouble.mode.missingEmail = false;

    const mismatchedUserIdentity = createIdentityDouble();
    const mismatchedUserStart = await startLogin(
      provider,
      mismatchedUserIdentity.service
    );
    providerDouble.mode.profileUserId = "777777";
    assertSanitizedFailure(
      await completeLogin(
        provider,
        mismatchedUserIdentity.service,
        mismatchedUserStart.stateKey
      )
    );
    assert.equal(mismatchedUserIdentity.creates.length, 0);
    providerDouble.mode.profileUserId = undefined;

    const mismatchedStateIdentity = createIdentityDouble();
    const mismatchedStateStart = await startLogin(
      provider,
      mismatchedStateIdentity.service
    );
    providerDouble.mode.tokenState = "different-returned-state";
    assertSanitizedFailure(
      await completeLogin(
        provider,
        mismatchedStateIdentity.service,
        mismatchedStateStart.stateKey
      )
    );
    assert.equal(mismatchedStateIdentity.creates.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const runExistingSuites = (requested: string[]) => {
  const runner = path.resolve(backendRoot, "test", "run-integration.cjs");
  const result = spawnSync(process.execPath, [runner, ...requested], {
    cwd: backendRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Existing integration suite failed");
  }
};

async function main() {
  const requested = process.argv.slice(2);
  const runVkid = requested.includes("auth-vkid");
  const existingSuites = requested.filter((name) => name !== "auth-vkid");

  if (!runVkid) {
    runExistingSuites(requested);
    return;
  }

  await runAuthVkidContract();
  if (existingSuites.length) {
    runExistingSuites(existingSuites);
  }

  console.log(
    JSON.stringify({
      command: "test:integration",
      status: "ok",
      suites: ["auth-vkid", ...existingSuites],
      provider: "vkid",
      state: "single-use-ttl",
      pkce: "S256",
      exchangeCredential: "service_token",
      deviceId: "mismatch-rejected",
      identity: "stable-user-id-validated-email",
      providerTokens: "not-persisted-or-logged",
      failures: "sanitized",
      credentials: "synthetic-provider-double",
    })
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "VK ID contract failed");
  process.exitCode = 1;
});
