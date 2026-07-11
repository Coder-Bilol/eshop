import {
  readCartReference,
  writeCartReference,
  type CartReferenceStorage,
  type StoreCart,
} from "./cart";

export type CartMergeOutcome = "transferred" | "merged" | "already_merged";

export type StoreCartMerge = {
  source_cart_id: string;
  target_cart_id: string;
  outcome: CartMergeOutcome;
  replayed: boolean;
};

export type StoreCartMergeResult = {
  cart: StoreCart;
  merge: StoreCartMerge;
};

export type CartMergeErrorCode =
  | "cart_merge_invalid_request"
  | "cart_merge_auth_required"
  | "cart_merge_source_forbidden"
  | "cart_not_found"
  | "cart_merge_incompatible"
  | "cart_merge_stock_conflict"
  | "cart_merge_in_progress"
  | "cart_merge_failed"
  | "cart_merge_backend_unavailable"
  | "cart_merge_network_error"
  | "cart_merge_invalid_response"
  | "cart_merge_publishable_key_missing";

export class CartMergeError extends Error {
  readonly code: CartMergeErrorCode;
  readonly status: number | null;

  constructor(
    code: CartMergeErrorCode,
    message: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "CartMergeError";
    this.code = code;
    this.status = status;
  }
}

export type StoreCartMergeClient = {
  mergeCart(sourceCartId: string): Promise<StoreCartMergeResult>;
};

export type StoreCartMergeClientOptions = {
  baseUrl?: string;
  publishableApiKey?: string;
  fetchImplementation?: typeof fetch;
};

export type AuthenticatedCartMergeReferenceOptions = {
  client: StoreCartMergeClient;
  storage?: CartReferenceStorage | null;
};

const DEFAULT_BACKEND_URL = "http://localhost:9000";
const MERGE_ERROR_CODES = new Set<CartMergeErrorCode>([
  "cart_merge_invalid_request",
  "cart_merge_auth_required",
  "cart_merge_source_forbidden",
  "cart_not_found",
  "cart_merge_incompatible",
  "cart_merge_stock_conflict",
  "cart_merge_in_progress",
  "cart_merge_failed",
]);

export function createStoreCartMergeClient(
  options: StoreCartMergeClientOptions = {}
): StoreCartMergeClient {
  const baseUrl = (
    options.baseUrl ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/+$/, "");
  const publishableApiKey = (
    options.publishableApiKey ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    ""
  ).trim();
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;

  if (!publishableApiKey) {
    throw new CartMergeError(
      "cart_merge_publishable_key_missing",
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required."
    );
  }

  if (typeof fetchImplementation !== "function") {
    throw new CartMergeError(
      "cart_merge_network_error",
      "Fetch is not available for cart merge requests."
    );
  }

  return {
    async mergeCart(sourceCartId) {
      const normalizedSourceId = requiredId(sourceCartId, "source cart ID");
      let response: Response;

      try {
        response = await fetchImplementation(
          `${baseUrl}/store/carts/${pathId(normalizedSourceId)}/merge`,
          {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "x-publishable-api-key": publishableApiKey,
            },
            body: JSON.stringify({}),
          }
        );
      } catch {
        throw new CartMergeError(
          "cart_merge_network_error",
          "The cart merge service could not be reached."
        );
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const code = errorCodeForResponse(response.status, payload);
        throw new CartMergeError(code, errorMessageForCode(code), response.status);
      }

      const result = readMergeResult(payload, normalizedSourceId);
      if (!result) {
        throw new CartMergeError(
          "cart_merge_invalid_response",
          "The cart merge service returned an invalid response.",
          502
        );
      }

      return result;
    },
  };
}

export async function mergeAuthenticatedCartReference({
  client,
  storage,
}: AuthenticatedCartMergeReferenceOptions): Promise<StoreCartMergeResult | null> {
  const reference = readCartReference(storage);
  if (!reference) {
    return null;
  }

  const result = await client.mergeCart(reference.cart_id);
  writeCartReference(result.merge.target_cart_id, storage);
  return result;
}

function readMergeResult(
  payload: unknown,
  sourceCartId: string
): StoreCartMergeResult | null {
  if (!isRecord(payload)) {
    return null;
  }

  const cart = payload.cart;
  const merge = payload.merge;
  if (!isRecord(cart) || !isRecord(merge)) {
    return null;
  }

  if (typeof cart.id !== "string" || !cart.id.trim()) {
    return null;
  }

  if (
    merge.source_cart_id !== sourceCartId ||
    typeof merge.target_cart_id !== "string" ||
    !merge.target_cart_id.trim() ||
    merge.target_cart_id !== cart.id ||
    !isMergeOutcome(merge.outcome) ||
    typeof merge.replayed !== "boolean"
  ) {
    return null;
  }

  return {
    cart: cart as StoreCart,
    merge: {
      source_cart_id: merge.source_cart_id,
      target_cart_id: merge.target_cart_id,
      outcome: merge.outcome,
      replayed: merge.replayed,
    },
  };
}

function pathId(value: string) {
  return encodeURIComponent(value);
}

function requiredId(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new CartMergeError(
      "cart_merge_invalid_request",
      `A non-empty ${label} is required.`,
      400
    );
  }
  return normalized;
}

function errorCodeForResponse(status: number, payload: unknown): CartMergeErrorCode {
  const payloadCode = readPayloadErrorCode(payload);
  if (payloadCode) {
    return payloadCode;
  }

  switch (status) {
    case 400:
      return "cart_merge_invalid_request";
    case 401:
      return "cart_merge_auth_required";
    case 403:
      return "cart_merge_source_forbidden";
    case 404:
      return "cart_not_found";
    case 409:
      return "cart_merge_incompatible";
    default:
      return status >= 500 ? "cart_merge_failed" : "cart_merge_invalid_request";
  }
}

function readPayloadErrorCode(payload: unknown): CartMergeErrorCode | null {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }

  const code = payload.error.code;
  return typeof code === "string" && MERGE_ERROR_CODES.has(code as CartMergeErrorCode)
    ? (code as CartMergeErrorCode)
    : null;
}

function errorMessageForCode(code: CartMergeErrorCode) {
  switch (code) {
    case "cart_merge_auth_required":
      return "Customer authentication is required to merge the cart.";
    case "cart_merge_source_forbidden":
      return "The saved cart cannot be merged by this customer.";
    case "cart_not_found":
      return "The saved cart or merge target was not found.";
    case "cart_merge_incompatible":
      return "The saved cart is incompatible with the active customer cart.";
    case "cart_merge_stock_conflict":
      return "The saved cart quantities cannot be merged.";
    case "cart_merge_in_progress":
      return "The saved cart merge is already in progress.";
    case "cart_merge_failed":
      return "The cart merge failed and can be retried.";
    case "cart_merge_backend_unavailable":
    case "cart_merge_network_error":
      return "The cart merge service is temporarily unavailable.";
    case "cart_merge_invalid_response":
      return "The cart merge service returned an invalid response.";
    case "cart_merge_publishable_key_missing":
      return "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required.";
    default:
      return "The cart merge request is invalid.";
  }
}

function isMergeOutcome(value: unknown): value is CartMergeOutcome {
  return value === "transferred" || value === "merged" || value === "already_merged";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
