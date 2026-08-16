import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import {
  CheckoutRequestError,
  CheckoutValidationError,
} from "../../../checkout/validation";
import {
  CheckoutDeliveryUnavailableError,
  validateCheckoutWorkflow,
  type ValidateCheckoutResult,
} from "../../../workflows/checkout/validate-checkout";
import {
  parseStoreCheckoutBody,
  type StoreCheckoutInput,
} from "./validators";

type StoreCheckoutErrorCode =
  | "checkout_auth_required"
  | "checkout_invalid_request"
  | "checkout_validation_failed"
  | "delivery_method_unavailable"
  | "checkout_failed";

export class StoreCheckoutError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: StoreCheckoutErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "StoreCheckoutError";
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<StoreCheckoutInput>,
  res: MedusaResponse
) {
  try {
    const customerId = customerActorId(req);
    const checkout = parseStoreCheckoutBody(req.validatedBody ?? req.body);
    const { result } = await validateCheckoutWorkflow(req.scope).run({
      input: {
        customer_id: customerId,
        checkout,
      },
    });

    res.json(toPublicCheckoutResult(result));
  } catch (error) {
    sendCheckoutError(res, error);
  }
}

export function toPublicCheckoutResult(result: ValidateCheckoutResult) {
  const { customer_id: _customerId, ...snapshot } = result.snapshot;
  return {
    snapshot,
    payment_id: result.payment_id,
  };
}

export function customerActorId(
  req: AuthenticatedMedusaRequest<StoreCheckoutInput>
): string {
  const actorId = req.auth_context?.actor_id;
  const actorType = req.auth_context?.actor_type;
  if (
    typeof actorId !== "string" ||
    actorId.trim().length === 0 ||
    actorType !== "customer"
  ) {
    throw new StoreCheckoutError(
      401,
      "checkout_auth_required",
      "Authentication is required to continue checkout."
    );
  }

  return actorId;
}

export function toPublicCheckoutError(error: unknown): StoreCheckoutError {
  if (error instanceof StoreCheckoutError) return error;

  if (error instanceof CheckoutRequestError) {
    return new StoreCheckoutError(
      error.statusCode,
      error.code,
      error.message
    );
  }

  if (error instanceof CheckoutValidationError) {
    return new StoreCheckoutError(
      error.statusCode,
      error.code,
      error.message,
      error.details
    );
  }

  if (error instanceof CheckoutDeliveryUnavailableError) {
    return new StoreCheckoutError(
      error.statusCode,
      error.code,
      error.message,
      error.details
    );
  }

  const unavailable = findNestedUnavailable(error);
  if (unavailable) {
    return new StoreCheckoutError(
      422,
      "delivery_method_unavailable",
      "Selected delivery method is unavailable.",
      unavailable
    );
  }

  return new StoreCheckoutError(
    500,
    "checkout_failed",
    "Checkout validation failed."
  );
}

function findNestedUnavailable(error: unknown): Record<string, unknown> | null {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (current instanceof CheckoutDeliveryUnavailableError) {
      return current.details;
    }

    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    if (record.code === "delivery_method_unavailable") {
      const details = isRecord(record.details) ? record.details : {};
      const deliveryMethod = details.delivery_method;
      return typeof deliveryMethod === "string" &&
        ["pickup", "city_courier", "transport_company"].includes(
          deliveryMethod
        )
        ? { delivery_method: deliveryMethod }
        : {};
    }

    for (const key of ["cause", "error", "innerError", "originalError"]) {
      if (record[key]) queue.push(record[key]);
    }
    if (Array.isArray(record.errors)) queue.push(...record.errors);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sendCheckoutError(res: MedusaResponse, error: unknown) {
  const publicError = toPublicCheckoutError(error);
  res.status(publicError.statusCode).json({
    error: {
      code: publicError.code,
      message: publicError.message,
      details: publicError.details,
    },
  });
}
