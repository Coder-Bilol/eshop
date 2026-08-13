import {
  WishlistClientError,
  type StoreWishlistClient,
  type WishlistClientErrorCode,
  type WishlistItem,
} from "./wishlist";

export type WishlistStatus = "guest" | "loading" | "ready" | "error";

export type WishlistStateError = {
  code: WishlistClientErrorCode;
  message: string;
  httpStatus: number | null;
  recoverable: boolean;
};

export type WishlistState = {
  status: WishlistStatus;
  customerId: string | null;
  items: WishlistItem[];
  pendingProductIds: string[];
  errors: Record<string, WishlistStateError>;
  error: WishlistStateError | null;
};

export type WishlistStateControllerOptions = {
  client: StoreWishlistClient;
};

export type WishlistStateController = {
  getState(): WishlistState;
  subscribe(listener: (state: WishlistState) => void): () => void;
  load(customerId: string): Promise<WishlistState>;
  add(productId: string): Promise<WishlistState>;
  remove(productId: string): Promise<WishlistState>;
  clear(): WishlistState;
};

const initialState: WishlistState = {
  status: "guest",
  customerId: null,
  items: [],
  pendingProductIds: [],
  errors: {},
  error: null,
};

export function createWishlistStateController(
  options: WishlistStateControllerOptions
): WishlistStateController {
  let state = initialState;
  let sessionVersion = 0;
  let loadVersion = 0;
  const pendingProductIds = new Set<string>();
  const mutationVersions = new Map<string, number>();
  const listeners = new Set<(state: WishlistState) => void>();

  function emit(nextState: WishlistState) {
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  async function load(customerId: string) {
    const normalizedCustomerId = normalizeId(customerId);
    if (!normalizedCustomerId) {
      return clear();
    }

    sessionVersion += 1;
    loadVersion += 1;
    pendingProductIds.clear();
    mutationVersions.clear();
    const requestSessionVersion = sessionVersion;
    const requestLoadVersion = loadVersion;
    const sameCustomer = state.customerId === normalizedCustomerId;

    emit({
      status: "loading",
      customerId: normalizedCustomerId,
      items: sameCustomer ? state.items : [],
      pendingProductIds: [],
      errors: {},
      error: null,
    });

    try {
      const items = await options.client.list();
      if (
        requestSessionVersion !== sessionVersion ||
        requestLoadVersion !== loadVersion ||
        state.customerId !== normalizedCustomerId
      ) {
        return state;
      }

      return emit({
        status: "ready",
        customerId: normalizedCustomerId,
        items,
        pendingProductIds: [],
        errors: {},
        error: null,
      });
    } catch (error) {
      if (
        requestSessionVersion !== sessionVersion ||
        requestLoadVersion !== loadVersion ||
        state.customerId !== normalizedCustomerId
      ) {
        return state;
      }
      if (isSessionExpired(error)) {
        return clear();
      }

      return emit({
        status: "error",
        customerId: normalizedCustomerId,
        items: [],
        pendingProductIds: [],
        errors: {},
        error: normalizeError(error),
      });
    }
  }

  async function add(productId: string) {
    return mutate("add", productId);
  }

  async function remove(productId: string) {
    return mutate("remove", productId);
  }

  async function mutate(operation: "add" | "remove", productId: string) {
    if (!state.customerId || state.status === "guest") {
      return state;
    }

    const normalizedProductId = normalizeId(productId);
    if (!normalizedProductId) {
      return emit({
        ...state,
        error: validationError(),
      });
    }

    if (pendingProductIds.has(normalizedProductId)) {
      return state;
    }

    const customerId = state.customerId;
    const requestSessionVersion = sessionVersion;
    const mutationVersion =
      (mutationVersions.get(normalizedProductId) || 0) + 1;
    mutationVersions.set(normalizedProductId, mutationVersion);
    loadVersion += 1;
    pendingProductIds.add(normalizedProductId);
    const nextErrors = { ...state.errors };
    delete nextErrors[normalizedProductId];
    emit({
      ...state,
      status: state.status === "error" ? "ready" : state.status,
      pendingProductIds: [...pendingProductIds],
      errors: nextErrors,
      error: state.status === "error" ? null : state.error,
    });

    try {
      let nextItems = state.items;
      if (operation === "add") {
        const result = await options.client.add(normalizedProductId);
        nextItems = [
          result.item,
          ...state.items.filter((item) => item.product_id !== normalizedProductId),
        ];
      } else {
        const result = await options.client.remove(normalizedProductId);
        nextItems = state.items.filter(
          (item) => item.product_id !== result.product_id
        );
      }

      if (
        requestSessionVersion !== sessionVersion ||
        mutationVersions.get(normalizedProductId) !== mutationVersion ||
        state.customerId !== customerId ||
        !pendingProductIds.has(normalizedProductId)
      ) {
        return state;
      }

      pendingProductIds.delete(normalizedProductId);
      mutationVersions.delete(normalizedProductId);
      const completedErrors = { ...state.errors };
      delete completedErrors[normalizedProductId];
      return emit({
        ...state,
        status: "ready",
        items: nextItems,
        pendingProductIds: [...pendingProductIds],
        errors: completedErrors,
        error: null,
      });
    } catch (error) {
      if (
        requestSessionVersion !== sessionVersion ||
        mutationVersions.get(normalizedProductId) !== mutationVersion ||
        state.customerId !== customerId ||
        !pendingProductIds.has(normalizedProductId)
      ) {
        return state;
      }

      if (isSessionExpired(error)) {
        return clear();
      }

      pendingProductIds.delete(normalizedProductId);
      mutationVersions.delete(normalizedProductId);
      return emit({
        ...state,
        status: state.status === "error" ? "error" : "ready",
        pendingProductIds: [...pendingProductIds],
        errors: {
          ...state.errors,
          [normalizedProductId]: normalizeError(error),
        },
      });
    }
  }

  function clear() {
    sessionVersion += 1;
    loadVersion += 1;
    pendingProductIds.clear();
    mutationVersions.clear();
    return emit({
      status: "guest",
      customerId: null,
      items: [],
      pendingProductIds: [],
      errors: {},
      error: null,
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    add,
    remove,
    clear,
  };
}

function normalizeId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function validationError(): WishlistStateError {
  return {
    code: "wishlist_invalid_request",
    message: "A non-empty product ID is required.",
    httpStatus: 400,
    recoverable: true,
  };
}

function normalizeError(error: unknown): WishlistStateError {
  if (error instanceof WishlistClientError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: error.status,
      recoverable: true,
    };
  }

  return {
    code: "wishlist_operation_failed",
    message: "The wishlist state could not be updated.",
    httpStatus: null,
    recoverable: true,
  };
}

function isSessionExpired(error: unknown) {
  return error instanceof WishlistClientError && error.status === 401;
}
