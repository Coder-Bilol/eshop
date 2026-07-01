const {
  loadCanonicalCategories,
  loadCanonicalProducts,
  requireSalesChannelId,
} = require("./canonical");

type CatalogQueryInput = Record<string, unknown>;

type NormalizedCatalogQuery = {
  category: string | null;
  q: string | null;
  price_min: number | null;
  price_max: number | null;
  color: string | null;
  material: string | null;
  size_length: string | null;
  product_type: string | null;
  mounting_method: string | null;
  page: number;
  limit: number;
};

type CanonicalVariant = {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string | null>;
  price: { amount: number; currency_code: string };
  availability: { is_sellable: boolean };
};

type CanonicalProduct = {
  handle: string;
  title: string;
  description: string;
  status: string;
  metadata: Record<string, unknown>;
  category: { handle: string; name: string; is_active: boolean } | null;
  product_type: string;
  variants: CanonicalVariant[];
};

class CatalogValidationError extends Error {
  statusCode = 400;
  code = "catalog_invalid_query";

  constructor(message: string) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

function queryInputFromMedusaRequest(req: { query?: unknown; url?: string }) {
  if (req.query && typeof req.query === "object") {
    return req.query as CatalogQueryInput;
  }

  const url = new URL(req.url || "/store/catalog", "http://localhost");
  const query: CatalogQueryInput = {};
  for (const [key, value] of url.searchParams.entries()) query[key] = value;
  return query;
}

async function queryCatalog(
  scope: { resolve: (key: string) => unknown },
  input: CatalogQueryInput = {},
  salesChannelIds: string[] = []
) {
  const query = normalizeCatalogQuery(input);
  const salesChannelId = requireSalesChannelId(salesChannelIds);
  const [rawProducts, categories] = await Promise.all([
    loadCanonicalProducts(scope, salesChannelId, { status: "published" }),
    loadCanonicalCategories(scope),
  ]);
  const published = (rawProducts as CanonicalProduct[]).filter(
    (product) =>
      product.status === "published" &&
      product.category?.is_active === true &&
      product.variants.some((variant) => variant.availability.is_sellable)
  );
  const available = buildAvailableFilters(published, categories);
  const filtered = published
    .filter((product) => matchesProduct(product, query))
    .sort((left, right) => left.title.localeCompare(right.title));
  const total = filtered.length;
  const offset = (query.page - 1) * query.limit;
  const pageProducts = filtered
    .slice(offset, offset + query.limit)
    .map(mapCatalogProduct);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    products: pageProducts,
    categories,
    filters: {
      selected: {
        category: query.category,
        q: query.q,
        price_min: query.price_min,
        price_max: query.price_max,
        color: query.color,
        material: query.material,
        size_length: query.size_length,
        product_type: query.product_type,
        mounting_method: query.mounting_method,
      },
      available,
    },
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: totalPages,
      has_next: query.page < totalPages,
      has_prev: query.page > 1 && totalPages > 0,
    },
    empty: total === 0,
  };
}

function matchesProduct(
  product: CanonicalProduct,
  query: NormalizedCatalogQuery
) {
  if (
    query.category &&
    product.category?.handle !== query.category
  ) {
    return false;
  }
  if (query.product_type && product.product_type !== query.product_type) {
    return false;
  }
  if (query.q) {
    const haystack = [
      product.title,
      product.description,
      product.handle,
      product.category?.name || "",
      ...product.variants.map((variant) => variant.sku),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query.q.toLowerCase())) return false;
  }

  const hasVariantFilter =
    query.price_min !== null ||
    query.price_max !== null ||
    query.color !== null ||
    query.material !== null ||
    query.size_length !== null ||
    query.mounting_method !== null;
  if (!hasVariantFilter) return true;

  return product.variants.some(
    (variant) =>
      variant.availability.is_sellable &&
      (query.price_min === null || variant.price.amount >= query.price_min) &&
      (query.price_max === null || variant.price.amount <= query.price_max) &&
      (!query.color || variant.options.color === query.color) &&
      (!query.material || variant.options.material === query.material) &&
      (!query.size_length ||
        variant.options.size_length === query.size_length) &&
      (!query.mounting_method ||
        variant.options.mounting_method === query.mounting_method)
  );
}

function mapCatalogProduct(product: CanonicalProduct) {
  const variants = product.variants.filter(
    (variant) => variant.availability.is_sellable
  );
  const prices = variants.map((variant) => variant.price.amount);
  const representative = variants[0] || product.variants[0];
  return {
    handle: product.handle,
    title: product.title,
    description: product.description,
    category: {
      handle: String(product.category?.handle),
      name: String(product.category?.name),
    },
    product_type: product.product_type,
    price: {
      min: Math.min(...prices),
      max: Math.max(...prices),
      currency_code: representative?.price.currency_code || "RUB",
    },
    attributes: representative?.options || {
      color: null,
      material: null,
      size_length: null,
      mounting_method: null,
    },
    has_optional_attribute_gap: Boolean(
      product.metadata.has_optional_attribute_gap
    ),
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      price: variant.price,
      attributes: variant.options,
    })),
  };
}

function buildAvailableFilters(
  products: CanonicalProduct[],
  categories: Array<{
    handle: string;
    name: string;
    parent_handle: string | null;
  }>
) {
  const variants = products.flatMap((product) =>
    product.variants.filter((variant) => variant.availability.is_sellable)
  );
  const prices = variants.map((variant) => variant.price.amount);
  const distinct = (values: Array<string | null | undefined>) =>
    Array.from(
      new Set(values.filter((value): value is string => Boolean(value)))
    ).sort();

  return {
    category: categories,
    price: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
    },
    color: distinct(variants.map((variant) => variant.options.color)),
    material: distinct(variants.map((variant) => variant.options.material)),
    size_length: distinct(
      variants.map((variant) => variant.options.size_length)
    ),
    product_type: distinct(products.map((product) => product.product_type)),
    mounting_method: distinct(
      variants.map((variant) => variant.options.mounting_method)
    ),
  };
}

function normalizeCatalogQuery(input: CatalogQueryInput): NormalizedCatalogQuery {
  const priceMin = parseOptionalNonNegativeInt(input.price_min, "price_min");
  const priceMax = parseOptionalNonNegativeInt(input.price_max, "price_max");
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    throw new CatalogValidationError(
      "price_min must be less than or equal to price_max."
    );
  }

  return {
    category: readOptionalString(input.category),
    q: readOptionalString(input.q),
    price_min: priceMin,
    price_max: priceMax,
    color: readOptionalString(input.color),
    material: readOptionalString(input.material),
    size_length: readOptionalString(input.size_length),
    product_type: readOptionalString(input.product_type),
    mounting_method: readOptionalString(input.mounting_method),
    page: parsePositiveInt(input.page, "page", 1, 10_000),
    limit: parsePositiveInt(input.limit, "limit", 12, 100),
  };
}

function readOptionalString(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
}

function parseOptionalNonNegativeInt(value: unknown, name: string) {
  const text = readOptionalString(value);
  if (text === null) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CatalogValidationError(
      `${name} must be a non-negative integer.`
    );
  }
  return parsed;
}

function parsePositiveInt(
  value: unknown,
  name: string,
  defaultValue: number,
  max: number
) {
  const text = readOptionalString(value);
  if (text === null) return defaultValue;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CatalogValidationError(`${name} must be a positive integer.`);
  }
  return Math.min(parsed, max);
}

module.exports = {
  CatalogValidationError,
  queryCatalog,
  queryInputFromMedusaRequest,
};
