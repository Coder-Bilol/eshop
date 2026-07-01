export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export type CatalogCategory = {
  handle: string;
  name: string;
  parent_handle: string | null;
};

export type CatalogProduct = {
  handle: string;
  title: string;
  description: string;
  category: {
    handle: string;
    name: string;
  };
  product_type: string;
  price: {
    min: number;
    max: number;
    currency_code: string;
  };
  attributes: {
    color: string | null;
    material: string | null;
    size_length: string | null;
    mounting_method: string | null;
  };
  has_optional_attribute_gap: boolean;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    price: {
      amount: number;
      currency_code: string;
    };
    attributes: {
      color: string | null;
      material: string | null;
      size_length: string | null;
      mounting_method: string | null;
    };
  }>;
};

export type CatalogFilters = {
  selected: {
    category: string | null;
    q: string | null;
    price_min: number | null;
    price_max: number | null;
    color: string | null;
    material: string | null;
    size_length: string | null;
    product_type: string | null;
    mounting_method: string | null;
  };
  available: {
    category: CatalogCategory[];
    price: {
      min: number | null;
      max: number | null;
    };
    color: string[];
    material: string[];
    size_length: string[];
    product_type: string[];
    mounting_method: string[];
  };
};

export type CatalogResponse = {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  filters: CatalogFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  empty: boolean;
};

export const CATALOG_FILTERS = [
  { key: "color", label: "Color" },
  { key: "material", label: "Material" },
  { key: "size_length", label: "Size / length" },
  { key: "product_type", label: "Product type" },
  { key: "mounting_method", label: "Mounting" },
] as const;

export const CATALOG_QUERY_KEYS = [
  "category",
  "q",
  "price_min",
  "price_max",
  "color",
  "material",
  "size_length",
  "product_type",
  "mounting_method",
  "page",
  "limit",
] as const;

export type CatalogFilterKey = (typeof CATALOG_FILTERS)[number]["key"];

const DEFAULT_BACKEND_URL = "http://localhost:9000";
const DEFAULT_LIMIT = "4";

export class CatalogFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogFetchError";
  }
}

export function readSearchParam(
  params: CatalogSearchParams,
  key: (typeof CATALOG_QUERY_KEYS)[number]
) {
  const value = params[key];
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return null;
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
}

export function buildCatalogQueryParams(params: CatalogSearchParams) {
  const query = new URLSearchParams();

  for (const key of CATALOG_QUERY_KEYS) {
    const value = readSearchParam(params, key);
    if (value !== null) {
      query.set(key, value);
    }
  }

  if (!query.has("limit")) {
    query.set("limit", DEFAULT_LIMIT);
  }

  return query;
}

export function buildCatalogHref(
  params: CatalogSearchParams,
  overrides: Partial<Record<(typeof CATALOG_QUERY_KEYS)[number], string | null>>
) {
  const query = buildCatalogQueryParams(params);

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") {
      query.delete(key);
    } else {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized.length > 0 ? `/?${serialized}` : "/";
}

export async function fetchCatalog(
  params: CatalogSearchParams
): Promise<CatalogResponse> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, "");
  const query = buildCatalogQueryParams(params);
  const response = await fetch(`${baseUrl}/store/catalog?${query.toString()}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "x-publishable-api-key": publishableApiKey(),
    },
  });

  if (!response.ok) {
    throw new CatalogFetchError(`Catalog request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as CatalogResponse;
}

function publishableApiKey() {
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY?.trim();
  if (!key) {
    throw new CatalogFetchError(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is required."
    );
  }
  return key;
}

export function formatCatalogMoney(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export function formatCatalogValue(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function selectedCatalogFilters(catalog: CatalogResponse) {
  const selected = catalog.filters.selected;
  const entries: Array<{ label: string; value: string }> = [];

  if (selected.category) {
    const category = catalog.categories.find(
      (item) => item.handle === selected.category
    );
    entries.push({
      label: "Category",
      value: category?.name || formatCatalogValue(selected.category),
    });
  }

  if (selected.q) {
    entries.push({ label: "Search", value: selected.q });
  }

  if (selected.price_min !== null) {
    entries.push({ label: "Min price", value: String(selected.price_min) });
  }

  if (selected.price_max !== null) {
    entries.push({ label: "Max price", value: String(selected.price_max) });
  }

  for (const filter of CATALOG_FILTERS) {
    const value = selected[filter.key];
    if (value) {
      entries.push({ label: filter.label, value: formatCatalogValue(value) });
    }
  }

  return entries;
}

export function catalogProductVariantSummary(product: CatalogProduct) {
  const labels = [
    ["Color", uniqueVariantValues(product, "color")],
    ["Material", uniqueVariantValues(product, "material")],
    ["Size", uniqueVariantValues(product, "size_length")],
    ["Mounting", uniqueVariantValues(product, "mounting_method")],
  ]
    .filter((entry): entry is [string, string[]] => entry[1].length > 0)
    .map(
      ([label, values]) =>
        `${label}: ${values.map(formatCatalogValue).join(", ")}`
    );

  return {
    sku_count: product.variants.length,
    labels,
  };
}

function uniqueVariantValues(
  product: CatalogProduct,
  key: keyof CatalogProduct["variants"][number]["attributes"]
) {
  return Array.from(
    new Set(
      product.variants
        .map((variant) => variant.attributes[key])
        .filter((value): value is string => Boolean(value))
    )
  ).sort();
}
