const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..", "..");
const {
  catalogCategoriesTable,
  catalogProductsTable,
  catalogVariantsTable,
  withBackendDb,
} = require("../../scripts/local-db.cjs");
const {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  productDetailInputFromMedusaRequest,
  queryProductDetail,
  queryProductDetailWithClient,
} = require("../../src/catalog/product-detail.ts");

async function run() {
  const seedOutput = execFileSync(process.execPath, ["scripts/db-seed.cjs"], {
    cwd: backendRoot,
    encoding: "utf8",
    env: process.env,
  });

  const configurable = await queryProductDetail({
    handle: "steel-telescopic-curtain-rod",
  });
  assert.equal(configurable.handle, "steel-telescopic-curtain-rod");
  assert.equal(configurable.title, "Steel telescopic curtain rod");
  assert.ok(Array.isArray(configurable.media));
  assert.equal(configurable.category.handle, "curtain-rods");
  assert.equal(configurable.product_type, "curtain_rod");
  assert.equal(Object.hasOwn(configurable, "id"), false);
  assert.equal(Object.hasOwn(configurable.variants[0], "id"), false);

  const dimensions = Object.fromEntries(
    configurable.option_dimensions.map((dimension) => [
      dimension.name,
      dimension.values,
    ])
  );
  assert.deepEqual(dimensions.color, ["black", "brass"]);
  assert.deepEqual(dimensions.material, ["aluminum", "steel"]);
  assert.deepEqual(dimensions.size_length, ["160-300 cm", "300-500 cm"]);
  assert.deepEqual(dimensions.mounting_method, ["wall"]);
  assert.equal(configurable.variants.length, 4);
  assert.equal(configurable.requires_selection, true);
  assert.equal(configurable.default_variant_sku, null);
  assert.equal(configurable.selected_variant_sku, null);
  assert.deepEqual(configurable.price_range, {
    min: 249000,
    max: 329000,
    currency_code: "RUB",
  });

  const unavailableVariant = configurable.variants.find(
    (variant) => variant.sku === "CR-STL-BRS-300-500"
  );
  assert.ok(unavailableVariant);
  assert.equal(unavailableVariant.availability.is_available, false);
  assert.equal(unavailableVariant.availability.is_sellable, false);
  assert.equal(unavailableVariant.availability.reason, "unavailable");
  assert.equal(unavailableVariant.options.color, "brass");
  assert.equal(unavailableVariant.options.size_length, "300-500 cm");

  const sellableVariant = configurable.variants.find(
    (variant) => variant.sku === "CR-STL-BLK-160-300"
  );
  assert.ok(sellableVariant);
  assert.equal(sellableVariant.availability.is_available, true);
  assert.equal(sellableVariant.availability.is_sellable, true);
  assert.equal(sellableVariant.availability.reason, null);
  assert.deepEqual(sellableVariant.price, {
    amount: 249000,
    currency_code: "RUB",
  });

  const defaultSku = await queryProductDetail({
    handle: "basic-home-hook-set",
  });
  assert.equal(defaultSku.requires_selection, false);
  assert.equal(defaultSku.variants.length, 1);
  assert.equal(defaultSku.default_variant_sku, "HG-HOOK-BASIC");
  assert.equal(defaultSku.selected_variant_sku, "HG-HOOK-BASIC");
  assert.deepEqual(defaultSku.price_range, {
    min: 59000,
    max: 59000,
    currency_code: "RUB",
  });

  await assert.rejects(
    () => queryProductDetail({ handle: "missing-product" }),
    (error) =>
      error instanceof ProductDetailNotFoundError &&
      error.code === "product_detail_not_found"
  );
  await assert.rejects(
    () => queryProductDetail({ handle: "" }),
    (error) =>
      error instanceof ProductDetailValidationError &&
      error.code === "product_detail_invalid_request"
  );

  assert.deepEqual(
    productDetailInputFromMedusaRequest({
      params: { handle: "steel-telescopic-curtain-rod" },
    }),
    { handle: "steel-telescopic-curtain-rod" }
  );
  assert.deepEqual(
    productDetailInputFromMedusaRequest({
      url: "/store/product-detail/basic-home-hook-set",
    }),
    { handle: "basic-home-hook-set" }
  );

  await withBackendDb(async (client) => {
    await client.query(
      `
        insert into ${catalogProductsTable} (
          id,
          handle,
          title,
          description,
          category_id,
          product_type,
          price_amount,
          currency_code,
          source
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update
          set handle = excluded.handle,
              title = excluded.title,
              description = excluded.description,
              category_id = excluded.category_id,
              product_type = excluded.product_type,
              price_amount = excluded.price_amount,
              currency_code = excluded.currency_code,
              source = excluded.source,
              updated_at = now()
      `,
      [
        "prod-multi-variant-one-sellable",
        "multi-variant-one-sellable",
        "Multi variant one sellable",
        "Regression fixture for explicit variant selection.",
        "cat-home-goods",
        "selection_fixture",
        1000,
        "RUB",
        "TASK-011-product-detail-test",
      ]
    );
    await client.query(
      `
        insert into ${catalogVariantsTable} (
          id,
          product_id,
          sku,
          title,
          color,
          price_amount,
          currency_code,
          is_active
        )
        values
          ($1, $2, $3, $4, $5, $6, $7, true),
          ($8, $9, $10, $11, $12, $13, $14, false)
        on conflict (id) do update
          set product_id = excluded.product_id,
              sku = excluded.sku,
              title = excluded.title,
              color = excluded.color,
              price_amount = excluded.price_amount,
              currency_code = excluded.currency_code,
              is_active = excluded.is_active,
              updated_at = now()
      `,
      [
        "var-multi-variant-one-sellable-active",
        "prod-multi-variant-one-sellable",
        "MULTI-ACTIVE",
        "Active",
        "black",
        1000,
        "RUB",
        "var-multi-variant-one-sellable-inactive",
        "prod-multi-variant-one-sellable",
        "MULTI-INACTIVE",
        "Inactive",
        "white",
        1200,
        "RUB",
      ]
    );

    try {
      const multiVariantOneSellable = await queryProductDetailWithClient(client, {
        handle: "multi-variant-one-sellable",
      });
      assert.equal(multiVariantOneSellable.variants.length, 2);
      assert.equal(
        multiVariantOneSellable.variants.filter(
          (variant) => variant.availability.is_sellable
        ).length,
        1
      );
      assert.equal(multiVariantOneSellable.requires_selection, true);
      assert.equal(multiVariantOneSellable.default_variant_sku, null);
      assert.equal(multiVariantOneSellable.selected_variant_sku, null);
    } finally {
      await client.query(
        `delete from ${catalogVariantsTable} where product_id = $1`,
        ["prod-multi-variant-one-sellable"]
      );
      await client.query(`delete from ${catalogProductsTable} where id = $1`, [
        "prod-multi-variant-one-sellable",
      ]);
    }

    await client.query(
      `
        insert into ${catalogCategoriesTable} (id, handle, name, is_active)
        values ($1, $2, $3, false)
        on conflict (id) do update
          set handle = excluded.handle,
              name = excluded.name,
              is_active = excluded.is_active,
              updated_at = now()
      `,
      ["cat-hidden-product-detail", "hidden-product-detail", "Hidden product detail"]
    );
    await client.query(
      `
        insert into ${catalogProductsTable} (
          id,
          handle,
          title,
          description,
          category_id,
          product_type,
          price_amount,
          currency_code,
          source
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update
          set handle = excluded.handle,
              title = excluded.title,
              description = excluded.description,
              category_id = excluded.category_id,
              product_type = excluded.product_type,
              price_amount = excluded.price_amount,
              currency_code = excluded.currency_code,
              source = excluded.source,
              updated_at = now()
      `,
      [
        "prod-hidden-product-detail",
        "hidden-product-detail",
        "Hidden product detail",
        "Unpublished fixture.",
        "cat-hidden-product-detail",
        "hidden_fixture",
        1000,
        "RUB",
        "TASK-011-product-detail-test",
      ]
    );
    await client.query(
      `
        insert into ${catalogVariantsTable} (
          id,
          product_id,
          sku,
          title,
          price_amount,
          currency_code
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (id) do update
          set product_id = excluded.product_id,
              sku = excluded.sku,
              title = excluded.title,
              price_amount = excluded.price_amount,
              currency_code = excluded.currency_code,
              updated_at = now()
      `,
      [
        "var-hidden-product-detail",
        "prod-hidden-product-detail",
        "HIDDEN-PRODUCT-DETAIL",
        "Hidden",
        1000,
        "RUB",
      ]
    );

    await assert.rejects(
      () => queryProductDetailWithClient(client, { handle: "hidden-product-detail" }),
      (error) =>
        error instanceof ProductDetailNotFoundError &&
        error.code === "product_detail_unpublished"
    );
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "product-detail",
        status: "ok",
        routeDecision: "thin read-only facade",
        sourceBoundary: "backend-postgresql",
        dockerRequired: false,
        productionData: false,
        seedCommandStatus: JSON.parse(seedOutput.slice(seedOutput.indexOf("{"))).status,
        assertions: [
          "product identity, media, category, and product type are returned",
          "internal product and variant database ids are not exposed",
          "option dimensions include color, material, size/length, and mounting method",
          "variant SKU, option combinations, price, and availability are returned",
          "unavailable variants are non-sellable",
          "single/default SKU products have deterministic default selection",
          "multi-variant products retain explicit selection when only one variant is sellable",
          "not-found and unpublished products are distinguished from valid detail responses",
          "request input can be read from dynamic route params or URL path",
        ],
      },
      null,
      2
    )}\n`
  );
}

module.exports = { run };

if (require.main === module) {
  run().catch((error) => {
    console.error(error && (error.stack || error.message) ? error.stack || error.message : error);
    process.exitCode = 1;
  });
}
