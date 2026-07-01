const {
  ContainerRegistrationKeys,
  getVariantAvailability,
} = require("@medusajs/framework/utils");

type GraphQuery = {
  graph: (input: Record<string, unknown>) => Promise<{ data: any[] }>;
};

type MedusaScope = {
  resolve: (key: string) => unknown;
};

type CanonicalVariant = {
  id: string;
  sku: string;
  title: string;
  options: {
    color: string | null;
    material: string | null;
    size_length: string | null;
    mounting_method: string | null;
  };
  price: {
    amount: number;
    currency_code: string;
  };
  availability: {
    is_available: boolean;
    is_sellable: boolean;
    reason: "unavailable" | "missing_price" | null;
  };
};

async function loadCanonicalProducts(
  scope: MedusaScope,
  salesChannelId: string,
  filters: Record<string, unknown> = {}
) {
  const query = scope.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as GraphQuery;
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "description",
      "status",
      "metadata",
      "type.id",
      "type.value",
      "categories.id",
      "categories.handle",
      "categories.name",
      "categories.is_active",
      "categories.parent_category_id",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.options.value",
      "variants.options.option.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "images.url",
      "sales_channels.id",
    ],
    filters,
  });

  const channelProducts = data.filter((product) =>
    (product.sales_channels || []).some(
      (channel: { id: string }) => channel.id === salesChannelId
    )
  );
  const variantIds = channelProducts.flatMap((product) =>
    (product.variants || []).map((variant: { id: string }) => variant.id)
  );
  const availability =
    variantIds.length > 0
      ? await getVariantAvailability(query, {
          variant_ids: variantIds,
          sales_channel_id: salesChannelId,
        })
      : {};

  return channelProducts.map((product) =>
    normalizeProduct(product, availability)
  );
}

async function loadCanonicalCategories(scope: MedusaScope) {
  const query = scope.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as GraphQuery;
  const { data } = await query.graph({
    entity: "product_category",
    fields: [
      "id",
      "handle",
      "name",
      "is_active",
      "parent_category_id",
      "parent_category.handle",
    ],
    filters: { is_active: true },
  });

  return data
    .map((category) => ({
      handle: String(category.handle),
      name: String(category.name),
      parent_handle: category.parent_category?.handle
        ? String(category.parent_category.handle)
        : null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeProduct(
  product: any,
  availability: Record<string, { availability: number | null }>
) {
  const category = (product.categories || []).find(
    (item: { is_active: boolean }) => item.is_active
  );
  return {
    id: String(product.id),
    handle: String(product.handle),
    title: String(product.title),
    description: String(product.description || ""),
    status: String(product.status),
    metadata: product.metadata || {},
    media: (product.images || []).map((image: { url: string }) => ({
      url: String(image.url),
    })),
    category: category
      ? {
          handle: String(category.handle),
          name: String(category.name),
          is_active: Boolean(category.is_active),
        }
      : null,
    product_type: product.type?.value ? String(product.type.value) : "",
    variants: (product.variants || [])
      .map((variant: any) =>
        normalizeVariant(variant, availability[variant.id]?.availability)
      )
      .sort((left: CanonicalVariant, right: CanonicalVariant) =>
        left.title.localeCompare(right.title)
      ),
  };
}

function normalizeVariant(
  variant: any,
  availableQuantity: number | null | undefined
): CanonicalVariant {
  const options: CanonicalVariant["options"] = {
    color: null,
    material: null,
    size_length: null,
    mounting_method: null,
  };
  for (const optionValue of variant.options || []) {
    const key = optionKey(optionValue.option?.title);
    if (key) options[key] = String(optionValue.value);
  }

  const price = (variant.prices || []).find(
    (item: { currency_code: string }) =>
      String(item.currency_code).toLowerCase() === "rub"
  ) || variant.prices?.[0];
  const amount = Number(price?.amount);
  const hasPrice = Number.isInteger(amount) && amount >= 0;
  const isAvailable =
    variant.allow_backorder === true ||
    variant.manage_inventory !== true ||
    (typeof availableQuantity === "number" && availableQuantity > 0);

  return {
    id: String(variant.id),
    sku: String(variant.sku),
    title: String(variant.title),
    options,
    price: {
      amount,
      currency_code: String(price?.currency_code || "rub").toUpperCase(),
    },
    availability: {
      is_available: isAvailable,
      is_sellable: isAvailable && hasPrice,
      reason: isAvailable
        ? hasPrice
          ? null
          : "missing_price"
        : "unavailable",
    },
  };
}

function optionKey(
  title: unknown
): keyof CanonicalVariant["options"] | null {
  if (title === "Color") return "color";
  if (title === "Material") return "material";
  if (title === "Size/length") return "size_length";
  if (title === "Mounting method") return "mounting_method";
  return null;
}

function requireSalesChannelId(salesChannelIds: string[]) {
  const salesChannelId = salesChannelIds[0];
  if (!salesChannelId) {
    throw new Error("Publishable API key has no sales channel.");
  }
  return salesChannelId;
}

module.exports = {
  loadCanonicalCategories,
  loadCanonicalProducts,
  requireSalesChannelId,
};
