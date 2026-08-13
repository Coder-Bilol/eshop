import assert from "node:assert/strict";

import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows";

const fixturePrefix = "task038-route-matrix-";

type FixtureIds = {
  products: Record<string, string>;
  handles: Record<string, string>;
  categories: string[];
};

type GraphQuery = {
  graph: (input: Record<string, unknown>) => Promise<{ data: any[] }>;
};

export default async function routeLevelFixtures({ container }: ExecArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("TASK-038 route fixtures are local-only.");
  }

  const phase = process.env.TASK038_ROUTE_MATRIX_PHASE;
  if (phase === "setup") {
    const fixtures = await setupFixtures(container);
    process.stdout.write(
      `TASK038_ROUTE_MATRIX_FIXTURES=${JSON.stringify(fixtures)}\n`
    );
    return;
  }

  if (phase === "cleanup") {
    await cleanupFixtures(container, parseFixtureIds());
    process.stdout.write("TASK038_ROUTE_MATRIX_CLEANUP=ok\n");
    return;
  }

  throw new Error("TASK038_ROUTE_MATRIX_PHASE must be setup or cleanup.");
}

async function setupFixtures(container: ExecArgs["container"]): Promise<FixtureIds> {
  await cleanupFixtures(container);

  const query = container.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as GraphQuery;
  const storeModule = container.resolve(Modules.STORE) as any;
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as any;
  const [store] = await storeModule.listStores();
  assert.ok(store?.default_sales_channel_id, "Default sales channel is missing.");
  const publishableKey = process.env.TASK038_ROUTE_MATRIX_PUBLISHABLE_KEY;
  assert.ok(publishableKey, "A local publishable key is required for route fixtures.");
  const { data: apiKeys } = await query.graph({
    entity: "api_key",
    fields: ["token", "sales_channels.id"],
    filters: { token: publishableKey },
  });
  const salesChannelIds: string[] = (apiKeys[0]?.sales_channels || []).map(
    (channel: { id: string }) => channel.id
  );
  assert.ok(salesChannelIds.length > 0, "Publishable key sales channel is missing.");
  const [shippingProfile] = await fulfillmentModule.listShippingProfiles({
    type: "default",
  });
  assert.ok(shippingProfile?.id, "Default shipping profile is missing.");

  const runId = `${process.pid}-${Date.now()}`;
  const categoryDefinitions = [
    { role: "active", is_active: true },
    { role: "inactive", is_active: false },
  ];
  const { result: categories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: categoryDefinitions.map(({ role, is_active }) => ({
        handle: `${fixturePrefix}${runId}-${role}`,
        name: `TASK-038 ${role} route fixture`,
        is_active,
      })),
    },
  });

  const categoryByRole = new Map(
    categoryDefinitions.map(({ role }, index) => [role, categories[index].id])
  );
  const activeCategoryId = categoryByRole.get("active");
  const inactiveCategoryId = categoryByRole.get("inactive");
  assert.ok(activeCategoryId);
  assert.ok(inactiveCategoryId);

  const productDefinitions = [
    {
      role: "unpublished",
      categoryId: activeCategoryId,
      status: ProductStatus.DRAFT,
      sales_channels: salesChannelIds.map((id) => ({ id })),
    },
    {
      role: "channel-invisible",
      categoryId: activeCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: [],
    },
    {
      role: "inactive-category",
      categoryId: inactiveCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: salesChannelIds.map((id) => ({ id })),
    },
    {
      role: "out-of-stock",
      categoryId: activeCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: salesChannelIds.map((id) => ({ id })),
    },
  ];
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: productDefinitions.map((definition) => ({
        title: `TASK-038 ${definition.role}`,
        handle: `${fixturePrefix}${runId}-${definition.role}`,
        description: "Synthetic local route-level fixture.",
        status: definition.status,
        category_ids: [definition.categoryId],
        shipping_profile_id: shippingProfile.id,
        sales_channels: definition.sales_channels,
        metadata: {
          task038_route_matrix: runId,
          task038_route_role: definition.role,
        },
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: `${fixturePrefix}${runId}-${definition.role}`,
            manage_inventory: true,
            allow_backorder: false,
            options: { Default: "Default" },
            prices: [{ amount: 1000, currency_code: "rub" }],
          },
        ],
      })),
    },
  });

  const ids: FixtureIds = {
    products: Object.fromEntries(
      productDefinitions.map((definition, index) => [
        definition.role,
        products[index].id,
      ])
    ),
    handles: Object.fromEntries(
      productDefinitions.map((definition, index) => [
        definition.role,
        products[index].handle,
      ])
    ),
    categories: categories.map((category) => category.id),
  };

  await createZeroInventoryLevel(container, query, ids.products["out-of-stock"]);
  const { loadCanonicalProducts } = require("../../apps/backend/src/catalog/canonical");
  const outOfStock = await loadCanonicalProducts(
    container,
    salesChannelIds[0],
    { id: ids.products["out-of-stock"] }
  );
  assert.equal(outOfStock.length, 1);
  assert.equal(outOfStock[0].status, ProductStatus.PUBLISHED);
  assert.equal(outOfStock[0].category?.is_active, true);
  assert.equal(
    outOfStock[0].variants.every(
      (variant: any) => variant.availability.is_sellable === false
    ),
    true
  );

  return ids;
}

async function createZeroInventoryLevel(
  container: ExecArgs["container"],
  query: GraphQuery,
  productId: string
) {
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_items",
    fields: [
      "variant.id",
      "variant.product.id",
      "inventory_item_id",
      "inventory.location_levels.id",
      "inventory.location_levels.location_id",
    ],
  });
  const link = links.find((candidate) => candidate.variant?.product?.id === productId);
  assert.ok(link, "Out-of-stock fixture inventory link is missing.");

  const existingLevels = link.inventory?.location_levels || [];
  if (existingLevels.length > 0) {
    await updateInventoryLevelsWorkflow(container).run({
      input: {
        updates: existingLevels.map((level: any) => ({
          id: level.id,
          stocked_quantity: 0,
        })),
      },
    });
    return;
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  });
  assert.ok(locations[0]?.id, "A local stock location is required.");

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: [
        {
          location_id: locations[0].id,
          inventory_item_id: link.inventory_item_id,
          stocked_quantity: 0,
        },
      ],
    },
  });
}

async function cleanupFixtures(
  container: ExecArgs["container"],
  explicitIds?: FixtureIds
) {
  const query = container.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as GraphQuery;
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  });
  const productIds = explicitIds
    ? Object.values(explicitIds.products)
    : products
        .filter(
          (product) =>
            typeof product.metadata?.task038_route_matrix === "string"
        )
        .map((product) => String(product.id));
  if (productIds.length > 0) {
    await deleteProductsWorkflow(container).run({ input: { ids: productIds } });
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  });
  const categoryIds = explicitIds
    ? explicitIds.categories
    : categories
        .filter((category) => String(category.handle).startsWith(fixturePrefix))
        .map((category) => String(category.id));
  if (categoryIds.length > 0) {
    await deleteProductCategoriesWorkflow(container).run({ input: categoryIds });
  }
}

function parseFixtureIds(): FixtureIds | undefined {
  const value = process.env.TASK038_ROUTE_MATRIX_FIXTURE_IDS;
  if (!value) return undefined;
  return JSON.parse(value) as FixtureIds;
}
