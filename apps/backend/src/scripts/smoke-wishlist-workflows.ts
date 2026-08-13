import assert from "node:assert/strict";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { WISHLIST_MODULE } from "../modules/wishlist";
import { addWishlistItemWorkflow } from "../workflows/wishlist/add-wishlist-item";
import { removeWishlistItemWorkflow } from "../workflows/wishlist/remove-wishlist-item";
import {
  isVisibleWishlistProduct,
  listWishlistItemsWithProjection,
  projectWishlistProduct,
} from "../wishlist/service";

const { loadCanonicalProducts } = require("../catalog/canonical");

const customerId = "cus_task037_synthetic";

export default async function smokeWishlistWorkflows({
  container,
}: ExecArgs) {
  await cleanup(container, customerId);
  const salesChannelId = await defaultSalesChannelId(container);
  const products = await loadCanonicalProducts(container, salesChannelId);
  const visible = products.find(
    (product: any) => product.handle === "steel-telescopic-curtain-rod"
  );
  assert.ok(visible?.id, "Seeded visible product is missing.");

  const first = await addWishlistItemWorkflow(container).run({
    input: {
      customer_id: customerId,
      product_id: visible.id,
      sales_channel_id: salesChannelId,
    },
  });
  assert.equal(first.result.created, true);
  assert.equal(first.result.item.product.id, visible.id);
  assert.equal(first.result.item.product.handle, visible.handle);
  assert.equal(first.result.item.product.category.handle, "curtain-rods");
  assert.ok(first.result.item.product.price);
  assert.equal(first.result.item.product.price.currency_code, "RUB");
  assert.equal(typeof first.result.item.product.is_available, "boolean");

  const duplicate = await addWishlistItemWorkflow(container).run({
    input: {
      customer_id: customerId,
      product_id: visible.id,
      sales_channel_id: salesChannelId,
    },
  });
  assert.equal(duplicate.result.created, false);
  assert.deepEqual(duplicate.result.item.product, first.result.item.product);

  const concurrent = await Promise.all([
    addWishlistItemWorkflow(container).run({
      input: {
        customer_id: customerId,
        product_id: visible.id,
        sales_channel_id: salesChannelId,
      },
    }),
    addWishlistItemWorkflow(container).run({
      input: {
        customer_id: customerId,
        product_id: visible.id,
        sales_channel_id: salesChannelId,
      },
    }),
  ]);
  assert.equal(concurrent.filter((entry) => entry.result.created).length, 0);

  const listed = await listWishlistItemsWithProjection({
    scope: container,
    customerId,
    salesChannelId,
  });
  assert.equal(listed.length, 1);
  assert.deepEqual(listed[0], first.result.item);

  const service = container.resolve(WISHLIST_MODULE) as any;
  await service.createWishlistItems({
    customer_id: customerId,
    product_id: "prod_missing_task037",
  });
  const hiddenOnly = await listWishlistItemsWithProjection({
    scope: container,
    customerId,
    salesChannelId,
  });
  assert.equal(hiddenOnly.length, 1);
  assert.equal(hiddenOnly[0].product_id, visible.id);

  const removed = await removeWishlistItemWorkflow(container).run({
    input: { customer_id: customerId, product_id: visible.id },
  });
  assert.deepEqual(removed.result, {
    product_id: visible.id,
    removed: true,
  });
  const repeatedRemove = await removeWishlistItemWorkflow(container).run({
    input: { customer_id: customerId, product_id: visible.id },
  });
  assert.deepEqual(repeatedRemove.result, {
    product_id: visible.id,
    removed: false,
  });

  await assert.rejects(() =>
    addWishlistItemWorkflow(container).run({
      input: {
        customer_id: customerId,
        product_id: "prod_missing_task037",
        sales_channel_id: salesChannelId,
      },
    })
  );

  const fixture = (overrides: Record<string, unknown> = {}) => ({
    id: "prod_fixture_projection",
    handle: "fixture-projection",
    title: "Fixture projection",
    media: ["/fixture.png"],
    status: "published",
    category: { handle: "curtain-rods", name: "Curtain rods", is_active: true },
    variants: [
      {
        price: { amount: 2500, currency_code: "rub" },
        availability: { is_sellable: false },
      },
      {
        price: { amount: 1500, currency_code: "rub" },
        availability: { is_sellable: true },
      },
    ],
    ...overrides,
  });
  const projection = projectWishlistProduct(fixture());
  assert.deepEqual(projection.price, { amount: 1500, currency_code: "RUB" });
  assert.equal(projection.thumbnail, "/fixture.png");
  assert.equal(projection.is_available, true);

  for (const hidden of [
    fixture({ status: "draft" }),
    fixture({ category: { handle: "hidden", name: "Hidden", is_active: false } }),
    fixture({ category: null }),
  ]) {
    assert.equal(isVisibleWishlistProduct(hidden), false);
    assert.throws(() => projectWishlistProduct(hidden), /not found/i);
  }

  const outOfStock = projectWishlistProduct(
    fixture({
      variants: [
        {
          price: { amount: 1000, currency_code: "rub" },
          availability: { is_sellable: false },
        },
      ],
    })
  );
  assert.equal(outOfStock.is_available, false);
  assert.deepEqual(outOfStock.price, { amount: 1000, currency_code: "RUB" });

  await cleanup(container, customerId);
  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-workflows",
        status: "ok",
        sourceBoundary: "wishlist-module-query-graph",
        createdDuplicateAndConcurrent: true,
        exactProjection: true,
        hiddenProductsOmitted: true,
        outOfStockVisibleUnavailable: true,
        productionData: false,
      },
      null,
      2
    )}\n`
  );
}

async function cleanup(container: ExecArgs["container"], customer: string) {
  const service = container.resolve(WISHLIST_MODULE) as any;
  const rows = await service.listWishlistItems({ customer_id: customer });
  if (rows.length) await service.deleteWishlistItems(rows.map((row: any) => row.id));
}

async function defaultSalesChannelId(container: ExecArgs["container"]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: "Default Sales Channel" },
  });
  assert.ok(data[0]?.id, "Default Sales Channel is missing.");
  return data[0].id as string;
}
