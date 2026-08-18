import {
  normalizeAndValidateCheckout,
  type StoreCheckoutInput,
} from "../../../../checkout/validation";
import {
  normalizeCartReference,
  normalizeIdempotencyKey,
  PendingOrderRequestError,
} from "../../../../checkout/pending-order";

export type StorePendingOrderInput = StoreCheckoutInput & {
  cart_id: string;
};

export function parseStorePendingOrderBody(body: unknown): StorePendingOrderInput {
  if (!isRecord(body)) {
    throw new PendingOrderRequestError();
  }

  const allowed = new Set([
    "cart_id",
    "name",
    "email",
    "phone",
    "city",
    "address",
    "comment",
    "delivery_method",
    "payment_method",
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new PendingOrderRequestError();
  }

  const cartId = normalizeCartReference(body.cart_id);
  const { cart_id: _cartId, ...checkoutBody } = body;
  return {
    cart_id: cartId,
    ...normalizeAndValidateCheckout(checkoutBody),
  };
}

export function parsePendingOrderIdempotencyKey(value: unknown): string {
  try {
    return normalizeIdempotencyKey(value);
  } catch {
    throw new PendingOrderRequestError("A valid Idempotency-Key header is required.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

