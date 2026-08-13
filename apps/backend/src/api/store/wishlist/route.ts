import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import {
  WishlistProductNotFoundError,
  listWishlistItemsWithProjection,
} from "../../../wishlist/service";
import {
  WishlistValidationError,
  parseStoreWishlistItemBody,
} from "./validators";

export type WishlistErrorCode =
  | "wishlist_auth_required"
  | "wishlist_invalid_request"
  | "wishlist_product_not_found"
  | "wishlist_operation_failed";

export class StoreWishlistError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: WishlistErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "StoreWishlistError";
  }
}

export function customerActorId(req: AuthenticatedMedusaRequest): string {
  const actorId = req.auth_context?.actor_id;
  if (typeof actorId !== "string" || actorId.trim().length === 0) {
    throw new StoreWishlistError(
      401,
      "wishlist_auth_required",
      "Authentication is required to use the wishlist."
    );
  }

  return actorId;
}

export function requestSalesChannelId(
  req: AuthenticatedMedusaRequest
): string {
  const salesChannelId = req.publishable_key_context?.sales_channel_ids?.[0];
  if (typeof salesChannelId !== "string" || salesChannelId.length === 0) {
    throw new StoreWishlistError(
      500,
      "wishlist_operation_failed",
      "Wishlist operation failed."
    );
  }

  return salesChannelId;
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const customerId = customerActorId(req);
    const items = await listWishlistItemsWithProjection({
      scope: req.scope,
      customerId,
      salesChannelId: requestSalesChannelId(req),
    });

    res.json({ items, count: items.length });
  } catch (error) {
    sendWishlistError(res, error);
  }
}

export function toPublicWishlistError(error: unknown): StoreWishlistError {
  if (error instanceof StoreWishlistError) {
    return error;
  }

  if (error instanceof WishlistProductNotFoundError) {
    return new StoreWishlistError(
      404,
      "wishlist_product_not_found",
      "Wishlist product was not found."
    );
  }

  if (error instanceof WishlistValidationError) {
    return new StoreWishlistError(
      error.statusCode,
      error.code,
      error.message
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "wishlist_product_not_found"
  ) {
    return new StoreWishlistError(
      404,
      "wishlist_product_not_found",
      "Wishlist product was not found."
    );
  }

  return new StoreWishlistError(
    500,
    "wishlist_operation_failed",
    "Wishlist operation failed."
  );
}

export function sendWishlistError(res: MedusaResponse, error: unknown) {
  const publicError = toPublicWishlistError(error);
  res.status(publicError.statusCode).json({
    error: {
      code: publicError.code,
      message: publicError.message,
      details: publicError.details,
    },
  });
}

export { parseStoreWishlistItemBody };
