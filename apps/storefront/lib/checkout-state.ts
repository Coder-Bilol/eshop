import {
  CheckoutClientError,
  DELIVERY_METHOD_IDS,
  PAYMENT_METHOD_IDS,
  createInitialCheckoutValues,
  normalizeCheckoutInput,
  safeErrorMessage,
  type CheckoutClientErrorCode,
  type CheckoutField,
  type CheckoutFormValues,
  type CheckoutValidationResult,
  type DeliveryMethodId,
  type DeliveryTariff,
  type PaymentMethodId,
  type StoreCheckoutClient,
} from "./checkout";

export type CheckoutStatus =
  | "checkout_blocked"
  | "checkout_editing"
  | "checkout_validating"
  | "checkout_validated"
  | "checkout_invalid"
  | "delivery_method_unavailable"
  | "checkout_failed";

export type CheckoutStateError = {
  code: CheckoutClientErrorCode | "checkout_validation_failed";
  message: string;
  httpStatus: number | null;
  recoverable: boolean;
  fields: Partial<Record<CheckoutField, string>>;
  deliveryMethod: DeliveryMethodId | null;
};

export type CheckoutState = {
  status: CheckoutStatus;
  values: CheckoutFormValues;
  tariffs: Partial<Record<DeliveryMethodId, DeliveryTariff>>;
  handoff: CheckoutValidationResult | null;
  error: CheckoutStateError | null;
};

export type CheckoutStateControllerOptions = {
  client: StoreCheckoutClient;
  initialValues?: Partial<CheckoutFormValues>;
};

export type CheckoutStateController = {
  getState(): CheckoutState;
  subscribe(listener: (state: CheckoutState) => void): () => void;
  setField(field: CheckoutField, value: string): CheckoutState;
  selectDeliveryMethod(method: DeliveryMethodId): CheckoutState;
  selectPaymentMethod(method: PaymentMethodId): CheckoutState;
  submit(): Promise<CheckoutState>;
  retry(): Promise<CheckoutState>;
};

export type CheckoutFormValidation =
  | { ok: true; input: ReturnType<typeof normalizeCheckoutInput> }
  | {
      ok: false;
      input: ReturnType<typeof normalizeCheckoutInput>;
      fields: Partial<Record<CheckoutField, string>>;
    };

export function validateCheckoutForm(
  values: CheckoutFormValues
): CheckoutFormValidation {
  const input = normalizeCheckoutInput(values);
  const fields: Partial<Record<CheckoutField, string>> = {};

  for (const field of ["name", "email", "phone", "city"] as const) {
    if (!input[field]) fields[field] = "required";
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    fields.email = "invalid";
  }
  if (!isDeliveryMethod(input.delivery_method)) {
    fields.delivery_method = "unsupported";
  } else if (input.delivery_method !== "pickup" && !input.address) {
    fields.address = "required";
  }
  if (!isPaymentMethod(input.payment_method)) {
    fields.payment_method = "unsupported";
  }

  return Object.keys(fields).length > 0
    ? { ok: false, input, fields }
    : { ok: true, input };
}

export function createCheckoutStateController(
  options: CheckoutStateControllerOptions
): CheckoutStateController {
  let state: CheckoutState = {
    status: "checkout_editing",
    values: {
      ...createInitialCheckoutValues(),
      ...options.initialValues,
    },
    tariffs: {},
    handoff: null,
    error: null,
  };
  let operation = 0;
  const listeners = new Set<(nextState: CheckoutState) => void>();

  function emit(nextState: CheckoutState) {
    state = nextState;
    for (const listener of listeners) listener(state);
    return state;
  }

  function editing(values: CheckoutFormValues) {
    return emit({
      ...state,
      status: "checkout_editing",
      values,
      handoff: null,
      error: null,
    });
  }

  function setField(field: CheckoutField, value: string) {
    if (field === "delivery_method" || field === "payment_method") {
      return state;
    }
    return editing({ ...state.values, [field]: value });
  }

  function selectDeliveryMethod(method: DeliveryMethodId) {
    if (!isDeliveryMethod(method)) return state;
    const values = {
      ...state.values,
      delivery_method: method,
      ...(method === "pickup" ? { address: "" } : {}),
    };
    return editing(values);
  }

  function selectPaymentMethod(method: PaymentMethodId) {
    if (!isPaymentMethod(method)) return state;
    return editing({ ...state.values, payment_method: method });
  }

  async function submit() {
    const validation = validateCheckoutForm(state.values);
    if (!validation.ok) {
      return emit({
        ...state,
        status: "checkout_invalid",
        values: valuesFromInput(validation.input, state.values),
        handoff: null,
        error: localValidationError(validation.fields),
      });
    }

    const currentOperation = ++operation;
    const values = valuesFromInput(validation.input, state.values);
    emit({
      ...state,
      status: "checkout_validating",
      values,
      handoff: null,
      error: null,
    });

    try {
      const result = await options.client.validate(validation.input);
      if (currentOperation !== operation) return state;
      return emit({
        ...state,
        status: "checkout_validated",
        values: valuesFromResult(result),
        tariffs: {
          ...state.tariffs,
          [result.snapshot.delivery_method]: result.snapshot.tariff,
        },
        handoff: result,
        error: null,
      });
    } catch (error) {
      if (currentOperation !== operation) return state;
      const normalized = normalizeStateError(error);
      return emit({
        ...state,
        status:
          normalized.code === "delivery_method_unavailable"
            ? "delivery_method_unavailable"
            : normalized.code === "checkout_validation_failed"
              ? "checkout_invalid"
              : "checkout_failed",
        values,
        handoff: null,
        error: normalized,
      });
    }
  }

  function retry() {
    if (
      state.status !== "delivery_method_unavailable" &&
      state.status !== "checkout_failed"
    ) {
      return Promise.resolve(state);
    }
    return submit();
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setField,
    selectDeliveryMethod,
    selectPaymentMethod,
    submit,
    retry,
  };
}

function localValidationError(
  fields: Partial<Record<CheckoutField, string>>
): CheckoutStateError {
  return {
    code: "checkout_validation_failed",
    message: "Check the highlighted checkout details.",
    httpStatus: 422,
    recoverable: true,
    fields,
    deliveryMethod: null,
  };
}

function normalizeStateError(error: unknown): CheckoutStateError {
  if (error instanceof CheckoutClientError) {
    return {
      code: error.code,
      message: safeErrorMessage(error.code),
      httpStatus: error.status,
      recoverable: true,
      fields: error.details.fields ?? {},
      deliveryMethod: error.details.delivery_method ?? null,
    };
  }
  return {
    code: "checkout_failed",
    message: safeErrorMessage("checkout_failed"),
    httpStatus: null,
    recoverable: true,
    fields: {},
    deliveryMethod: null,
  };
}

function valuesFromInput(
  input: ReturnType<typeof normalizeCheckoutInput>,
  previous: CheckoutFormValues
): CheckoutFormValues {
  return {
    ...previous,
    name: input.name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    address: input.address ?? "",
    comment: input.comment ?? "",
    delivery_method: input.delivery_method,
    payment_method: input.payment_method,
  };
}

function valuesFromResult(result: CheckoutValidationResult): CheckoutFormValues {
  return {
    name: result.snapshot.name,
    email: result.snapshot.email,
    phone: result.snapshot.phone,
    city: result.snapshot.city,
    address: result.snapshot.address ?? "",
    comment: result.snapshot.comment ?? "",
    delivery_method: result.snapshot.delivery_method,
    payment_method: result.payment_id,
  };
}

function isDeliveryMethod(value: unknown): value is DeliveryMethodId {
  return (
    typeof value === "string" &&
    (DELIVERY_METHOD_IDS as readonly string[]).includes(value)
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethodId {
  return (
    typeof value === "string" &&
    (PAYMENT_METHOD_IDS as readonly string[]).includes(value)
  );
}
