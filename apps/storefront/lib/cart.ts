export const CART_REFERENCE_KEY = "eshop.cart.v1";
export const CART_REFERENCE_VERSION = 1 as const;

export type CartReference = {
  version: typeof CART_REFERENCE_VERSION;
  cart_id: string;
};

export type CartReferenceStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type StoreCartLineItem = {
  id: string;
  variant_id: string;
  quantity: number;
  [key: string]: unknown;
};

export type StoreCart = {
  id: string;
  customer_id?: string | null;
  currency_code?: string;
  region_id?: string;
  sales_channel_id?: string | null;
  items?: StoreCartLineItem[];
  [key: string]: unknown;
};

export type StoreCreateCartInput = {
  region_id?: string;
  currency_code?: string;
  sales_channel_id?: string;
};

type StoreRegion = {
  id: string;
  name?: string;
  currency_code?: string;
};

export type CartClientErrorCode =
  | "cart_invalid_request"
  | "cart_auth_required"
  | "cart_forbidden"
  | "cart_not_found"
  | "cart_conflict"
  | "cart_validation_failed"
  | "cart_backend_unavailable"
  | "cart_network_error"
  | "cart_invalid_response"
  | "cart_publishable_key_missing";

export type CartReferenceErrorCode =
  | "cart_reference_invalid"
  | "cart_reference_storage_unavailable";

export class CartClientError extends Error {
  readonly code: CartClientErrorCode;
  readonly status: number | null;

  constructor(
    code: CartClientErrorCode,
    message: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "CartClientError";
    this.code = code;
    this.status = status;
  }
}

export class CartReferenceError extends Error {
  readonly code: CartReferenceErrorCode;

  constructor(code: CartReferenceErrorCode, message: string) {
    super(message);
    this.name = "CartReferenceError";
    this.code = code;
  }
}

export type StoreCartClient = {
  createCart(input?: StoreCreateCartInput): Promise<StoreCart>;
  retrieveCart(cartId: string): Promise<StoreCart>;
  addLineItem(
    cartId: string,
    variantId: string,
    quantity: number
  ): Promise<StoreCart>;
  updateLineItem(
    cartId: string,
    lineItemId: string,
    quantity: number
  ): Promise<StoreCart>;
  removeLineItem(cartId: string, lineItemId: string): Promise<StoreCart>;
};

export type StoreCartClientOptions = {
  baseUrl?: string;
  publishableApiKey?: string;
  salesChannelId?: string;
  fetchImplementation?: typeof fetch;
};

const DEFAULT_BACKEND_URL = "http://localhost:9000";
const DEFAULT_CART_REGION_NAME = "Москва";
const DEFAULT_CART_CURRENCY_CODE = "rub";

export function createStoreCartClient(
  options: StoreCartClientOptions = {}
): StoreCartClient {
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
  const salesChannelId = (
    options.salesChannelId ||
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID ||
    ""
  ).trim();
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;

  if (!publishableApiKey) {
    throw new CartClientError(
      "cart_publishable_key_missing",
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required."
    );
  }

  if (typeof fetchImplementation !== "function") {
    throw new CartClientError(
      "cart_network_error",
      "Fetch is not available for Store cart requests."
    );
  }

  async function requestCart(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    responseKey: "cart" | "parent" = "cart"
  ) {
    let response: Response;

    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method,
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-publishable-api-key": publishableApiKey,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new CartClientError(
        "cart_network_error",
        "The cart service could not be reached."
      );
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new CartClientError(
        errorCodeForStatus(response.status),
        errorMessageForStatus(response.status),
        response.status
      );
    }

    const cart = readCartFromResponse(payload, responseKey);
    if (!cart) {
      throw new CartClientError(
        "cart_invalid_response",
        "The cart service returned an invalid response.",
        502
      );
    }

    return cart;
  }

  return {
    async createCart(input = {}) {
      return requestCart(
        "POST",
        "/store/carts",
        await resolveCreateCartInput(input)
      );
    },

    retrieveCart(cartId) {
      return requestCart("GET", `/store/carts/${pathId(cartId)}`);
    },

    addLineItem(cartId, variantId, quantity) {
      return requestCart(
        "POST",
        `/store/carts/${pathId(cartId)}/line-items`,
        {
          variant_id: requiredId(variantId, "variant ID"),
          quantity: positiveQuantity(quantity),
        }
      );
    },

    updateLineItem(cartId, lineItemId, quantity) {
      return requestCart(
        "POST",
        `/store/carts/${pathId(cartId)}/line-items/${pathId(lineItemId)}`,
        {
          quantity: positiveQuantity(quantity),
        }
      );
    },

    removeLineItem(cartId, lineItemId) {
      return requestCart(
        "DELETE",
        `/store/carts/${pathId(cartId)}/line-items/${pathId(lineItemId)}`,
        undefined,
        "parent"
      );
    },
  };

  async function resolveCreateCartInput(input: StoreCreateCartInput) {
    if (input.region_id) {
      return input;
    }

    let response: Response;
    try {
      response = await fetchImplementation(`${baseUrl}/store/regions`, {
        method: "GET",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "x-publishable-api-key": publishableApiKey,
        },
      });
    } catch {
      throw new CartClientError(
        "cart_network_error",
        "The cart service could not be reached."
      );
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new CartClientError(
        errorCodeForStatus(response.status),
        errorMessageForStatus(response.status),
        response.status
      );
    }

    const regions = readRegions(payload).filter(
      (region) =>
        region.name === DEFAULT_CART_REGION_NAME &&
        region.currency_code?.toLowerCase() === DEFAULT_CART_CURRENCY_CODE
    );
    if (regions.length !== 1) {
      throw new CartClientError(
        "cart_validation_failed",
        "The default cart region is unavailable.",
        400
      );
    }
    if (!salesChannelId) {
      throw new CartClientError(
        "cart_validation_failed",
        "The default sales channel is unavailable.",
        400
      );
    }

    return {
      ...input,
      region_id: regions[0].id,
      currency_code: DEFAULT_CART_CURRENCY_CODE,
      sales_channel_id: salesChannelId,
    };
  }

}

export function readCartReference(
  storage: CartReferenceStorage | null = browserCartStorage()
): CartReference | null {
  if (!storage) {
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(CART_REFERENCE_KEY);
  } catch {
    throw storageUnavailable();
  }

  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCartReference(parsed)) {
      return parsed;
    }
  } catch {
    // Invalid browser state is cleared below.
  }

  clearCartReference(storage);
  return null;
}

export function writeCartReference(
  cartId: string,
  storage: CartReferenceStorage | null = browserCartStorage()
): CartReference {
  const reference: CartReference = {
    version: CART_REFERENCE_VERSION,
    cart_id: requiredReferenceId(cartId),
  };

  if (!storage) {
    throw storageUnavailable();
  }

  try {
    storage.setItem(CART_REFERENCE_KEY, JSON.stringify(reference));
  } catch {
    throw storageUnavailable();
  }

  return reference;
}

export function clearCartReference(
  storage: CartReferenceStorage | null = browserCartStorage()
) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(CART_REFERENCE_KEY);
  } catch {
    throw storageUnavailable();
  }
}

export async function restoreReferencedCart(
  client: StoreCartClient,
  storage: CartReferenceStorage | null = browserCartStorage()
): Promise<StoreCart | null> {
  const reference = readCartReference(storage);
  if (!reference) {
    return null;
  }

  try {
    return await client.retrieveCart(reference.cart_id);
  } catch (error) {
    if (error instanceof CartClientError && error.code === "cart_not_found") {
      clearCartReference(storage);
      return null;
    }
    throw error;
  }
}

function browserCartStorage(): CartReferenceStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isCartReference(value: unknown): value is CartReference {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === "cart_id" &&
    keys[1] === "version" &&
    value.version === CART_REFERENCE_VERSION &&
    typeof value.cart_id === "string" &&
    value.cart_id.trim().length > 0 &&
    value.cart_id === value.cart_id.trim()
  );
}

function readCartFromResponse(
  payload: unknown,
  responseKey: "cart" | "parent"
): StoreCart | null {
  if (!isRecord(payload)) {
    return null;
  }

  const cart = payload[responseKey];
  if (!isRecord(cart) || typeof cart.id !== "string" || !cart.id.trim()) {
    return null;
  }

  return cart as StoreCart;
}

function readRegions(payload: unknown): StoreRegion[] {
  if (!isRecord(payload) || !Array.isArray(payload.regions)) {
    throw new CartClientError(
      "cart_invalid_response",
      "The cart service returned an invalid response.",
      502
    );
  }

  return payload.regions.filter(
    (region): region is StoreRegion =>
      isRecord(region) &&
      typeof region.id === "string" &&
      region.id.trim().length > 0 &&
      typeof region.name === "string" &&
      typeof region.currency_code === "string"
  );
}

function pathId(value: string) {
  return encodeURIComponent(requiredId(value, "cart resource ID"));
}

function requiredId(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new CartClientError(
      "cart_invalid_request",
      `A non-empty ${label} is required.`,
      400
    );
  }
  return normalized;
}

function requiredReferenceId(value: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new CartReferenceError(
      "cart_reference_invalid",
      "A non-empty cart ID is required."
    );
  }
  return normalized;
}

function positiveQuantity(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CartClientError(
      "cart_invalid_request",
      "Cart line quantity must be a positive integer.",
      400
    );
  }
  return value;
}

function errorCodeForStatus(status: number): CartClientErrorCode {
  switch (status) {
    case 400:
      return "cart_invalid_request";
    case 401:
      return "cart_auth_required";
    case 403:
      return "cart_forbidden";
    case 404:
      return "cart_not_found";
    case 409:
      return "cart_conflict";
    case 422:
      return "cart_validation_failed";
    default:
      return status >= 500
        ? "cart_backend_unavailable"
        : "cart_invalid_request";
  }
}

function errorMessageForStatus(status: number) {
  switch (status) {
    case 400:
    case 422:
      return "The cart request is invalid.";
    case 401:
      return "Customer authentication is required.";
    case 403:
      return "The cart request is not allowed.";
    case 404:
      return "The cart was not found.";
    case 409:
      return "The cart conflicts with its current state.";
    default:
      return status >= 500
        ? "The cart service is temporarily unavailable."
        : "The cart request failed.";
  }
}

function storageUnavailable() {
  return new CartReferenceError(
    "cart_reference_storage_unavailable",
    "Browser cart reference storage is unavailable."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
