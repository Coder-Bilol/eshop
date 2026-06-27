const {
  catalogCategoriesTable,
  catalogProductsTable,
  catalogVariantsTable,
  ensureLocalCatalogSchema,
  formatError,
  printJson,
  withBackendDb,
} = require("./local-db.cjs");

async function requireCount(client, name, query, params, minimum) {
  const result = await client.query(query, params);
  const count = Number(result.rows[0].count);
  if (count < minimum) {
    throw new Error(`${name} expected at least ${minimum}, got ${count}.`);
  }
  return count;
}

async function main() {
  await withBackendDb(async (client, context) => {
    await ensureLocalCatalogSchema(client);

    const categoryCount = await requireCount(
      client,
      "categoryCount",
      `select count(*)::int as count from ${catalogCategoriesTable}`,
      [],
      3
    );
    const productCount = await requireCount(
      client,
      "productCount",
      `select count(*)::int as count from ${catalogProductsTable}`,
      [],
      5
    );
    const variantCount = await requireCount(
      client,
      "variantCount",
      `select count(*)::int as count from ${catalogVariantsTable}`,
      [],
      5
    );
    const curtainRodCount = await requireCount(
      client,
      "curtainRodCount",
      `
        select count(*)::int as count
        from ${catalogProductsTable} p
        join ${catalogCategoriesTable} c on c.id = p.category_id
        where c.handle = 'curtain-rods'
          and p.product_type = 'curtain_rod'
      `,
      [],
      2
    );

    const requiredFilterColumns = [
      "color",
      "material",
      "size_length",
      "product_type",
      "mounting_method",
    ];
    const filterCoverage = {};
    for (const column of requiredFilterColumns) {
      const result = await client.query(`
        select count(distinct ${column})::int as count
        from ${catalogProductsTable}
        where ${column} is not null and ${column} <> ''
      `);
      filterCoverage[column] = Number(result.rows[0].count);
      if (filterCoverage[column] < 1) {
        throw new Error(`Missing filter coverage for ${column}.`);
      }
    }

    const missingOptionalAttributes = await requireCount(
      client,
      "missingOptionalAttributes",
      `
        select count(*)::int as count
        from ${catalogProductsTable}
        where has_optional_attribute_gap = true
          and (color is null or material is null or size_length is null or mounting_method is null)
      `,
      [],
      1
    );

    const unfilteredRows = await client.query(`
      select id
      from ${catalogProductsTable}
      order by title asc
    `);
    const gapVisibleUnfiltered = unfilteredRows.rows.some(
      (row) => row.id === "prod-basic-home-hook-set"
    );
    if (!gapVisibleUnfiltered) {
      throw new Error(
        "Product with missing optional attributes is not visible in unfiltered listing."
      );
    }

    const searchResult = await client.query(
      `
        select count(*)::int as count
        from ${catalogProductsTable}
        where lower(title) like lower($1)
           or lower(description) like lower($1)
           or lower(handle) like lower($1)
      `,
      ["%curtain%"]
    );
    const searchMatches = Number(searchResult.rows[0].count);
    if (searchMatches < 3) {
      throw new Error(`Search smoke expected curtain matches, got ${searchMatches}.`);
    }

    const priceResult = await client.query(`
      select min(price_amount)::int as min_price, max(price_amount)::int as max_price
      from ${catalogProductsTable}
    `);

    printJson({
      command: "smoke:catalog",
      status: "ok",
      databaseUrl: context.redactedConnectionString,
      sourceBoundary: "backend-postgresql",
      dockerRequired: false,
      productionData: false,
      tables: [
        catalogCategoriesTable,
        catalogProductsTable,
        catalogVariantsTable,
      ],
      counts: {
        categories: categoryCount,
        products: productCount,
        variants: variantCount,
        curtainRodProducts: curtainRodCount,
        missingOptionalAttributeProducts: missingOptionalAttributes,
        searchMatches,
      },
      filterCoverage,
      priceRange: priceResult.rows[0],
      unfilteredListingIncludesMissingOptionalAttributes: gapVisibleUnfiltered,
    });
  });
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
