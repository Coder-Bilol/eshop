const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = compileTypeScript;

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

const {
  ProductDetailFetchError,
  buildCartActionHandoff,
  fetchProductDetail,
  resolveVariantSelection,
} = require("../lib/product-detail.ts");
const { catalogProductVariantSummary } = require("../lib/catalog.ts");

const optionDimensions = [
  { name: "color", label: "Color", values: ["blue", "red"] },
  { name: "size_length", label: "Size/length", values: ["large", "small"] },
];

const configurableProduct = {
  option_dimensions: optionDimensions,
  variants: [
    variant("SKU-RED-SMALL", "red", "small", true),
    variant("SKU-RED-LARGE", "red", "large", false),
    variant("SKU-BLUE-LARGE", "blue", "large", true),
  ],
  requires_selection: true,
  default_variant_sku: null,
  selected_variant_sku: null,
};

async function run() {
  const missing = resolveVariantSelection(configurableProduct, {});
  assert.equal(missing.status, "missing_required_options");
  assert.deepEqual(missing.missingOptionNames, ["color", "size_length"]);
  assert.equal(missing.selectedVariant, null);
  assert.equal(missing.canAddToCart, false);

  const partial = resolveVariantSelection(configurableProduct, { color: "red" });
  assert.equal(partial.status, "missing_required_options");
  assert.deepEqual(partial.missingOptionNames, ["size_length"]);
  assert.equal(partial.matchingVariants.length, 2);
  assert.equal(partial.canAddToCart, false);

  const impossible = resolveVariantSelection(configurableProduct, {
    color: "blue",
    size_length: "small",
  });
  assert.equal(impossible.status, "impossible_combination");
  assert.equal(impossible.matchingVariants.length, 0);
  assert.equal(impossible.selectedVariant, null);
  assert.equal(impossible.canAddToCart, false);

  const unavailable = resolveVariantSelection(configurableProduct, {
    color: "red",
    size_length: "large",
  });
  assert.equal(unavailable.status, "unavailable_variant");
  assert.equal(unavailable.selectedVariant.sku, "SKU-RED-LARGE");
  assert.equal(unavailable.canAddToCart, false);

  const valid = resolveVariantSelection(configurableProduct, {
    color: "red",
    size_length: "small",
  });
  assert.equal(valid.status, "valid");
  assert.equal(valid.matchingVariants.length, 1);
  assert.equal(valid.selectedVariant.sku, "SKU-RED-SMALL");
  assert.equal(valid.canAddToCart, true);
  assert.deepEqual(buildCartActionHandoff("curtain-rod", valid), {
    product_handle: "curtain-rod",
    selected_variant_id: "variant_SKU-RED-SMALL",
    selected_variant_sku: "SKU-RED-SMALL",
    quantity: 1,
    validation_state: "valid",
  });
  assert.equal(buildCartActionHandoff("curtain-rod", missing), null);
  assert.equal(buildCartActionHandoff("curtain-rod", unavailable), null);

  const ambiguousProduct = {
    ...configurableProduct,
    variants: [
      variant("SKU-DUPLICATE-1", "red", "small", true),
      variant("SKU-DUPLICATE-2", "red", "small", true),
    ],
  };
  const ambiguous = resolveVariantSelection(ambiguousProduct, {
    color: "red",
    size_length: "small",
  });
  assert.equal(ambiguous.status, "impossible_combination");
  assert.equal(ambiguous.matchingVariants.length, 2);
  assert.equal(ambiguous.canAddToCart, false);

  const defaultProduct = {
    option_dimensions: [
      { name: "color", label: "Color", values: ["black"] },
    ],
    variants: [variant("SKU-DEFAULT", "black", null, true)],
    requires_selection: false,
    default_variant_sku: "SKU-DEFAULT",
    selected_variant_sku: "SKU-DEFAULT",
  };
  const defaultSelection = resolveVariantSelection(defaultProduct, {});
  assert.equal(defaultSelection.status, "valid");
  assert.equal(defaultSelection.selectedVariant.sku, "SKU-DEFAULT");
  assert.equal(defaultSelection.canAddToCart, true);

  const unavailableDefaultProduct = {
    ...defaultProduct,
    variants: [variant("SKU-DEFAULT", "black", null, false)],
  };
  const unavailableDefault = resolveVariantSelection(unavailableDefaultProduct, {});
  assert.equal(unavailableDefault.status, "unavailable_variant");
  assert.equal(unavailableDefault.canAddToCart, false);

  const oneSellableMultiVariant = {
    ...configurableProduct,
    variants: [
      variant("SKU-ONLY-SELLABLE", "red", "small", true),
      variant("SKU-UNAVAILABLE", "blue", "small", false),
    ],
  };
  const explicitSelection = resolveVariantSelection(oneSellableMultiVariant, {});
  assert.equal(explicitSelection.status, "missing_required_options");
  assert.equal(explicitSelection.selectedVariant, null);
  assert.equal(explicitSelection.canAddToCart, false);

  const noVariants = resolveVariantSelection(
    {
      option_dimensions: [],
      variants: [],
      requires_selection: false,
      default_variant_sku: null,
      selected_variant_sku: null,
    },
    {}
  );
  assert.equal(noVariants.status, "no_variants");
  assert.equal(noVariants.canAddToCart, false);

  const summary = catalogProductVariantSummary({
    variants: [
      catalogVariant("SKU-RED-SMALL", "red", "cotton", "small"),
      catalogVariant("SKU-BLUE-LARGE", "blue", "cotton", "large"),
    ],
  });
  assert.equal(summary.sku_count, 2);
  assert.deepEqual(summary.labels, [
    "Color: Blue, Red",
    "Material: Cotton",
    "Size: Large, Small",
  ]);

  await verifyProductDetailFetchContract();
  verifyProductDetailUiStates();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "product-detail",
        status: "ok",
        dataSource: "backend-contract-shaped-fixtures",
        assertions: [
          "missing required options cannot be added to cart",
          "impossible and ambiguous combinations cannot be added to cart",
          "exactly one sellable variant produces a valid selection",
          "unavailable variants cannot be added to cart",
          "single/default SKU products select deterministically",
          "multi-variant products do not auto-select the only sellable SKU",
          "products without a concrete SKU cannot be added to cart",
          "valid cart handoff includes product handle, SKU, quantity, and validation state",
          "product cards summarize backend-provided variant dimensions",
          "product detail fetch maps not-found and unpublished contract errors",
          "product detail media remains a string URL across the fetch boundary",
          "product detail route exposes required loading, selection, and handoff states",
        ],
      },
      null,
      2
    )}\n`
  );
}

function variant(sku, color, sizeLength, sellable) {
  return {
    id: `variant_${sku}`,
    sku,
    title: sku,
    price: {
      amount: 199900,
      currency_code: "RUB",
    },
    options: {
      color,
      material: null,
      size_length: sizeLength,
      mounting_method: null,
    },
    availability: {
      is_available: sellable,
      is_sellable: sellable,
      reason: sellable ? null : "unavailable",
    },
  };
}

function catalogVariant(sku, color, material, sizeLength) {
  return {
    sku,
    title: sku,
    price: {
      amount: 199900,
      currency_code: "RUB",
    },
    attributes: {
      color,
      material,
      size_length: sizeLength,
      mounting_method: null,
    },
  };
}

async function verifyProductDetailFetchContract() {
  const originalFetch = global.fetch;
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test_product_detail";
  const product = {
    handle: "curtain-rod",
    title: "Curtain rod",
    description: "A configurable product.",
    media: ["/seed/steel-telescopic-curtain-rod.svg"],
    category: {
      handle: "window",
      name: "Window",
    },
    product_type: "curtain_rod",
    option_dimensions: optionDimensions,
    variants: configurableProduct.variants,
    price_range: {
      min: 199900,
      max: 199900,
      currency_code: "RUB",
    },
    requires_selection: true,
    default_variant_sku: null,
    default_variant_id: null,
    selected_variant_sku: null,
    selected_variant_id: null,
    visibility: {
      status: "published",
    },
  };

  try {
    global.fetch = async (url, options) => {
      assert.match(String(url), /\/store\/product-detail\/curtain-rod$/);
      assert.equal(options.cache, "no-store");
      assert.equal(
        options.headers["x-publishable-api-key"],
        "pk_test_product_detail"
      );
      return new Response(JSON.stringify(product), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const fetched = await fetchProductDetail("curtain-rod");
    assert.equal(fetched.handle, "curtain-rod");
    assert.equal(fetched.variants.length, 3);
    assert.deepEqual(fetched.media, [
      "/seed/steel-telescopic-curtain-rod.svg",
    ]);

    global.fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "product_detail_unpublished",
            message: "Product detail is not published.",
            details: {},
          },
        }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        }
      );
    await assert.rejects(
      () => fetchProductDetail("hidden-product"),
      (error) =>
        error instanceof ProductDetailFetchError &&
        error.status === 404 &&
        error.code === "product_detail_unpublished"
    );
  } finally {
    global.fetch = originalFetch;
  }
}

function verifyProductDetailUiStates() {
  const appRoot = path.join(__dirname, "..", "app");
  const componentSource = fs.readFileSync(
    path.join(__dirname, "..", "components", "product-detail-selector.tsx"),
    "utf8"
  );
  const pageSource = fs.readFileSync(
    path.join(appRoot, "products", "[handle]", "page.tsx"),
    "utf8"
  );
  const loadingSource = fs.readFileSync(
    path.join(appRoot, "products", "[handle]", "loading.tsx"),
    "utf8"
  );
  const catalogSource = fs.readFileSync(path.join(appRoot, "page.tsx"), "utf8");

  for (const state of [
    "missing_required_options",
    "impossible_combination",
    "unavailable_variant",
    "valid",
    "no_variants",
    "cart-action-unavailable",
  ]) {
    assert.match(componentSource, new RegExp(state));
  }

  assert.match(pageSource, /product_detail_not_found/);
  assert.match(pageSource, /product_detail_unpublished/);
  assert.match(loadingSource, /Loading product details/);
  assert.match(catalogSource, /catalogProductVariantSummary/);
  assert.match(catalogSource, /View product/);
}

module.exports = { run };
