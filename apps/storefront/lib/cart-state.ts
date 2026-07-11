import {
  CartClientError,
  CartReferenceError,
  clearCartReference,
  restoreReferencedCart,
  writeCartReference,
  type CartClientErrorCode,
  type CartReferenceErrorCode,
  type CartReferenceStorage,
  type StoreCart,
  type StoreCartClient,
  type StoreCreateCartInput,
} from "./cart";

export type GuestCartOperation = "restore" | "add" | "update" | "remove";

export type GuestCartStatus =
  | "idle"
  | "loading"
  | "empty"
  | "ready"
  | "validation_error"
  | "stock_conflict"
  | "backend_error";

export type GuestCartStateError = {
  code: CartClientErrorCode | CartReferenceErrorCode;
  message: string;
  httpStatus: number | null;
  recoverable: boolean;
};

export type GuestCartState = {
  status: GuestCartStatus;
  operation: GuestCartOperation | null;
  cart: StoreCart | null;
  error: GuestCartStateError | null;
};

export type AddGuestCartItemInput = {
  variantId: string;
  quantity?: number;
};

export type UpdateGuestCartItemInput = {
  lineItemId: string;
  quantity: number;
};

export type RemoveGuestCartItemInput = {
  lineItemId: string;
};

export type GuestCartStateControllerOptions = {
  client: StoreCartClient;
  storage?: CartReferenceStorage | null;
  createCartInput?: StoreCreateCartInput | (() => StoreCreateCartInput);
};

export type GuestCartStateController = {
  getState(): GuestCartState;
  subscribe(listener: (state: GuestCartState) => void): () => void;
  restore(): Promise<GuestCartState>;
  addItem(input: AddGuestCartItemInput): Promise<GuestCartState>;
  updateItem(input: UpdateGuestCartItemInput): Promise<GuestCartState>;
  removeItem(input: RemoveGuestCartItemInput): Promise<GuestCartState>;
  clearLocalReference(): GuestCartState;
};

const initialState: GuestCartState = {
  status: "idle",
  operation: null,
  cart: null,
  error: null,
};

export function createGuestCartStateController(
  options: GuestCartStateControllerOptions
): GuestCartStateController {
  let state = initialState;
  const listeners = new Set<(state: GuestCartState) => void>();

  function emit(nextState: GuestCartState) {
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function setLoading(operation: GuestCartOperation) {
    return emit({
      ...state,
      status: "loading",
      operation,
      error: null,
    });
  }

  function adoptBackendCart(cart: StoreCart) {
    try {
      writeCartReference(cart.id, options.storage);
    } catch (error) {
      return emit(errorState("backend_error", cart, normalizeError(error)));
    }

    return emit(stateFromCart(cart));
  }

  async function restore() {
    setLoading("restore");

    try {
      const cart = await restoreReferencedCart(options.client, options.storage);
      return cart ? adoptBackendCart(cart) : emit(emptyState(null));
    } catch (error) {
      return emit(errorState("backend_error", state.cart, normalizeError(error)));
    }
  }

  async function addItem(input: AddGuestCartItemInput) {
    const variantId = normalizeId(input.variantId, "variant ID");
    const quantity = normalizeQuantity(input.quantity ?? 1);
    if (!variantId.ok) {
      return emit(
        errorState("validation_error", state.cart, validationError(variantId.message))
      );
    }
    if (!quantity.ok) {
      return emit(
        errorState("validation_error", state.cart, validationError(quantity.message))
      );
    }

    setLoading("add");

    let baseCart: StoreCart | null = null;
    try {
      baseCart = await resolveCartForAdd();
      const cart = await options.client.addLineItem(
        baseCart.id,
        variantId.value,
        quantity.value
      );
      return adoptBackendCart(cart);
    } catch (error) {
      return handleCartError(error, baseCart);
    }
  }

  async function updateItem(input: UpdateGuestCartItemInput) {
    const lineItemId = normalizeId(input.lineItemId, "line item ID");
    const quantity = normalizeQuantity(input.quantity);
    if (!lineItemId.ok) {
      return emit(
        errorState("validation_error", state.cart, validationError(lineItemId.message))
      );
    }
    if (!quantity.ok) {
      return emit(
        errorState("validation_error", state.cart, validationError(quantity.message))
      );
    }

    setLoading("update");

    let activeCart: StoreCart | null = null;
    try {
      activeCart = await resolveExistingCart();
      const cart = await options.client.updateLineItem(
        activeCart.id,
        lineItemId.value,
        quantity.value
      );
      return adoptBackendCart(cart);
    } catch (error) {
      return handleCartError(error, activeCart);
    }
  }

  async function removeItem(input: RemoveGuestCartItemInput) {
    const lineItemId = normalizeId(input.lineItemId, "line item ID");
    if (!lineItemId.ok) {
      return emit(
        errorState("validation_error", state.cart, validationError(lineItemId.message))
      );
    }

    setLoading("remove");

    let activeCart: StoreCart | null = null;
    try {
      activeCart = await resolveExistingCart();
      const cart = await options.client.removeLineItem(activeCart.id, lineItemId.value);
      return adoptBackendCart(cart);
    } catch (error) {
      return handleCartError(error, activeCart);
    }
  }

  async function resolveCartForAdd() {
    if (state.cart) {
      return state.cart;
    }

    const restored = await restoreReferencedCart(options.client, options.storage);
    if (restored) {
      return restored;
    }

    const created = await options.client.createCart(resolveCreateCartInput(options));
    writeCartReference(created.id, options.storage);
    return created;
  }

  async function resolveExistingCart() {
    if (state.cart) {
      return state.cart;
    }

    const restored = await restoreReferencedCart(options.client, options.storage);
    if (restored) {
      return restored;
    }

    throw new CartClientError("cart_not_found", "The cart was not found.", 404);
  }

  function handleCartError(error: unknown, fallbackCart: StoreCart | null = state.cart) {
    const normalized = normalizeError(error);

    if (normalized.code === "cart_not_found") {
      try {
        clearCartReference(options.storage);
      } catch {
        // Storage failures are reported by the primary cart_not_found state.
      }
      return emit(emptyState(normalized));
    }

    if (
      normalized.code === "cart_invalid_request" ||
      normalized.code === "cart_validation_failed" ||
      normalized.code === "cart_reference_invalid"
    ) {
      return emit(errorState("validation_error", fallbackCart, normalized));
    }

    if (normalized.code === "cart_conflict") {
      return emit(errorState("stock_conflict", fallbackCart, normalized));
    }

    return emit(errorState("backend_error", fallbackCart, normalized));
  }

  function clearLocalReference() {
    clearCartReference(options.storage);
    return emit(emptyState(null));
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restore,
    addItem,
    updateItem,
    removeItem,
    clearLocalReference,
  };
}

function stateFromCart(cart: StoreCart): GuestCartState {
  return {
    status: hasLineItems(cart) ? "ready" : "empty",
    operation: null,
    cart,
    error: null,
  };
}

function emptyState(error: GuestCartStateError | null): GuestCartState {
  return {
    status: "empty",
    operation: null,
    cart: null,
    error,
  };
}

function errorState(
  status: Exclude<GuestCartStatus, "idle" | "loading" | "empty" | "ready">,
  cart: StoreCart | null,
  error: GuestCartStateError
): GuestCartState {
  return {
    status,
    operation: null,
    cart,
    error,
  };
}

function hasLineItems(cart: StoreCart) {
  return Array.isArray(cart.items) && cart.items.length > 0;
}

function resolveCreateCartInput(options: GuestCartStateControllerOptions) {
  if (typeof options.createCartInput === "function") {
    return options.createCartInput();
  }
  return options.createCartInput ?? {};
}

function normalizeId(value: string, label: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return {
      ok: false as const,
      message: `A non-empty ${label} is required.`,
    };
  }
  return {
    ok: true as const,
    value: normalized,
  };
}

function normalizeQuantity(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return {
      ok: false as const,
      message: "Cart line quantity must be a positive integer.",
    };
  }
  return {
    ok: true as const,
    value,
  };
}

function validationError(message: string): GuestCartStateError {
  return {
    code: "cart_invalid_request",
    message,
    httpStatus: 400,
    recoverable: true,
  };
}

function normalizeError(error: unknown): GuestCartStateError {
  if (error instanceof CartClientError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: error.status,
      recoverable: true,
    };
  }

  if (error instanceof CartReferenceError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: null,
      recoverable: true,
    };
  }

  return {
    code: "cart_backend_unavailable",
    message: "The cart state could not be updated.",
    httpStatus: null,
    recoverable: true,
  };
}
