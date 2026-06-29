export type ProductDetailOptionDimension = {
  name: string;
  label: string;
  values: string[];
};

export type ProductDetailVariant = {
  sku: string;
  title: string;
  options: Record<string, string | null>;
  price: {
    amount: number;
    currency_code: string;
  };
  availability: {
    is_available: boolean;
    is_sellable: boolean;
    reason: string | null;
  };
};

export type ProductDetailSelectionSource = {
  option_dimensions: ProductDetailOptionDimension[];
  variants: ProductDetailVariant[];
  requires_selection: boolean;
  default_variant_sku: string | null;
  selected_variant_sku: string | null;
};

export type ProductDetail = ProductDetailSelectionSource & {
  handle: string;
  title: string;
  description: string;
  media: string[];
  category: {
    handle: string;
    name: string;
  };
  product_type: string;
  price_range: {
    min: number | null;
    max: number | null;
    currency_code: string;
  };
  visibility: {
    status: "published";
  };
};

export type VariantSelectionStatus =
  | "missing_required_options"
  | "impossible_combination"
  | "unavailable_variant"
  | "valid"
  | "no_variants";

export type VariantSelectionResult = {
  status: VariantSelectionStatus;
  missingOptionNames: string[];
  matchingVariants: ProductDetailVariant[];
  selectedVariant: ProductDetailVariant | null;
  canAddToCart: boolean;
};

export type CartActionHandoff = {
  product_handle: string;
  selected_variant_sku: string;
  quantity: 1;
  validation_state: "valid";
};

const DEFAULT_BACKEND_URL = "http://localhost:9000";

export class ProductDetailFetchError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ProductDetailFetchError";
    this.status = status;
    this.code = code;
  }
}

export async function fetchProductDetail(handle: string): Promise<ProductDetail> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/store/product-detail/${encodeURIComponent(handle)}`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    }
  );
  const body = (await response.json().catch(() => null)) as
    | ProductDetail
    | {
        error?: {
          code?: string;
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    const contractError = body && "error" in body ? body.error : undefined;
    throw new ProductDetailFetchError(
      response.status,
      contractError?.code || "product_detail_request_failed",
      contractError?.message ||
        `Product detail request failed with HTTP ${response.status}.`
    );
  }

  if (!body || !("handle" in body)) {
    throw new ProductDetailFetchError(
      502,
      "product_detail_invalid_response",
      "Product detail response is invalid."
    );
  }

  return body;
}

export function resolveVariantSelection(
  product: ProductDetailSelectionSource,
  selection: Record<string, string | null | undefined>
): VariantSelectionResult {
  const selectedOptions = normalizeSelection(selection);
  const optionNames = new Set(
    product.option_dimensions.map((dimension) => dimension.name)
  );
  const hasUnknownOption = Object.keys(selectedOptions).some(
    (name) => !optionNames.has(name)
  );

  if (product.variants.length === 0) {
    return result("no_variants");
  }

  if (
    product.variants.length === 1 &&
    !product.requires_selection &&
    Object.keys(selectedOptions).length === 0
  ) {
    const defaultVariant = resolveSingleDefaultVariant(product);
    if (!defaultVariant) {
      return result("impossible_combination");
    }
    return selectedResult(defaultVariant);
  }

  const requiredOptionNames = requiredOptions(product);
  const missingOptionNames = requiredOptionNames.filter(
    (name) => selectedOptions[name] === undefined
  );
  const matchingVariants = hasUnknownOption
    ? []
    : product.variants.filter((variant) =>
        matchesSelection(variant, selectedOptions)
      );

  if (matchingVariants.length === 0) {
    return result("impossible_combination", {
      missingOptionNames,
      matchingVariants,
    });
  }

  if (missingOptionNames.length > 0) {
    return result("missing_required_options", {
      missingOptionNames,
      matchingVariants,
    });
  }

  if (matchingVariants.length !== 1) {
    return result("impossible_combination", { matchingVariants });
  }

  return selectedResult(matchingVariants[0]);
}

function normalizeSelection(
  selection: Record<string, string | null | undefined>
) {
  const normalized: Record<string, string> = {};

  for (const [name, value] of Object.entries(selection)) {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (text) {
      normalized[name] = text;
    }
  }

  return normalized;
}

function requiredOptions(product: ProductDetailSelectionSource) {
  if (product.variants.length <= 1) {
    return [];
  }

  return product.option_dimensions
    .map((dimension) => dimension.name)
    .filter((name) => {
      const values = new Set(
        product.variants.map((variant) => variant.options[name] ?? null)
      );
      return values.size > 1;
    });
}

function matchesSelection(
  variant: ProductDetailVariant,
  selection: Record<string, string>
) {
  return Object.entries(selection).every(
    ([name, value]) => variant.options[name] === value
  );
}

function resolveSingleDefaultVariant(product: ProductDetailSelectionSource) {
  const declaredSku =
    product.default_variant_sku || product.selected_variant_sku;

  if (!declaredSku) {
    return product.variants[0];
  }

  return product.variants.find((variant) => variant.sku === declaredSku) || null;
}

function selectedResult(
  selectedVariant: ProductDetailVariant
): VariantSelectionResult {
  const canAddToCart =
    selectedVariant.availability.is_available &&
    selectedVariant.availability.is_sellable;

  return result(canAddToCart ? "valid" : "unavailable_variant", {
    matchingVariants: [selectedVariant],
    selectedVariant,
    canAddToCart,
  });
}

export function buildCartActionHandoff(
  productHandle: string,
  selection: VariantSelectionResult
): CartActionHandoff | null {
  if (
    selection.status !== "valid" ||
    !selection.canAddToCart ||
    !selection.selectedVariant
  ) {
    return null;
  }

  return {
    product_handle: productHandle,
    selected_variant_sku: selection.selectedVariant.sku,
    quantity: 1,
    validation_state: "valid",
  };
}

function result(
  status: VariantSelectionStatus,
  overrides: Partial<VariantSelectionResult> = {}
): VariantSelectionResult {
  return {
    status,
    missingOptionNames: [],
    matchingVariants: [],
    selectedVariant: null,
    canAddToCart: false,
    ...overrides,
  };
}
