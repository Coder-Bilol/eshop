const {
  catalogCategoriesTable,
  catalogProductsTable,
  catalogVariantsTable,
  ensureLocalCatalogSchema,
  ensureLocalSmokeSchema,
  formatError,
  printJson,
  seedKey,
  smokeTable,
  withBackendDb,
} = require("./local-db.cjs");
const { categories, products } = require("./catalog-fixtures.cjs");

async function seedCatalog(client) {
  await ensureLocalCatalogSchema(client);

  for (const category of categories) {
    await client.query(
      `
        insert into ${catalogCategoriesTable} (id, handle, name, parent_id)
        values ($1, $2, $3, $4)
        on conflict (id) do update
          set handle = excluded.handle,
              name = excluded.name,
              parent_id = excluded.parent_id,
              updated_at = now()
      `,
      [category.id, category.handle, category.name, category.parentId]
    );
  }

  for (const product of products) {
    await client.query(
      `
        insert into ${catalogProductsTable} (
          id,
          handle,
          title,
          description,
          category_id,
          product_type,
          color,
          material,
          size_length,
          mounting_method,
          price_amount,
          currency_code,
          source,
          has_optional_attribute_gap
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict (id) do update
          set handle = excluded.handle,
              title = excluded.title,
              description = excluded.description,
              category_id = excluded.category_id,
              product_type = excluded.product_type,
              color = excluded.color,
              material = excluded.material,
              size_length = excluded.size_length,
              mounting_method = excluded.mounting_method,
              price_amount = excluded.price_amount,
              currency_code = excluded.currency_code,
              source = excluded.source,
              has_optional_attribute_gap = excluded.has_optional_attribute_gap,
              updated_at = now()
      `,
      [
        product.id,
        product.handle,
        product.title,
        product.description,
        product.categoryId,
        product.productType,
        product.color,
        product.material,
        product.sizeLength,
        product.mountingMethod,
        product.priceAmount,
        product.currencyCode || "RUB",
        "TASK-005-local-catalog-seed",
        Boolean(product.hasOptionalAttributeGap),
      ]
    );

    for (const variant of product.variants) {
      await client.query(
        `
          insert into ${catalogVariantsTable} (
            id,
            product_id,
            sku,
            title,
            color,
            material,
            size_length,
            mounting_method,
            price_amount,
            currency_code,
            is_active
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          on conflict (id) do update
            set product_id = excluded.product_id,
                sku = excluded.sku,
                title = excluded.title,
                color = excluded.color,
                material = excluded.material,
                size_length = excluded.size_length,
                mounting_method = excluded.mounting_method,
                price_amount = excluded.price_amount,
                currency_code = excluded.currency_code,
                is_active = excluded.is_active,
                updated_at = now()
        `,
        [
          variant.id,
          product.id,
          variant.sku,
          variant.title,
          variant.color,
          variant.material,
          variant.sizeLength,
          variant.mountingMethod,
          variant.priceAmount,
          variant.currencyCode || product.currencyCode || "RUB",
          variant.isActive !== false,
        ]
      );
    }
  }
}

async function main() {
  await withBackendDb(async (client, context) => {
    await ensureLocalSmokeSchema(client);
    await seedCatalog(client);
    await client.query(
      `
        insert into ${smokeTable} (key, value, source)
        values ($1, $2, $3)
        on conflict (key) do update
          set value = excluded.value,
              source = excluded.source,
              updated_at = now()
      `,
      [
        seedKey,
        "local non-production seed for backend DB smoke verification",
        "TASK-002",
      ]
    );

    printJson({
      command: "db:seed",
      status: "ok",
      databaseUrl: context.redactedConnectionString,
      seedKey,
      table: smokeTable,
      catalog: {
        categories: categories.length,
        products: products.length,
        variants: products.reduce(
          (count, product) => count + product.variants.length,
          0
        ),
        tables: [
          catalogCategoriesTable,
          catalogProductsTable,
          catalogVariantsTable,
        ],
        includesCurtainRods: products.some(
          (product) => product.productType === "curtain_rod"
        ),
        optionalAttributeGapProducts: products.filter(
          (product) => product.hasOptionalAttributeGap
        ).length,
      },
      productionData: false,
    });
  });
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
