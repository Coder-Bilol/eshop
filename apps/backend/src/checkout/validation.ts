import {
  DELIVERY_OPTION_IDS,
  type DeliveryOptionId,
} from "./delivery-options";

export const PAYMENT_IDS = ["card", "sbp", "sberpay"] as const;

export type PaymentId = (typeof PAYMENT_IDS)[number];

export type StoreCheckoutInput = {
  name: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  comment?: string;
  delivery_method: DeliveryOptionId;
  payment_method: PaymentId;
};

export class CheckoutRequestError extends Error {
  readonly statusCode = 400;
  readonly code = "checkout_invalid_request" as const;

  constructor(message = "Checkout request is invalid.") {
    super(message);
    this.name = "CheckoutRequestError";
  }
}

export class CheckoutValidationError extends Error {
  readonly statusCode = 422;
  readonly code = "checkout_validation_failed" as const;

  constructor(
    message = "Checkout fields are invalid.",
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

const FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 32,
  city: 120,
  address: 240,
  comment: 500,
} as const;

const INPUT_FIELDS = new Set([
  "name",
  "email",
  "phone",
  "city",
  "address",
  "comment",
  "delivery_method",
  "payment_method",
]);

type RecordInput = Record<string, unknown>;

export function normalizeAndValidateCheckout(
  input: unknown
): StoreCheckoutInput {
  if (!isRecord(input)) {
    throw new CheckoutRequestError();
  }

  for (const key of Object.keys(input)) {
    if (!INPUT_FIELDS.has(key)) {
      throw new CheckoutRequestError();
    }
  }

  const name = requiredText(input.name, "name", FIELD_LIMITS.name);
  const email = requiredText(
    input.email,
    "email",
    FIELD_LIMITS.email,
    (value) => value.toLowerCase()
  );
  const phone = requiredText(input.phone, "phone", FIELD_LIMITS.phone);
  const city = requiredText(input.city, "city", FIELD_LIMITS.city);
  const deliveryMethod = selection(
    input.delivery_method,
    DELIVERY_OPTION_IDS,
    "delivery_method"
  );
  const paymentMethod = selection(input.payment_method, PAYMENT_IDS, "payment_method");
  const address = optionalText(input.address, "address", FIELD_LIMITS.address);
  const comment = optionalText(input.comment, "comment", FIELD_LIMITS.comment);

  if (deliveryMethod !== "pickup" && !address) {
    throw new CheckoutValidationError("Address is required for this delivery method.", {
      fields: { address: "required" },
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CheckoutValidationError("Email is invalid.", {
      fields: { email: "invalid" },
    });
  }

  return {
    name,
    email,
    phone,
    city,
    ...(address ? { address } : {}),
    ...(comment ? { comment } : {}),
    delivery_method: deliveryMethod,
    payment_method: paymentMethod,
  };
}

function requiredText(
  value: unknown,
  field: string,
  limit: number,
  transform: (value: string) => string = (normalized) => normalized
): string {
  if (typeof value !== "string") {
    throw fieldError(field, "required");
  }

  const normalized = transform(normalizeText(value));
  if (!normalized) {
    throw fieldError(field, "required");
  }
  assertSafeLength(normalized, field, limit);
  return normalized;
}

function optionalText(
  value: unknown,
  field: string,
  limit: number
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw fieldError(field, "invalid");
  }

  const normalized = normalizeText(value);
  if (!normalized) return undefined;
  assertSafeLength(normalized, field, limit);
  return normalized;
}

function selection<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] {
  const normalized = typeof value === "string" ? normalizeText(value) : "";
  if (!allowed.includes(normalized)) {
    throw fieldError(field, "unsupported");
  }

  return normalized as T[number];
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function assertSafeLength(value: string, field: string, limit: number) {
  if (value.length > limit) {
    throw fieldError(field, "too_long");
  }
}

function fieldError(field: string, reason: string): CheckoutValidationError {
  return new CheckoutValidationError("Checkout fields are invalid.", {
    fields: { [field]: reason },
  });
}

function isRecord(value: unknown): value is RecordInput {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
