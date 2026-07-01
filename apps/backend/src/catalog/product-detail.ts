const {
  loadCanonicalProducts,
  requireSalesChannelId,
} = require("./canonical");

type ProductDetailInput = {
  handle?: unknown;
};

type ProductDetailVariant = {
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
  return { handle: url.pathname.split("/").filter(Boolean).at(-1) };
}

async function queryProductDetail(
  scope: { resolve: (key: string) => unknown },
  input: ProductDetailInput,
  salesChannelIds: string[] = []
) {
  const handle = readRequiredHandle(input.handle);
  const salesChannelId = requireSalesChannelId(salesChannelIds);
  const products = await loadCanonicalProducts(scope, salesChannelId, {
    handle,
  });
  const product = products[0];
  if (!product) {
    throw new ProductDetailNotFoundError("product_detail_not_found");
  }
  if (product.status !== "published" || product.category?.is_active !== true) {
    throw new ProductDetailNotFoundError("product_detail_unpublished");
  }

  const variants = product.variants as ProductDetailVariant[];
  const sellableVariants = variants.filter(
    (variant) => variant.availability.is_sellable
  );
  const defaultVariant =
    variants.length === 1 && sellableVariants.length === 1
      ? sellableVariants[0]
      : null;

  return {
    handle: product.handle,
    title: product.title,
    description: product.description,
    media: product.media,
    category: {
      handle: product.category.handle,
      name: product.category.name,
    },
    product_type: product.product_type,
    option_dimensions: optionDimensionSummary(variants),
    variants,
    price_range: priceRangeForVariants(variants),
    requires_selection: variants.length > 1,
    default_variant_id: defaultVariant?.id || null,
    default_variant_sku: defaultVariant?.sku || null,
    selected_variant_id: defaultVariant?.id || null,
    selected_variant_sku: defaultVariant?.sku || null,
    visibility: {
      status: "published",
    },
  };
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
      values: uniquePresent(
        variants.map((variant) => variant.options.material)
      ),
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
  const validPrices = variants
    .map((variant) => variant.price.amount)
    .filter((amount) => Number.isInteger(amount) && amount >= 0);
  const prices = sellablePrices.length > 0 ? sellablePrices : validPrices;

  return {
    min: prices.length > 0 ? Math.min(...prices) : null,
    max: prices.length > 0 ? Math.max(...prices) : null,
    currency_code: variants[0]?.price.currency_code || "RUB",
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

module.exports = {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  productDetailInputFromMedusaRequest,
  queryProductDetail,
};
