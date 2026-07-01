import assert from "node:assert/strict";
import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

const { queryCatalog } = require("../catalog/query");

export default async function smokeCatalog({ container }: ExecArgs) {
  const salesChannelId = await defaultSalesChannelId(container);
  const base = await queryCatalog(container, {}, [salesChannelId]);

  assert.equal(base.products.length, 5);
  assert.equal(base.pagination.total, 5);
  assert.equal(base.empty, false);
  assert.ok(
    base.categories.some(
      (category: { handle: string }) => category.handle === "curtain-rods"
    )
  );
  assert.ok(base.filters.available.color.includes("black"));
  assert.ok(base.filters.available.material.includes("wood"));
  assert.ok(base.filters.available.size_length.includes("160-300 cm"));
  assert.ok(base.filters.available.product_type.includes("curtain_rod"));
  assert.ok(base.filters.available.mounting_method.includes("wall"));
  assert.equal(
    base.products.some(
      (product: { handle: string }) =>
        product.handle === "basic-home-hook-set"
    ),
    true
  );
  assert.ok(
    base.products.every((product: { variants: Array<{ id: string }> }) =>
      product.variants.every((variant) => variant.id.startsWith("variant_"))
    )
  );

  const category = await queryCatalog(
    container,
    { category: "curtain-rods" },
    [salesChannelId]
  );
  assert.equal(category.products.length, 3);

  const search = await queryCatalog(container, { q: "curtain" }, [
    salesChannelId,
  ]);
  assert.equal(search.products.length, 4);

  const combined = await queryCatalog(
    container,
    {
      q: "curtain",
      category: "curtain-rods",
      material: "wood",
    },
    [salesChannelId]
  );
  assert.deepEqual(
    combined.products.map((product: { handle: string }) => product.handle),
    ["wooden-classic-curtain-rod"]
  );

  const allVariantFilters = await queryCatalog(
    container,
    {
      color: "black",
      material: "steel",
      size_length: "160-300 cm",
      product_type: "curtain_rod",
      mounting_method: "wall",
    },
    [salesChannelId]
  );
  assert.deepEqual(
    allVariantFilters.products.map(
      (product: { handle: string }) => product.handle
    ),
    ["steel-telescopic-curtain-rod"]
  );

  const priceRange = await queryCatalog(
    container,
    { price_min: "200000", price_max: "260000" },
    [salesChannelId]
  );
  assert.deepEqual(
    priceRange.products.map(
      (product: { handle: string }) => product.handle
    ),
    ["steel-telescopic-curtain-rod"]
  );

  const empty = await queryCatalog(
    container,
    { q: "no-such-product", color: "black" },
    [salesChannelId]
  );
  assert.equal(empty.products.length, 0);
  assert.equal(empty.empty, true);

  const pageTwo = await queryCatalog(
    container,
    { page: "2", limit: "2" },
    [salesChannelId]
  );
  assert.equal(pageTwo.products.length, 2);
  assert.equal(pageTwo.pagination.total_pages, 3);
  assert.equal(pageTwo.pagination.has_next, true);
  assert.equal(pageTwo.pagination.has_prev, true);

  await assert.rejects(
    () => queryCatalog(container, { price_min: "x" }, [salesChannelId]),
    /price_min/
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "catalog",
        status: "ok",
        sourceBoundary: "medusa-query-graph",
        productCount: base.products.length,
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
