export const AUTH_RETURN_PATH_KEY = "eshop.auth.return-path.v1";
export const AUTH_RETURN_PATH_VERSION = 1 as const;
export const CUSTOMER_AUTH_PROVIDERS = ["google", "vkid"] as const;

export type CustomerAuthProvider = (typeof CUSTOMER_AUTH_PROVIDERS)[number];

export type AuthCustomer = {
  id: string;
  [key: string]: unknown;
};

export type AuthReturnPathStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type StoreAuthClient = {
  startProviderLogin(provider: CustomerAuthProvider): Promise<string>;
  retrieveCurrentCustomer(): Promise<AuthCustomer>;
  logout(): Promise<void>;
};

export type StoreAuthClientOptions = {
  baseUrl?: string;
  publishableApiKey?: string;
  fetchImplementation?: typeof fetch;
};

export type AuthClientErrorCode =
  | "auth_invalid_provider"
  | "auth_invalid_request"
  | "auth_required"
  | "auth_rate_limited"
  | "auth_backend_unavailable"
  | "auth_network_error"
  | "auth_invalid_response"
  | "auth_publishable_key_missing";

export class AuthClientError extends Error {
  readonly code: AuthClientErrorCode;
  readonly status: number | null;

  constructor(
    code: AuthClientErrorCode,
    message: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "AuthClientError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_BACKEND_URL = "http://localhost:9000";
const OAUTH_AUTHORIZATION_DESTINATIONS: Record<CustomerAuthProvider, string> = {
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  vkid: "https://id.vk.com/authorize",
};
const CALLBACK_PARAMETER_NAMES = new Set([
  "callback",
  "callbackurl",
  "redirect",
  "redirecturi",
  "redirecturl",
]);
const RETURN_PARAMETER_NAMES = new Set([
  "continue",
  "next",
  "return",
  "returnpath",
  "returnto",
  "returnurl",
]);
const QUERY_DECODE_LIMIT = 3;
const MAX_AUTHORIZATION_QUERY_LENGTH = 4096;
const MAX_AUTHORIZATION_QUERY_SEGMENTS = 32;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;
const OAUTH_PARAMETER_NAME_PATTERN = /^[A-Za-z0-9._~-]+$/;
const consumedReturnPathStorages = new WeakSet<AuthReturnPathStorage>();

export function createStoreAuthClient(
  options: StoreAuthClientOptions = {}
): StoreAuthClient {
  const baseUrl = (
    options.baseUrl ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/+$/, "");
  const backendOrigin = backendOriginFor(baseUrl);
  const publishableApiKey = (
    options.publishableApiKey ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;

  if (!publishableApiKey) {
    throw new AuthClientError(
      "auth_publishable_key_missing",
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required."
    );
  }
  if (typeof fetchImplementation !== "function") {
    throw new AuthClientError(
      "auth_network_error",
      "Fetch is not available for customer authentication requests."
    );
  }

  async function request(method: "GET" | "POST" | "DELETE", path: string) {
    let response: Response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method,
        cache: "no-store",
        credentials: "include",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-publishable-api-key": publishableApiKey,
        },
      });
    } catch {
      throw new AuthClientError(
        "auth_network_error",
        "The authentication service could not be reached."
      );
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AuthClientError(
        errorCodeForStatus(response.status),
        errorMessageForStatus(response.status),
        response.status
      );
    }
    return payload;
  }

  return {
    async startProviderLogin(provider) {
      if (!isCustomerAuthProvider(provider)) {
        throw new AuthClientError(
          "auth_invalid_provider",
          "The authentication provider is not supported.",
          400
        );
      }

      const payload = await request("POST", `/auth/customer/${provider}`);
      const location = isRecord(payload)
        ? allowedAuthorizationLocation(payload.location, provider, backendOrigin)
        : null;
      if (!location) {
        throw new AuthClientError(
          "auth_invalid_response",
          "The authentication service returned an invalid response.",
          502
        );
      }
      return location;
    },

    async retrieveCurrentCustomer() {
      const payload = await request("GET", "/store/customers/me");
      if (!isRecord(payload) || !isCustomer(payload.customer)) {
        throw new AuthClientError(
          "auth_invalid_response",
          "The customer service returned an invalid response.",
          502
        );
      }
      return payload.customer;
    },

    async logout() {
      const payload = await request("DELETE", "/auth/session");
      if (!isRecord(payload) || payload.success !== true) {
        throw new AuthClientError(
          "auth_invalid_response",
          "The authentication service returned an invalid response.",
          502
        );
      }
    },
  };
}

export function normalizeReturnPath(value: unknown): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : "/";
}

export function writeReturnPath(
  value: unknown,
  storage: AuthReturnPathStorage | null = browserSessionStorage()
): string {
  const path = normalizeReturnPath(value);
  if (!storage) {
    return path;
  }

  try {
    storage.setItem(
      AUTH_RETURN_PATH_KEY,
      JSON.stringify({ version: AUTH_RETURN_PATH_VERSION, path })
    );
    consumedReturnPathStorages.delete(storage);
  } catch {
    // Login remains safe with the root fallback when session storage is unavailable.
  }
  return path;
}

export function consumeReturnPath(
  storage: AuthReturnPathStorage | null = browserSessionStorage()
): string {
  if (!storage) {
    return "/";
  }

  if (consumedReturnPathStorages.has(storage)) {
    try {
      storage.removeItem(AUTH_RETURN_PATH_KEY);
    } catch {
      // The in-memory tombstone still prevents reuse in this browser runtime.
    }
    return "/";
  }

  consumedReturnPathStorages.add(storage);
  let raw: string | null = null;
  try {
    raw = storage.getItem(AUTH_RETURN_PATH_KEY);
  } catch {
    return "/";
  }

  if (raw === null) {
    return "/";
  }

  try {
    storage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    try {
      storage.setItem(AUTH_RETURN_PATH_KEY, "");
    } catch {
      // Fail closed; the in-memory tombstone prevents reuse in this runtime.
    }
    return "/";
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isReturnPathEnvelope(parsed)) {
      return normalizeReturnPath(parsed.path);
    }
  } catch {
    // Malformed state falls back to root after consumption.
  }
  return "/";
}

export function clearReturnPath(
  storage: AuthReturnPathStorage | null = browserSessionStorage()
) {
  if (!storage) {
    return;
  }
  consumedReturnPathStorages.add(storage);
  try {
    storage.removeItem(AUTH_RETURN_PATH_KEY);
  } catch {
    // Confirmed logout still clears in-memory identity when storage is unavailable.
  }
}

function browserSessionStorage(): AuthReturnPathStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isCustomerAuthProvider(value: unknown): value is CustomerAuthProvider {
  return CUSTOMER_AUTH_PROVIDERS.some((provider) => provider === value);
}

function backendOriginFor(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.origin;
    }
  } catch {
    // Request construction below will map an unusable URL to a network error.
  }
  return null;
}

function allowedAuthorizationLocation(
  value: unknown,
  provider: CustomerAuthProvider,
  backendOrigin: string | null
): string | null {
  if (typeof value !== "string" || !backendOrigin) {
    return null;
  }
  try {
    const destination = OAUTH_AUTHORIZATION_DESTINATIONS[provider];
    const hasQuery = value.startsWith(`${destination}?`);
    if (
      (value !== destination && !hasQuery) ||
      value === `${destination}?` ||
      value.includes("#") ||
      CONTROL_CHARACTER_PATTERN.test(value) ||
      (hasQuery && !hasValidRawAuthorizationQuery(value.slice(destination.length + 1)))
    ) {
      return null;
    }
    const location = new URL(value);

    if (
      location.protocol !== "https:" ||
      location.hash !== "" ||
      location.username !== "" ||
      location.password !== "" ||
      hasUnsafeNavigationParameter(location, provider, backendOrigin)
    ) {
      return null;
    }
    return location.href;
  } catch {
    return null;
  }
}

function hasValidRawAuthorizationQuery(rawQuery: string) {
  if (rawQuery.length > MAX_AUTHORIZATION_QUERY_LENGTH) {
    return false;
  }

  const segments = rawQuery.split("&");
  if (segments.length > MAX_AUTHORIZATION_QUERY_SEGMENTS) {
    return false;
  }

  const seenNames = new Set<string>();

  for (const segment of segments) {
    const separator = segment.indexOf("=");
    if (separator <= 0) {
      return false;
    }

    const rawName = segment.slice(0, separator);
    const name = decodeQueryComponent(rawName);
    const value = decodeQueryComponent(segment.slice(separator + 1));
    if (
      name === null ||
      value === null ||
      !OAUTH_PARAMETER_NAME_PATTERN.test(name)
    ) {
      return false;
    }

    const normalizedName = name.toLowerCase();
    const navigationName = normalizedName.replace(/[-_]/g, "");
    if (
      seenNames.has(normalizedName) ||
      RETURN_PARAMETER_NAMES.has(navigationName) ||
      (CALLBACK_PARAMETER_NAMES.has(navigationName) && rawName !== "redirect_uri")
    ) {
      return false;
    }
    seenNames.add(normalizedName);
  }

  return true;
}

function decodeQueryComponent(rawValue: string): string | null {
  let value = rawValue.replace(/\+/g, " ");

  for (let round = 0; round < QUERY_DECODE_LIMIT; round += 1) {
    if (/%(?![0-9a-f]{2})/i.test(value)) {
      return null;
    }
    if (!/%[0-9a-f]{2}/i.test(value)) {
      return CONTROL_CHARACTER_PATTERN.test(value) ? null : value;
    }

    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    if (
      CONTROL_CHARACTER_PATTERN.test(value) ||
      /%(?![0-9a-f]{2})/i.test(value)
    ) {
      return null;
    }
  }

  return /%[0-9a-f]{2}/i.test(value) ? null : value;
}

function hasUnsafeNavigationParameter(
  location: URL,
  provider: CustomerAuthProvider,
  backendOrigin: string
) {
  const expectedCallback = `${backendOrigin}/auth/customer/${provider}/complete`;
  const seenNames = new Set<string>();

  for (const [rawName, value] of location.searchParams) {
    const name = rawName.toLowerCase();
    const navigationName = name.replace(/[-_]/g, "");
    if (seenNames.has(name) || RETURN_PARAMETER_NAMES.has(navigationName)) {
      return true;
    }
    seenNames.add(name);
    if (!CALLBACK_PARAMETER_NAMES.has(navigationName)) {
      continue;
    }

    if (rawName !== "redirect_uri" || value !== expectedCallback) {
      return true;
    }
  }
  return false;
}

function isCustomer(value: unknown): value is AuthCustomer {
  return isRecord(value) && typeof value.id === "string" && value.id.trim() !== "";
}

function isReturnPathEnvelope(value: unknown): value is {
  version: typeof AUTH_RETURN_PATH_VERSION;
  path: string;
} {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === "path" &&
    keys[1] === "version" &&
    value.version === AUTH_RETURN_PATH_VERSION &&
    typeof value.path === "string"
  );
}

function errorCodeForStatus(status: number): AuthClientErrorCode {
  switch (status) {
    case 400:
      return "auth_invalid_request";
    case 401:
      return "auth_required";
    case 429:
      return "auth_rate_limited";
    default:
      return status >= 500
        ? "auth_backend_unavailable"
        : "auth_invalid_request";
  }
}

function errorMessageForStatus(status: number) {
  switch (status) {
    case 400:
      return "The authentication request is invalid.";
    case 401:
      return "Customer authentication is required.";
    case 429:
      return "Too many authentication attempts. Try again later.";
    default:
      return status >= 500
        ? "The authentication service is temporarily unavailable."
        : "The authentication request failed.";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
