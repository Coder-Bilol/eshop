export const DELIVERY_METHOD_IDS = [
  "pickup",
  "city_courier",
  "transport_company",
] as const;

export type DeliveryMethodId = (typeof DELIVERY_METHOD_IDS)[number];

export const PAYMENT_METHOD_IDS = ["card", "sbp", "sberpay"] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethodId, string> = {
  pickup: "Pickup",
  city_courier: "City courier",
  transport_company: "Transport company",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  card: "Bank card",
  sbp: "SBP",
  sberpay: "SberPay",
};

export type CheckoutFormValues = {
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  comment: string;
  delivery_method: DeliveryMethodId;
  payment_method: PaymentMethodId;
};

export type StoreCheckoutInput = Omit<
  CheckoutFormValues,
  "address" | "comment"
> & {
  address?: string;
  comment?: string;
};

export type DeliveryTariff = {
  amount: number;
  currency_code: string;
};

export type ValidatedCheckoutSnapshot = {
  name: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  comment?: string;
  delivery_method: DeliveryMethodId;
  tariff: DeliveryTariff;
};

export type CheckoutValidationResult = {
  snapshot: ValidatedCheckoutSnapshot;
  payment_id: PaymentMethodId;
};

export type CheckoutField =
  | "name"
  | "email"
  | "phone"
  | "city"
  | "address"
  | "comment"
  | "delivery_method"
  | "payment_method";

export type CheckoutErrorDetails = {
  fields?: Partial<Record<CheckoutField, string>>;
  delivery_method?: DeliveryMethodId;
};

export type CheckoutClientErrorCode =
  | "checkout_auth_required"
  | "checkout_invalid_request"
  | "checkout_validation_failed"
  | "delivery_method_unavailable"
  | "checkout_failed"
  | "checkout_network_error"
  | "checkout_invalid_response"
  | "checkout_publishable_key_missing";

export class CheckoutClientError extends Error {
  readonly code: CheckoutClientErrorCode;
  readonly status: number | null;
  readonly details: CheckoutErrorDetails;

  constructor(
    code: CheckoutClientErrorCode,
    message: string,
    status: number | null = null,
    details: CheckoutErrorDetails = {}
  ) {
    super(message);
    this.name = "CheckoutClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type StoreCheckoutClient = {
  validate(input: StoreCheckoutInput): Promise<CheckoutValidationResult>;
};

export type StoreCheckoutClientOptions = {
  baseUrl?: string;
  publishableApiKey?: string;
  fetchImplementation?: typeof fetch;
};

const DEFAULT_BACKEND_URL = "http://localhost:9000";

export function createInitialCheckoutValues(): CheckoutFormValues {
  return {
    name: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    comment: "",
    delivery_method: "pickup",
    payment_method: "card",
  };
}

export function normalizeCheckoutInput(
  input: CheckoutFormValues | StoreCheckoutInput
): StoreCheckoutInput {
  const normalized: StoreCheckoutInput = {
    name: normalizeText(input.name),
    email: normalizeText(input.email).toLowerCase(),
    phone: normalizeText(input.phone),
    city: normalizeText(input.city),
    delivery_method: normalizeSelection(input.delivery_method) as DeliveryMethodId,
    payment_method: normalizeSelection(input.payment_method) as PaymentMethodId,
  };

  const address = normalizeText(input.address);
  const comment = normalizeText(input.comment);
  if (address) normalized.address = address;
  if (comment) normalized.comment = comment;
  return normalized;
}

export function createStoreCheckoutClient(
  options: StoreCheckoutClientOptions = {}
): StoreCheckoutClient {
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
    throw new CheckoutClientError(
      "checkout_publishable_key_missing",
      "Checkout configuration is incomplete."
    );
  }
  if (typeof fetchImplementation !== "function") {
    throw new CheckoutClientError(
      "checkout_network_error",
      "Checkout service could not be reached."
    );
  }

  return {
    async validate(input) {
      const requestInput = normalizeCheckoutInput(input);
      let response: Response;
      try {
        response = await fetchImplementation(`${baseUrl}/store/checkout`, {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-publishable-api-key": publishableApiKey,
          },
          body: JSON.stringify(requestInput),
        });
      } catch {
        throw new CheckoutClientError(
          "checkout_network_error",
          "Checkout service could not be reached."
        );
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw checkoutErrorFromResponse(response.status, payload);
      }

      const result = readCheckoutValidationResult(payload);
      if (!result) {
        throw new CheckoutClientError(
          "checkout_invalid_response",
          "Checkout service returned an invalid response.",
          502
        );
      }
      return result;
    },
  };
}

export function checkoutErrorFromResponse(
  status: number,
  payload: unknown
): CheckoutClientError {
  const envelope = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const code = knownErrorCode(envelope?.code) ?? fallbackErrorCode(status);
  const details = readCheckoutErrorDetails(envelope?.details);
  return new CheckoutClientError(
    code,
    safeErrorMessage(code),
    status,
    details
  );
}

export function safeErrorMessage(code: CheckoutClientErrorCode): string {
  switch (code) {
    case "checkout_auth_required":
      return "Your session could not be confirmed. Sign in again to continue.";
    case "checkout_invalid_request":
      return "Checkout request is invalid. Check the details and try again.";
    case "checkout_validation_failed":
      return "Check the highlighted checkout details.";
    case "delivery_method_unavailable":
      return "This delivery method is currently unavailable. Retry or choose another method.";
    case "checkout_network_error":
      return "Checkout service could not be reached. Try again.";
    case "checkout_invalid_response":
      return "Checkout service returned an invalid response. Try again.";
    case "checkout_publishable_key_missing":
      return "Checkout is temporarily unavailable. Try again later.";
    case "checkout_failed":
    default:
      return "Checkout details could not be validated. Try again.";
  }
}

function readCheckoutValidationResult(
  payload: unknown
): CheckoutValidationResult | null {
  if (!isRecord(payload) || !isRecord(payload.snapshot)) return null;
  const snapshot = payload.snapshot;
  const deliveryMethod = readDeliveryMethod(snapshot.delivery_method);
  const paymentId = readPaymentMethod(payload.payment_id);
  const tariff = readTariff(snapshot.tariff);
  const name = readNonEmptyString(snapshot.name);
  const email = readNonEmptyString(snapshot.email);
  const phone = readNonEmptyString(snapshot.phone);
  const city = readNonEmptyString(snapshot.city);
  if (!deliveryMethod || !paymentId || !tariff || !name || !email || !phone || !city) {
    return null;
  }

  const address = readOptionalString(snapshot.address);
  const comment = readOptionalString(snapshot.comment);
  return {
    snapshot: {
      name,
      email,
      phone,
      city,
      ...(address ? { address } : {}),
      ...(comment ? { comment } : {}),
      delivery_method: deliveryMethod,
      tariff,
    },
    payment_id: paymentId,
  };
}

function readTariff(value: unknown): DeliveryTariff | null {
  if (!isRecord(value)) return null;
  const amount = value.amount;
  const currency = value.currency_code;
  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    typeof currency !== "string" ||
    currency.trim().toUpperCase() !== "RUB"
  ) {
    return null;
  }
  return { amount, currency_code: "RUB" };
}

function readCheckoutErrorDetails(value: unknown): CheckoutErrorDetails {
  if (!isRecord(value)) return {};
  const details: CheckoutErrorDetails = {};
  if (isRecord(value.fields)) {
    const fields: Partial<Record<CheckoutField, string>> = {};
    for (const field of [
      "name",
      "email",
      "phone",
      "city",
      "address",
      "comment",
      "delivery_method",
      "payment_method",
    ] as const) {
      const reason = value.fields[field];
      if (
        typeof reason === "string" &&
        ["required", "invalid", "too_long", "unsupported"].includes(reason)
      ) {
        fields[field] = reason;
      }
    }
    if (Object.keys(fields).length > 0) details.fields = fields;
  }
  const deliveryMethod = readDeliveryMethod(value.delivery_method);
  if (deliveryMethod) details.delivery_method = deliveryMethod;
  return details;
}

function fallbackErrorCode(status: number): CheckoutClientErrorCode {
  if (status === 401) return "checkout_auth_required";
  if (status === 400) return "checkout_invalid_request";
  if (status === 422) return "checkout_validation_failed";
  return "checkout_failed";
}

function knownErrorCode(value: unknown): CheckoutClientErrorCode | null {
  return typeof value === "string" &&
    [
      "checkout_auth_required",
      "checkout_invalid_request",
      "checkout_validation_failed",
      "delivery_method_unavailable",
      "checkout_failed",
    ].includes(value)
    ? (value as CheckoutClientErrorCode)
    : null;
}

function readDeliveryMethod(value: unknown): DeliveryMethodId | null {
  return isDeliveryMethod(value) ? value : null;
}

function readPaymentMethod(value: unknown): PaymentMethodId | null {
  return isPaymentMethod(value) ? value : null;
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

function normalizeSelection(value: unknown) {
  return typeof value === "string" ? normalizeText(value) : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/gu, " ").trim()
    : "";
}

function readNonEmptyString(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function readOptionalString(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
