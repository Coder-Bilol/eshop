import type { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTypesWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

const { categories, products } = require("../../scripts/catalog-fixtures.cjs") as {
  categories: CatalogCategoryFixture[];
  products: CatalogProductFixture[];
};

type CatalogCategoryFixture = {
  id: string;
  handle: string;
  name: string;
  parentId: string | null;
};

type CatalogVariantFixture = {
  id: string;
  sku: string;
  title: string;
  color: string | null;
  material: string | null;
  sizeLength: string | null;
  mountingMethod: string | null;
  priceAmount: number;
  currencyCode?: string;
  isActive?: boolean;
};

type CatalogProductFixture = {
  id: string;
  handle: string;
  title: string;
  description: string;
  categoryId: string;
  productType: string;
  currencyCode?: string;
  hasOptionalAttributeGap?: boolean;
  variants: CatalogVariantFixture[];
};

type GraphQuery = {
  graph: (input: Record<string, unknown>) => Promise<{ data: any[] }>;
};

const stockLocationName = "Eshop Local Warehouse";
const publishableKeyTitle = "Eshop Storefront";

export default async function seedCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as GraphQuery;
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const storeService = container.resolve(Modules.STORE);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);

  logger.info("Seeding canonical Medusa catalog...");

  const [store] = await storeService.listStores();
  if (!store) {
    throw new Error("Medusa store is missing. Run Medusa migrations and start once.");
  }

  let [salesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  });
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [{ name: "Default Sales Channel" }],
      },
    });
    salesChannel = result[0];
  }

  if (store.default_sales_channel_id !== salesChannel.id) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: { default_sales_channel_id: salesChannel.id },
      },
    });
  }

  let [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  });
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default Shipping Profile",
            type: "default",
          },
        ],
      },
    });
    shippingProfile = result[0];
  }

  const { data: existingLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: stockLocationName },
  });
  let stockLocation = existingLocations[0];
  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: stockLocationName,
            address: {
              city: "Moscow",
              country_code: "RU",
              address_1: "Local development",
            },
          },
        ],
      },
    });
    stockLocation = result[0];
  }

  const { data: channelLocations } = await query.graph({
    entity: "sales_channel_locations",
    fields: ["sales_channel_id", "stock_location_id"],
    filters: {
      sales_channel_id: salesChannel.id,
      stock_location_id: stockLocation.id,
    },
  });
  if (channelLocations.length === 0) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [salesChannel.id],
      },
    });
  }

  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title", "type", "sales_channels.id"],
    filters: { type: "publishable" },
  });
  let publishableKey =
    existingKeys.find((key) => key.title === publishableKeyTitle) ||
    existingKeys[0];
  let keyWasCreated = false;
  if (!publishableKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: publishableKeyTitle,
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });
    publishableKey = result[0];
    keyWasCreated = true;
  }

  const linkedChannelIds = new Set(
    (publishableKey.sales_channels || []).map(
      (channel: { id: string }) => channel.id
    )
  );
  if (keyWasCreated || !linkedChannelIds.has(salesChannel.id)) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableKey.id,
        add: [salesChannel.id],
      },
    });
  }

  const categoryIds = await ensureCategories(container, query);
  const productTypeIds = await ensureProductTypes(container, query);
  const createdProducts = await ensureProducts(
    container,
    query,
    categoryIds,
    productTypeIds,
    shippingProfile.id,
    salesChannel.id
  );

  const inventorySummary = await ensureInventoryLevels(
    container,
    query,
    stockLocation.id
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        command: "seed:medusa:catalog",
        status: "ok",
        canonical_models: [
          "product",
          "product_category",
          "product_type",
          "product_variant",
          "price",
          "inventory_item",
          "sales_channel",
        ],
        sales_channel_id: salesChannel.id,
        stock_location_id: stockLocation.id,
        publishable_api_key: publishableKey.token,
        counts: {
          categories: categoryIds.size,
          products: products.length,
          products_created: createdProducts,
          variants: products.reduce(
            (count, product) => count + product.variants.length,
            0
          ),
          inventory_levels_created: inventorySummary.created,
        },
      },
      null,
      2
    )}\n`
  );
}

async function ensureCategories(
  container: ExecArgs["container"],
  query: GraphQuery
) {
  const { data: existing } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "parent_category_id"],
  });
  const byHandle = new Map(existing.map((item) => [item.handle, item.id]));
  const fixtureById = new Map(categories.map((item) => [item.id, item]));

  for (const category of categories) {
    if (byHandle.has(category.handle)) continue;

    const parent = category.parentId
      ? fixtureById.get(category.parentId)
      : undefined;
    const parentCategoryId = parent ? byHandle.get(parent.handle) : undefined;
    if (parent && !parentCategoryId) {
      throw new Error(`Parent category was not seeded: ${parent.handle}`);
    }

    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: category.name,
            handle: category.handle,
            is_active: true,
            parent_category_id: parentCategoryId,
          },
        ],
      },
    });
    byHandle.set(category.handle, result[0].id);
  }

  return byHandle;
}

async function ensureProductTypes(
  container: ExecArgs["container"],
  query: GraphQuery
) {
  const values = Array.from(
    new Set(products.map((product) => product.productType))
  );
  const { data: existing } = await query.graph({
    entity: "product_type",
    fields: ["id", "value"],
    filters: { value: values },
  });
  const byValue = new Map(existing.map((item) => [item.value, item.id]));
  const missing = values.filter((value) => !byValue.has(value));

  if (missing.length > 0) {
    const { result } = await createProductTypesWorkflow(container).run({
      input: {
        product_types: missing.map((value) => ({ value })),
      },
    });
    for (const type of result) {
      byValue.set(type.value, type.id);
    }
  }

  return byValue;
}

async function ensureProducts(
  container: ExecArgs["container"],
  query: GraphQuery,
  categoryIds: Map<unknown, unknown>,
  productTypeIds: Map<unknown, unknown>,
  shippingProfileId: string,
  salesChannelId: string
) {
  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: products.map((product) => product.handle) },
  });
  const existingHandles = new Set(existing.map((product) => product.handle));
  const missing = products.filter(
    (product) => !existingHandles.has(product.handle)
  );
  if (missing.length === 0) return 0;

  await createProductsWorkflow(container).run({
    input: {
      products: missing.map((product) => {
        const options = optionDefinitions(product.variants);
        return {
          title: product.title,
          handle: product.handle,
          description: product.description,
          status: ProductStatus.PUBLISHED,
          category_ids: [String(categoryIds.get(categoryHandle(product.categoryId)))],
          type_id: String(productTypeIds.get(product.productType)),
          shipping_profile_id: shippingProfileId,
          sales_channels: [{ id: salesChannelId }],
          metadata: {
            fixture_key: product.id,
            has_optional_attribute_gap: Boolean(
              product.hasOptionalAttributeGap
            ),
          },
          options,
          variants: product.variants.map((variant) => ({
            title: variant.title,
            sku: variant.sku,
            manage_inventory: true,
            allow_backorder: false,
            metadata: {
              fixture_key: variant.id,
              seed_available: variant.isActive !== false,
            },
            options: variantOptions(variant, options),
            prices: [
              {
                amount: variant.priceAmount,
                currency_code: (
                  variant.currencyCode ||
                  product.currencyCode ||
                  "RUB"
                ).toLowerCase(),
              },
            ],
          })),
        };
      }),
    },
  });

  return missing.length;
}

async function ensureInventoryLevels(
  container: ExecArgs["container"],
  query: GraphQuery,
  stockLocationId: string
) {
  const fixtureSkus = products.flatMap((product) =>
    product.variants.map((variant) => variant.sku)
  );
  const fixtureBySku = new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [variant.sku, variant] as const)
    )
  );
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_items",
    fields: [
      "variant.sku",
      "inventory_item_id",
      "inventory.location_levels.location_id",
    ],
  });

  const inventoryLevels = links
    .filter((link) => fixtureSkus.includes(link.variant?.sku))
    .filter((link) =>
      (link.inventory?.location_levels || []).every(
        (level: { location_id: string }) =>
          level.location_id !== stockLocationId
      )
    )
    .map((link) => {
      const fixture = fixtureBySku.get(link.variant.sku);
      return {
        location_id: stockLocationId,
        inventory_item_id: link.inventory_item_id,
        stocked_quantity: fixture?.isActive === false ? 0 : 100,
      };
    });

  if (inventoryLevels.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: inventoryLevels },
    });
  }

  return { created: inventoryLevels.length };
}

function categoryHandle(categoryId: string) {
  const category = categories.find((item) => item.id === categoryId);
  if (!category) {
    throw new Error(`Unknown fixture category: ${categoryId}`);
  }
  return category.handle;
}

function optionDefinitions(variants: CatalogVariantFixture[]) {
  const dimensions = [
    ["Color", "color"],
    ["Material", "material"],
    ["Size/length", "sizeLength"],
    ["Mounting method", "mountingMethod"],
  ] as const;
  const options = dimensions
    .map(([title, field]) => ({
      title,
      values: Array.from(
        new Set(
          variants
            .map((variant) => variant[field])
            .filter((value): value is string => Boolean(value))
        )
      ),
    }))
    .filter((option) => option.values.length > 0);

  return options.length > 0
    ? options
    : [{ title: "Default", values: ["Default"] }];
}

function variantOptions(
  variant: CatalogVariantFixture,
  options: Array<{ title: string; values: string[] }>
) {
  const values: Record<string, string> = {};
  for (const option of options) {
    if (option.title === "Default") values[option.title] = "Default";
    if (option.title === "Color" && variant.color) {
      values[option.title] = variant.color;
    }
    if (option.title === "Material" && variant.material) {
      values[option.title] = variant.material;
    }
    if (option.title === "Size/length" && variant.sizeLength) {
      values[option.title] = variant.sizeLength;
    }
    if (option.title === "Mounting method" && variant.mountingMethod) {
      values[option.title] = variant.mountingMethod;
    }
  }
  return values;
}
