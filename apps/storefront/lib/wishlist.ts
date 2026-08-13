export type WishlistProduct = {
  id: string;
  handle: string;
  title: string;
  thumbnail: string | null;
  category: {
    handle: string;
    name: string;
  };
  price: {
    amount: number;
    currency_code: string;
  } | null;
  is_available: boolean;
};

export type WishlistItem = {
  id: string;
  product_id: string;
  created_at: string;
  product: WishlistProduct;
};

export type WishlistAddResult = {
  item: WishlistItem;
  created: boolean;
};

export type WishlistRemoveResult = {
  product_id: string;
  removed: boolean;
};

export type StoreWishlistClient = {
  list(): Promise<WishlistItem[]>;
  add(productId: string): Promise<WishlistAddResult>;
  remove(productId: string): Promise<WishlistRemoveResult>;
};

export type StoreWishlistClientOptions = {
  baseUrl?: string;
  publishableApiKey?: string;
  fetchImplementation?: typeof fetch;
};

export type WishlistClientErrorCode =
  | "wishlist_invalid_request"
  | "wishlist_auth_required"
  | "wishlist_product_not_found"
  | "wishlist_operation_failed"
  | "wishlist_network_error"
  | "wishlist_invalid_response"
  | "wishlist_publishable_key_missing";

export class WishlistClientError extends Error {
  readonly code: WishlistClientErrorCode;
  readonly status: number | null;

  constructor(
    code: WishlistClientErrorCode,
    message: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "WishlistClientError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_BACKEND_URL = "http://localhost:9000";
const WISHLIST_ERROR_CODES = new Set<WishlistClientErrorCode>([
  "wishlist_invalid_request",
  "wishlist_auth_required",
  "wishlist_product_not_found",
  "wishlist_operation_failed",
]);

export function createStoreWishlistClient(
  options: StoreWishlistClientOptions = {}
): StoreWishlistClient {
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
    throw new WishlistClientError(
      "wishlist_publishable_key_missing",
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required."
    );
  }

  if (typeof fetchImplementation !== "function") {
    throw new WishlistClientError(
      "wishlist_network_error",
      "Fetch is not available for Store wishlist requests."
    );
  }

  async function request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<unknown> {
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
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new WishlistClientError(
        "wishlist_network_error",
        "The wishlist service could not be reached."
      );
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = errorCodeForResponse(response.status, payload);
      throw new WishlistClientError(
        code,
        errorMessageForCode(code),
        response.status
      );
    }

    return payload;
  }

  return {
    async list() {
      const payload = await request("GET", "/store/wishlist");
      const items = readWishlistList(payload);
      if (!items) {
        throw invalidResponse();
      }
      return items;
    },

    async add(productId) {
      const normalizedProductId = requiredProductId(productId);
      const payload = await request(
        "POST",
        "/store/wishlist/items",
        { product_id: normalizedProductId }
      );
      if (!isRecord(payload) || typeof payload.created !== "boolean") {
        throw invalidResponse();
      }

      const item = readWishlistItem(payload.item);
      if (!item || item.product_id !== normalizedProductId) {
        throw invalidResponse();
      }

      return { item, created: payload.created };
    },

    async remove(productId) {
      const normalizedProductId = requiredProductId(productId);
      const payload = await request(
        "DELETE",
        `/store/wishlist/items/${encodeURIComponent(normalizedProductId)}`
      );
      if (
        !isRecord(payload) ||
        payload.product_id !== normalizedProductId ||
        typeof payload.removed !== "boolean"
      ) {
        throw invalidResponse();
      }

      return {
        product_id: normalizedProductId,
        removed: payload.removed,
      };
    },
  };
}

function readWishlistList(payload: unknown): WishlistItem[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }
  if (
    !Number.isSafeInteger(payload.count) ||
    payload.count !== payload.items.length
  ) {
    return null;
  }

  const items = payload.items.map(readWishlistItem);
  return items.every((item): item is WishlistItem => item !== null)
    ? items
    : null;
}

function readWishlistItem(value: unknown): WishlistItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const product = readWishlistProduct(value.product);
  if (
    !product ||
    !nonEmptyString(value.id) ||
    !nonEmptyString(value.product_id) ||
    !nonEmptyString(value.created_at)
  ) {
    return null;
  }
  if (product.id !== value.product_id) {
    return null;
  }

  return {
    id: value.id,
    product_id: value.product_id,
    created_at: value.created_at,
    product,
  };
}

function readWishlistProduct(value: unknown): WishlistProduct | null {
  if (!isRecord(value) || !isRecord(value.category)) {
    return null;
  }

  const price = readWishlistPrice(value.price);
  if (
    !nonEmptyString(value.id) ||
    !nonEmptyString(value.handle) ||
    !nonEmptyString(value.title) ||
    !nonEmptyString(value.category.handle) ||
    !nonEmptyString(value.category.name) ||
    (value.thumbnail !== null && typeof value.thumbnail !== "string") ||
    (value.price !== null && price === null) ||
    typeof value.is_available !== "boolean"
  ) {
    return null;
  }

  return {
    id: value.id,
    handle: value.handle,
    title: value.title,
    thumbnail: value.thumbnail,
    category: {
      handle: value.category.handle,
      name: value.category.name,
    },
    price,
    is_available: value.is_available,
  };
}

function readWishlistPrice(value: unknown): WishlistProduct["price"] {
  if (value === null) {
    return null;
  }
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.amount) ||
    value.amount < 0 ||
    !nonEmptyString(value.currency_code) ||
    value.currency_code !== value.currency_code.toUpperCase()
  ) {
    return null;
  }

  return {
    amount: value.amount,
    currency_code: value.currency_code,
  };
}

function requiredProductId(value: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new WishlistClientError(
      "wishlist_invalid_request",
      "A non-empty product ID is required.",
      400
    );
  }
  return normalized;
}

function errorCodeForResponse(
  status: number,
  payload: unknown
): WishlistClientErrorCode {
  const payloadCode = readPayloadErrorCode(payload);
  if (payloadCode) {
    return payloadCode;
  }

  switch (status) {
    case 400:
      return "wishlist_invalid_request";
    case 401:
      return "wishlist_auth_required";
    case 404:
      return "wishlist_product_not_found";
    default:
      return "wishlist_operation_failed";
  }
}

function readPayloadErrorCode(
  payload: unknown
): WishlistClientErrorCode | null {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return null;
  }
  const code = payload.error.code;
  return typeof code === "string" && WISHLIST_ERROR_CODES.has(code as WishlistClientErrorCode)
    ? (code as WishlistClientErrorCode)
    : null;
}

function errorMessageForCode(code: WishlistClientErrorCode) {
  switch (code) {
    case "wishlist_auth_required":
      return "Customer authentication is required to use the wishlist.";
    case "wishlist_product_not_found":
      return "The wishlist product was not found.";
    case "wishlist_invalid_request":
      return "The wishlist request is invalid.";
    default:
      return "The wishlist service is temporarily unavailable.";
  }
}

function invalidResponse() {
  return new WishlistClientError(
    "wishlist_invalid_response",
    "The wishlist service returned an invalid response.",
    502
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
