const { Client } = require("@medusajs/framework/pg");

const defaultDatabaseUrl =
  "postgres://postgres:postgres@127.0.0.1:5432/eshop";
const catalogCategoriesTable = "eshop_local_catalog_categories";
const catalogProductsTable = "eshop_local_catalog_products";
const catalogVariantsTable = "eshop_local_catalog_variants";

type QueryRow = Record<string, any>;

type QueryableClient = {
  query: (
    statement: string,
    params?: unknown[]
  ) => Promise<{ rows: QueryRow[]; rowCount?: number | null }>;
};

type ProductDetailInput = {
  handle?: unknown;
};

type ProductDetailVariant = {
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

type RawProductDetailVariant = {
  sku?: unknown;
  title?: unknown;
  is_active?: unknown;
  price?: {
    amount?: unknown;
    currency_code?: unknown;
  };
  options?: {
    color?: unknown;
    material?: unknown;
    size_length?: unknown;
    mounting_method?: unknown;
  };
};

class ProductDetailValidationError extends Error {
  statusCode = 400;
  code = "product_detail_invalid_request";

  constructor(message: string) {
    super(message);
    this.name = "ProductDetailValidationError";
  }
}

class ProductDetailNotFoundError extends Error {
  statusCode = 404;
  code: string;

  constructor(code: "product_detail_not_found" | "product_detail_unpublished") {
    super(
      code === "product_detail_unpublished"
        ? "Product detail is not published."
        : "Product detail was not found."
    );
    this.name = "ProductDetailNotFoundError";
    this.code = code;
  }
}

function productDetailInputFromMedusaRequest(req: {
  params?: Record<string, unknown>;
  url?: string;
}) {
  const paramHandle = req.params?.handle;
  if (paramHandle !== undefined && paramHandle !== null) {
    return { handle: paramHandle };
  }

  const url = new URL(req.url || "/store/product-detail", "http://localhost");
  const pathHandle = url.pathname.split("/").filter(Boolean).at(-1);
  return { handle: pathHandle };
}

async function queryProductDetail(
  input: ProductDetailInput,
  options: { connectionString?: string } = {}
) {
  const connectionString =
    options.connectionString || process.env.DATABASE_URL || defaultDatabaseUrl;
  const client = new Client({ connectionString });

  await client.connect();
  try {
    return await queryProductDetailWithClient(client, input);
  } finally {
    await client.end();
  }
}

async function queryProductDetailWithClient(
  client: QueryableClient,
  input: ProductDetailInput
) {
  const handle = readRequiredHandle(input.handle);
  await assertProductVisible(client, handle);

  const result = await client.query(
    `
      select
        p.handle,
        p.title,
        p.description,
        p.product_type,
        p.currency_code,
        c.handle as category_handle,
        c.name as category_name,
        json_agg(
          json_build_object(
            'sku', v.sku,
            'title', v.title,
            'is_active', v.is_active,
            'price', json_build_object(
              'amount', v.price_amount,
              'currency_code', v.currency_code
            ),
            'options', json_build_object(
              'color', v.color,
              'material', v.material,
              'size_length', v.size_length,
              'mounting_method', v.mounting_method
            )
          )
          order by v.title asc
        ) as variants
      from ${catalogProductsTable} p
      join ${catalogCategoriesTable} c on c.id = p.category_id
      left join ${catalogVariantsTable} v on v.product_id = p.id
      where p.handle = $1 and c.is_active = true
      group by p.id, c.handle, c.name
    `,
    [handle]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ProductDetailNotFoundError("product_detail_not_found");
  }

  const variants = normalizeVariants(row.variants);
  const sellableVariants = variants.filter(
    (variant) => variant.availability.is_sellable
  );
  const defaultVariantSku =
    variants.length === 1 && sellableVariants.length === 1
      ? sellableVariants[0].sku
      : null;

  return {
    handle: String(row.handle),
    title: String(row.title),
    description: String(row.description),
    media: [],
    category: {
      handle: String(row.category_handle),
      name: String(row.category_name),
    },
    product_type: String(row.product_type),
    option_dimensions: optionDimensionSummary(variants),
    variants,
    price_range: priceRangeForVariants(variants),
    requires_selection: variants.length > 1,
    default_variant_sku: defaultVariantSku,
    selected_variant_sku: defaultVariantSku,
    visibility: {
      status: "published",
    },
  };
}

async function assertProductVisible(client: QueryableClient, handle: string) {
  const result = await client.query(
    `
      select c.is_active as category_is_active
      from ${catalogProductsTable} p
      left join ${catalogCategoriesTable} c on c.id = p.category_id
      where p.handle = $1
    `,
    [handle]
  );

  if (result.rows.length === 0) {
    throw new ProductDetailNotFoundError("product_detail_not_found");
  }

  if (result.rows[0]?.category_is_active !== true) {
    throw new ProductDetailNotFoundError("product_detail_unpublished");
  }
}

function normalizeVariants(value: unknown): ProductDetailVariant[] {
  const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  const rawVariants: RawProductDetailVariant[] = Array.isArray(parsed)
    ? (parsed as RawProductDetailVariant[])
    : [];

  return rawVariants
    .filter((variant) => variant && variant.sku)
    .map((variant) => {
      const priceAmount = Number(variant.price?.amount);
      const hasValidPrice = Number.isInteger(priceAmount) && priceAmount >= 0;
      const isAvailable = variant.is_active === true;
      return {
        sku: String(variant.sku),
        title: String(variant.title),
        options: {
          color: nullableString(variant.options?.color),
          material: nullableString(variant.options?.material),
          size_length: nullableString(variant.options?.size_length),
          mounting_method: nullableString(variant.options?.mounting_method),
        },
        price: {
          amount: priceAmount,
          currency_code: String(variant.price?.currency_code || "RUB"),
        },
        availability: {
          is_available: isAvailable,
          is_sellable: isAvailable && hasValidPrice,
          reason: isAvailable ? (hasValidPrice ? null : "missing_price") : "unavailable",
        },
      };
    });
}

function optionDimensionSummary(variants: ProductDetailVariant[]) {
  return [
    {
      name: "color",
      label: "Color",
      values: uniquePresent(variants.map((variant) => variant.options.color)),
    },
    {
      name: "material",
      label: "Material",
      values: uniquePresent(variants.map((variant) => variant.options.material)),
    },
    {
      name: "size_length",
      label: "Size/length",
      values: uniquePresent(
        variants.map((variant) => variant.options.size_length)
      ),
    },
    {
      name: "mounting_method",
      label: "Mounting method",
      values: uniquePresent(
        variants.map((variant) => variant.options.mounting_method)
      ),
    },
  ];
}

function priceRangeForVariants(variants: ProductDetailVariant[]) {
  const sellablePrices = variants
    .filter((variant) => variant.availability.is_sellable)
    .map((variant) => variant.price.amount);
  const fallbackPrices = variants.map((variant) => variant.price.amount);
  const prices = sellablePrices.length > 0 ? sellablePrices : fallbackPrices;
  const currencyCode = variants[0]?.price.currency_code || "RUB";

  return {
    min: prices.length > 0 ? Math.min(...prices) : null,
    max: prices.length > 0 ? Math.max(...prices) : null,
    currency_code: currencyCode,
  };
}

function uniquePresent(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => value !== null))
  ).sort();
}

function readRequiredHandle(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) {
    throw new ProductDetailValidationError("Product handle is required.");
  }

  const handle = String(raw).trim();
  if (!handle) {
    throw new ProductDetailValidationError("Product handle is required.");
  }

  return handle;
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

module.exports = {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  productDetailInputFromMedusaRequest,
  queryProductDetail,
  queryProductDetailWithClient,
};
