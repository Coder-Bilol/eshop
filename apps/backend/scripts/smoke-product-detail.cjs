const {
  catalogProductsTable,
  catalogVariantsTable,
  ensureLocalCatalogSchema,
  formatError,
  printJson,
  withBackendDb,
} = require("./local-db.cjs");

function parseJsonAgg(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

function uniquePresent(values) {
  return Array.from(
    new Set(
      values
        .filter((value) => value !== null && value !== undefined)
        .map((value) => String(value))
        .filter((value) => value.length > 0)
    )
  ).sort();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadProductDetail(client, handle) {
  const result = await client.query(
    `
      select
        p.handle,
        p.title,
        p.description,
        p.product_type,
        p.currency_code,
        json_agg(
          json_build_object(
            'sku', v.sku,
            'title', v.title,
            'is_active', v.is_active,
            'price', json_build_object(
              'amount', v.price_amount,
              'currency_code', v.currency_code
            ),
            'attributes', json_build_object(
              'color', v.color,
              'material', v.material,
              'size_length', v.size_length,
              'mounting_method', v.mounting_method
            )
          )
          order by v.title asc
        ) as variants
      from ${catalogProductsTable} p
      join ${catalogVariantsTable} v on v.product_id = p.id
      where p.handle = $1
      group by p.id
    `,
    [handle]
  );

  return result.rows[0] || null;
}

function optionDimensionSummary(variants) {
  return {
    color: uniquePresent(variants.map((variant) => variant.attributes.color)),
    material: uniquePresent(variants.map((variant) => variant.attributes.material)),
    size_length: uniquePresent(
      variants.map((variant) => variant.attributes.size_length)
    ),
    mounting_method: uniquePresent(
      variants.map((variant) => variant.attributes.mounting_method)
    ),
  };
}

async function main() {
  await withBackendDb(async (client, context) => {
    await ensureLocalCatalogSchema(client);

    const configurable = await loadProductDetail(
      client,
      "steel-telescopic-curtain-rod"
    );
    const defaultSku = await loadProductDetail(client, "basic-home-hook-set");

    assert(configurable, "Configurable product detail seed is missing.");
    assert(defaultSku, "Default SKU product detail seed is missing.");

    const configurableVariants = parseJsonAgg(configurable.variants);
    const defaultSkuVariants = parseJsonAgg(defaultSku.variants);
    const optionDimensions = optionDimensionSummary(configurableVariants);
    const unavailableVariants = configurableVariants.filter(
      (variant) => variant.is_active === false
    );
    const sellableVariants = configurableVariants.filter(
      (variant) => variant.is_active === true
    );

    assert(
      configurableVariants.length >= 4,
      `Configurable product expected at least 4 variants, got ${configurableVariants.length}.`
    );
    assert(optionDimensions.color.length >= 2, "Color option dimension is incomplete.");
    assert(
      optionDimensions.material.length >= 2,
      "Material option dimension is incomplete."
    );
    assert(
      optionDimensions.size_length.length >= 2,
      "Size/length option dimension is incomplete."
    );
    assert(
      optionDimensions.mounting_method.includes("wall"),
      "Mounting method related attribute is missing."
    );
    assert(
      unavailableVariants.length >= 1,
      "Expected at least one unavailable/out-of-stock variant."
    );
    assert(sellableVariants.length >= 1, "Expected at least one sellable variant.");
    assert(
      configurableVariants.every(
        (variant) =>
          variant.sku &&
          variant.price &&
          Number.isInteger(Number(variant.price.amount)) &&
          variant.price.amount >= 0 &&
          typeof variant.is_active === "boolean"
      ),
      "Each variant must expose SKU, non-negative price, and availability signal."
    );
    assert(
      defaultSkuVariants.length === 1 &&
        defaultSkuVariants[0].title === "Default" &&
        defaultSkuVariants[0].is_active === true,
      "Default SKU product must have one active default variant."
    );

    printJson({
      command: "smoke:product-detail",
      status: "ok",
      databaseUrl: context.redactedConnectionString,
      sourceBoundary: "backend-postgresql",
      dockerRequired: false,
      productionData: false,
      routeDecision: "seeded backend detail data for future thin read-only facade",
      configurableProduct: {
        handle: configurable.handle,
        variantCount: configurableVariants.length,
        sellableVariantSkus: sellableVariants.map((variant) => variant.sku),
        unavailableVariantSkus: unavailableVariants.map((variant) => variant.sku),
        optionDimensions,
      },
      defaultSkuProduct: {
        handle: defaultSku.handle,
        sku: defaultSkuVariants[0].sku,
        title: defaultSkuVariants[0].title,
      },
      assertions: [
        "multi-option product detail seed is present",
        "color, material, size/length, and mounting method data are readable",
        "unavailable variant is readable through backend persistence",
        "single/default SKU product is readable through backend persistence",
        "variant SKU, price, and availability signals are present",
      ],
    });
  });
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
