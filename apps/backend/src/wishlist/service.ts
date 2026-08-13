import { WISHLIST_MODULE } from "../modules/wishlist";
import type WishlistModuleService from "../modules/wishlist/service";

const { loadCanonicalProducts } = require("../catalog/canonical");

type Scope = { resolve: (key: string) => unknown };

export type WishlistProductProjection = {
  id: string;
  handle: string;
  title: string;
  thumbnail: string | null;
  category: { handle: string; name: string };
  price: { amount: number; currency_code: string } | null;
  is_available: boolean;
};

export type WishlistItemResponse = {
  id: string;
  product_id: string;
  created_at: string;
  product: WishlistProductProjection;
};

export class WishlistProductNotFoundError extends Error {
  readonly code = "wishlist_product_not_found";

  constructor() {
    super("Wishlist product was not found.");
    this.name = "WishlistProductNotFoundError";
  }
}

export function isVisibleWishlistProduct(product: any): boolean {
  return product?.status === "published" && product?.category?.is_active === true;
}

export function projectWishlistProduct(product: any): WishlistProductProjection {
  if (!isVisibleWishlistProduct(product)) {
    throw new WishlistProductNotFoundError();
  }

  const validPrices = (product.variants || [])
    .map((variant: any) => variant.price)
    .filter(
      (price: any) =>
        Number.isInteger(price?.amount) && price.amount >= 0 && price.currency_code
    );
  const lowestPrice = validPrices.sort((left: any, right: any) =>
    left.amount - right.amount
  )[0];

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    thumbnail: product.media?.[0] || null,
    category: {
      handle: product.category.handle,
      name: product.category.name,
    },
    price: lowestPrice
      ? {
          amount: lowestPrice.amount,
          currency_code: String(lowestPrice.currency_code).toUpperCase(),
        }
      : null,
    is_available: (product.variants || []).some(
      (variant: any) => variant.availability?.is_sellable === true
    ),
  };
}

export async function loadWishlistProduct(
  scope: Scope,
  productId: string,
  salesChannelId: string
) {
  const products = await loadCanonicalProducts(scope, salesChannelId, {
    id: productId,
  });
  const product = products.find((candidate: any) => candidate.id === productId);
  if (!product) {
    throw new WishlistProductNotFoundError();
  }
  return projectWishlistProduct(product);
}

export async function listWishlistItemsWithProjection(input: {
  scope: Scope;
  customerId: string;
  salesChannelId: string;
}) {
  const service = input.scope.resolve(WISHLIST_MODULE) as WishlistModuleService;
  const rows = await service.listWishlistItems(
    { customer_id: input.customerId },
    { order: { created_at: "DESC", id: "ASC" } }
  );
  const result: WishlistItemResponse[] = [];

  for (const row of rows) {
    try {
      const product = await loadWishlistProduct(
        input.scope,
        row.product_id,
        input.salesChannelId
      );
      result.push(serializeWishlistItem(row, product));
    } catch (error) {
      if (error instanceof WishlistProductNotFoundError) continue;
      throw error;
    }
  }

  return result;
}

export async function addWishlistItem(input: {
  scope: Scope;
  customerId: string;
  productId: string;
  salesChannelId: string;
}) {
  const service = input.scope.resolve(WISHLIST_MODULE) as WishlistModuleService;
  const product = await loadWishlistProduct(
    input.scope,
    input.productId,
    input.salesChannelId
  );
  const existing = await service.listWishlistItems({
    customer_id: input.customerId,
    product_id: input.productId,
  });

  if (existing[0]) {
    return {
      item: serializeWishlistItem(existing[0], product),
      created: false,
    };
  }

  let row;
  try {
    row = await service.createWishlistItems({
      customer_id: input.customerId,
      product_id: input.productId,
    });
  } catch (error) {
    const concurrent = await service.listWishlistItems({
      customer_id: input.customerId,
      product_id: input.productId,
    });
    if (!concurrent[0]) throw error;
    return {
      item: serializeWishlistItem(concurrent[0], product),
      created: false,
    };
  }

  return {
    item: serializeWishlistItem(row, product),
    created: true,
  };
}

export async function removeWishlistItem(input: {
  scope: Scope;
  customerId: string;
  productId: string;
}) {
  const service = input.scope.resolve(WISHLIST_MODULE) as WishlistModuleService;
  const rows = await service.listWishlistItems({
    customer_id: input.customerId,
    product_id: input.productId,
  });
  if (!rows.length) {
    return { product_id: input.productId, removed: false };
  }

  await service.deleteWishlistItems(rows.map((row) => row.id));
  return { product_id: input.productId, removed: true };
}

export function serializeWishlistItem(
  row: { id: string; product_id: string; created_at: Date | string },
  product: WishlistProductProjection
): WishlistItemResponse {
  return {
    id: row.id,
    product_id: row.product_id,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    product,
  };
}
