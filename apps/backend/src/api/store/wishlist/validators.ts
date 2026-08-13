import { z } from "@medusajs/framework/zod";

export const StoreWishlistItem = z
  .object({
    product_id: z.string().trim().min(1).max(255),
  })
  .strict();

const WishlistProductId = z.string().trim().min(1).max(255);

export type StoreWishlistItemType = z.infer<typeof StoreWishlistItem>;

export class WishlistValidationError extends Error {
  readonly code = "wishlist_invalid_request";
  readonly statusCode = 400;

  constructor(message = "Wishlist request is invalid.") {
    super(message);
    this.name = "WishlistValidationError";
  }
}

export function parseStoreWishlistItemBody(
  body: unknown
): StoreWishlistItemType {
  const parsed = StoreWishlistItem.safeParse(body ?? {});
  if (!parsed.success) {
    throw new WishlistValidationError("Product ID is required.");
  }

  return parsed.data;
}

export function parseWishlistProductId(value: unknown): string {
  const parsed = WishlistProductId.safeParse(value);
  if (!parsed.success) {
    throw new WishlistValidationError("Product ID is required.");
  }

  return parsed.data;
}
