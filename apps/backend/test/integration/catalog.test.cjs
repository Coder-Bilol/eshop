const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..", "..");
const { queryCatalog } = require("../../src/catalog/query.ts");

async function run() {
  const seedOutput = execFileSync(process.execPath, ["scripts/db-seed.cjs"], {
    cwd: backendRoot,
    encoding: "utf8",
    env: process.env,
  });

  const base = await queryCatalog();
  assert.equal(base.products.length, 5);
  assert.equal(base.pagination.total, 5);
  assert.equal(base.empty, false);
  assert.ok(base.categories.some((category) => category.handle === "curtain-rods"));
  assert.ok(base.filters.available.category.some((category) => category.handle === "home-goods"));
  assert.ok(base.filters.available.color.includes("black"));
  assert.ok(base.filters.available.material.includes("wood"));
  assert.ok(base.filters.available.size_length.includes("160-300 cm"));
  assert.ok(base.filters.available.product_type.includes("curtain_rod"));
  assert.ok(base.filters.available.mounting_method.includes("wall"));
  assert.equal(base.products.some((product) => product.handle === "basic-home-hook-set"), true);
  assert.equal(Object.hasOwn(base.products[0], "id"), false);

  const category = await queryCatalog({ category: "curtain-rods" });
  assert.equal(category.products.length, 3);
  assert.equal(
    category.products.every((product) => product.category.handle === "curtain-rods"),
    true
  );
  assert.equal(category.filters.selected.category, "curtain-rods");

  const search = await queryCatalog({ q: "curtain" });
  assert.equal(search.products.length, 4);
  assert.equal(search.filters.selected.q, "curtain");

  const combined = await queryCatalog({
    q: "curtain",
    category: "curtain-rods",
    material: "wood",
  });
  assert.deepEqual(
    combined.products.map((product) => product.handle),
    ["wooden-classic-curtain-rod"]
  );

  const allVariantFilters = await queryCatalog({
    color: "black",
    material: "steel",
    size_length: "160-300 cm",
    product_type: "curtain_rod",
    mounting_method: "wall",
  });
  assert.deepEqual(
    allVariantFilters.products.map((product) => product.handle),
    ["steel-telescopic-curtain-rod"]
  );

  const priceRange = await queryCatalog({ price_min: "200000", price_max: "260000" });
  assert.deepEqual(
    priceRange.products.map((product) => product.handle),
    ["steel-telescopic-curtain-rod"]
  );

  const empty = await queryCatalog({ q: "no-such-product", color: "black" });
  assert.equal(empty.products.length, 0);
  assert.equal(empty.empty, true);
  assert.equal(empty.pagination.total, 0);

  const missingOptionalExcluded = await queryCatalog({ color: "black" });
  assert.equal(
    missingOptionalExcluded.products.some(
      (product) => product.handle === "basic-home-hook-set"
    ),
    false
  );

  const pageTwo = await queryCatalog({ page: "2", limit: "2" });
  assert.equal(pageTwo.products.length, 2);
  assert.equal(pageTwo.pagination.page, 2);
  assert.equal(pageTwo.pagination.limit, 2);
  assert.equal(pageTwo.pagination.total_pages, 3);
  assert.equal(pageTwo.pagination.has_next, true);
  assert.equal(pageTwo.pagination.has_prev, true);

  await assert.rejects(() => queryCatalog({ price_min: "x" }), /price_min/);

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "catalog",
        status: "ok",
        routeDecision: "thin read-only facade",
        sourceBoundary: "backend-postgresql",
        dockerRequired: false,
        productionData: false,
        seedCommandStatus: JSON.parse(seedOutput.slice(seedOutput.indexOf("{"))).status,
        assertions: [
          "category browse narrows products",
          "search narrows products",
          "combined search and filters narrow products",
          "all required MVP filters are supported",
          "empty result returns empty state without error",
          "missing optional attributes remain safe",
          "pagination metadata is returned",
          "malformed query is rejected before SQL execution",
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
