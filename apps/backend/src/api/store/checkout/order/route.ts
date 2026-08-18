import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { CheckoutDeliveryUnavailableError } from "../../../../workflows/checkout/validate-checkout";
import {
  CheckoutRequestError,
  CheckoutValidationError,
} from "../../../../checkout/validation";
import {
  PendingOrderError,
  PendingOrderRequestError,
} from "../../../../checkout/pending-order";
import { createPendingOrderWorkflow } from "../../../../workflows/checkout/create-pending-order";
import { StoreCheckoutError, customerActorId } from "../route";
import {
  parsePendingOrderIdempotencyKey,
  parseStorePendingOrderBody,
  type StorePendingOrderInput,
} from "./validators";

export async function POST(
  req: AuthenticatedMedusaRequest<StorePendingOrderInput>,
  res: MedusaResponse
) {
  try {
    const customerId = customerActorId(req as any);
    const body = parseStorePendingOrderBody(req.validatedBody ?? req.body);
    const header = req.headers["idempotency-key"];
    const idempotencyKey = parsePendingOrderIdempotencyKey(
      Array.isArray(header) ? header[0] : header
    );
    const { result } = await createPendingOrderWorkflow(req.scope).run({
      input: {
        customer_id: customerId,
        cart_id: body.cart_id,
        checkout: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          city: body.city,
          ...(body.address ? { address: body.address } : {}),
          ...(body.comment ? { comment: body.comment } : {}),
          delivery_method: body.delivery_method,
          payment_method: body.payment_method,
        },
        idempotency_key: idempotencyKey,
      },
    });

    res.status(result.replayed ? 200 : 201).json({
      order_id: result.order_id,
      status: result.status,
      expires_at: result.expires_at,
      payment_id: result.payment_id,
    });
  } catch (error) {
    sendPendingOrderError(res, error);
  }
}

export function toPublicPendingOrderError(error: unknown) {
  if (error instanceof PendingOrderRequestError) return error;
  if (error instanceof PendingOrderError) return error;

  if (error instanceof StoreCheckoutError) {
    return new PendingOrderError(
      error.statusCode,
      error.code === "checkout_auth_required"
        ? "checkout_auth_required"
        : "checkout_order_failed",
      error.message,
      error.details
    );
  }

  if (error instanceof CheckoutRequestError) {
    return new PendingOrderRequestError(error.message);
  }

  if (error instanceof CheckoutValidationError) {
    return new PendingOrderError(
      error.statusCode,
      "checkout_validation_failed",
      error.message,
      error.details
    );
  }

  if (error instanceof CheckoutDeliveryUnavailableError) {
    return new PendingOrderError(
      error.statusCode,
      "delivery_method_unavailable",
      error.message,
      error.details
    );
  }

  const nested = findNestedCheckoutError(error);
  if (nested) return nested;

  return new PendingOrderError(
    500,
    "checkout_order_failed",
    "Pending order creation failed."
  );
}

export function sendPendingOrderError(res: MedusaResponse, error: unknown) {
  const publicError = toPublicPendingOrderError(error);
  res.status(publicError.statusCode).json({
    error: {
      code: publicError.code,
      message: publicError.message,
      details: "details" in publicError ? publicError.details : {},
    },
  });
}

function findNestedCheckoutError(error: unknown): PendingOrderError | null {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (current instanceof PendingOrderError) return current;
    if (current instanceof PendingOrderRequestError) {
      return new PendingOrderError(
        current.statusCode,
        "checkout_invalid_request",
        current.message
      );
    }

    if (current instanceof CheckoutDeliveryUnavailableError) {
      return new PendingOrderError(
        current.statusCode,
        "delivery_method_unavailable",
        current.message,
        current.details
      );
    }

    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    if (isPendingOrderErrorCode(record.code)) {
      return new PendingOrderError(
        pendingOrderStatus(record.code),
        record.code,
        pendingOrderMessage(record.code),
        isRecord(record.details) ? record.details : {}
      );
    }
    if (record.code === "delivery_method_unavailable") {
      const details = isRecord(record.details) ? record.details : {};
      return new PendingOrderError(
        422,
        "delivery_method_unavailable",
        "Selected delivery method is unavailable.",
        details
      );
    }

    if (
      record.code === "INSUFFICIENT_INVENTORY" ||
      record.code === "insufficient_inventory"
    ) {
      return new PendingOrderError(
        409,
        "checkout_stock_conflict",
        "Current inventory cannot satisfy the cart."
      );
    }

    for (const key of ["cause", "error", "innerError", "originalError"]) {
      if (record[key]) queue.push(record[key]);
    }
    if (Array.isArray(record.errors)) queue.push(...record.errors);
  }

  return null;
}

function isPendingOrderErrorCode(
  value: unknown
): value is PendingOrderError["code"] {
  return (
    typeof value === "string" &&
    [
      "checkout_auth_required",
      "checkout_invalid_request",
      "checkout_validation_failed",
      "delivery_method_unavailable",
      "checkout_cart_forbidden",
      "checkout_cart_not_found",
      "checkout_idempotency_conflict",
      "checkout_stock_conflict",
      "checkout_order_failed",
    ].includes(value)
  );
}

function pendingOrderStatus(code: PendingOrderError["code"]): number {
  if (code === "checkout_auth_required") return 401;
  if (code === "checkout_invalid_request") return 400;
  if (code === "checkout_validation_failed") return 422;
  if (code === "delivery_method_unavailable") return 422;
  if (code === "checkout_cart_forbidden") return 403;
  if (code === "checkout_cart_not_found") return 404;
  if (code === "checkout_idempotency_conflict") return 409;
  if (code === "checkout_stock_conflict") return 409;
  return 500;
}

function pendingOrderMessage(code: PendingOrderError["code"]): string {
  if (code === "checkout_auth_required") {
    return "Authentication is required to continue checkout.";
  }
  if (code === "checkout_idempotency_conflict") {
    return "Idempotency key was already used for another checkout.";
  }
  if (code === "checkout_stock_conflict") {
    return "Current inventory cannot satisfy the cart.";
  }
  if (code === "delivery_method_unavailable") {
    return "Selected delivery method is unavailable.";
  }
  return "Pending order creation failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
