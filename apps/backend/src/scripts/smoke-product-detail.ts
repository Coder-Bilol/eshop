import assert from "node:assert/strict";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

const { normalizeVariant } = require("../catalog/canonical");
const {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  productDetailInputFromMedusaRequest,
  queryProductDetail,
} = require("../catalog/product-detail");

export default async function smokeProductDetail({ container }: ExecArgs) {
  const salesChannelId = await defaultSalesChannelId(container);
  const configurable = await queryProductDetail(
    container,
    { handle: "steel-telescopic-curtain-rod" },
    [salesChannelId]
  );

  assert.equal(configurable.title, "Steel telescopic curtain rod");
  assert.deepEqual(configurable.media, [
    "/seed/steel-telescopic-curtain-rod.svg",
  ]);
  assert.equal(configurable.category.handle, "curtain-rods");
  assert.equal(configurable.product_type, "curtain_rod");
  assert.equal(configurable.variants.length, 4);
  assert.equal(configurable.requires_selection, true);
  assert.equal(configurable.default_variant_id, null);
  assert.equal(configurable.default_variant_sku, null);

  const dimensions = Object.fromEntries(
    configurable.option_dimensions.map(
      (dimension: { name: string; values: string[] }) => [
        dimension.name,
        dimension.values,
      ]
    )
  );
  assert.deepEqual(dimensions.color, ["black", "brass"]);
  assert.deepEqual(dimensions.material, ["aluminum", "steel"]);
  assert.deepEqual(dimensions.size_length, ["160-300 cm", "300-500 cm"]);
  assert.deepEqual(dimensions.mounting_method, ["wall"]);

  const unavailable = configurable.variants.find(
    (variant: { sku: string }) => variant.sku === "CR-STL-BRS-300-500"
  );
  assert.ok(unavailable.id.startsWith("variant_"));
  assert.equal(unavailable.availability.is_available, false);
  assert.equal(unavailable.availability.is_sellable, false);
  assert.equal(unavailable.availability.reason, "unavailable");

  const sellable = configurable.variants.find(
    (variant: { sku: string }) => variant.sku === "CR-STL-BLK-160-300"
  );
  assert.ok(sellable.id.startsWith("variant_"));
  assert.equal(sellable.availability.is_sellable, true);
  assert.deepEqual(sellable.price, {
    amount: 249000,
    currency_code: "RUB",
  });
  assert.deepEqual(configurable.price_range, {
    min: 249000,
    max: 329000,
    currency_code: "RUB",
  });

  const missingSku = normalizeVariant(
    {
      id: "variant_missing_sku",
      sku: null,
      title: "Missing SKU",
      manage_inventory: false,
      allow_backorder: false,
      options: [],
      prices: [{ amount: 1000, currency_code: "rub" }],
    },
    undefined
  );
  assert.equal(missingSku.sku, "");
  assert.equal(missingSku.availability.is_available, true);
  assert.equal(missingSku.availability.is_sellable, false);
  assert.equal(missingSku.availability.reason, "missing_sku");

  const defaultSku = await queryProductDetail(
    container,
    { handle: "basic-home-hook-set" },
    [salesChannelId]
  );
  assert.equal(defaultSku.requires_selection, false);
  assert.equal(defaultSku.variants.length, 1);
  assert.equal(defaultSku.default_variant_id, defaultSku.variants[0].id);
  assert.equal(defaultSku.default_variant_sku, "HG-HOOK-BASIC");

  await assert.rejects(
    () =>
      queryProductDetail(
        container,
        { handle: "missing-product" },
        [salesChannelId]
      ),
    (error: unknown) =>
      error instanceof ProductDetailNotFoundError &&
      (error as { code: string }).code === "product_detail_not_found"
  );
  await assert.rejects(
    () => queryProductDetail(container, { handle: "" }, [salesChannelId]),
    (error: unknown) =>
      error instanceof ProductDetailValidationError &&
      (error as { code: string }).code === "product_detail_invalid_request"
  );

  assert.deepEqual(
    productDetailInputFromMedusaRequest({
      params: { handle: "steel-telescopic-curtain-rod" },
    }),
    { handle: "steel-telescopic-curtain-rod" }
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "product-detail",
        status: "ok",
        sourceBoundary: "medusa-query-graph",
        variantCount: configurable.variants.length,
        salesChannelId,
      },
      null,
      2
    )}\n`
  );
}

async function defaultSalesChannelId(container: ExecArgs["container"]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: "Default Sales Channel" },
  });
  assert.ok(data[0]?.id, "Default Sales Channel is missing.");
  return data[0].id;
}
