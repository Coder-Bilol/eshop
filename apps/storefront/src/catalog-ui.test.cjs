const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

const firstCatalogResponse = {
  products: [
    {
      handle: "fixture-dynamic-rod",
      title: "Fixture Dynamic Rod",
      description: "Backend supplied curtain fixture for render proof.",
      category: {
        handle: "curtain-rods",
        name: "Curtain rods",
      },
      product_type: "curtain_rod",
      price: {
        min: 120000,
        max: 160000,
        currency_code: "rub",
      },
      attributes: {
        color: "black",
        material: "wood",
        size_length: "160-300 cm",
        mounting_method: "wall",
      },
      has_optional_attribute_gap: false,
      variants: [
        {
          sku: "FIXTURE-ROD-BLACK",
          title: "Black wall rod",
          price: {
            amount: 120000,
            currency_code: "rub",
          },
          attributes: {
            color: "black",
            material: "wood",
            size_length: "160-300 cm",
            mounting_method: "wall",
          },
        },
      ],
    },
  ],
  categories: [
    {
      handle: "home-goods",
      name: "Home goods",
      parent_handle: null,
    },
    {
      handle: "curtain-rods",
      name: "Curtain rods",
      parent_handle: "home-goods",
    },
  ],
  filters: {
    selected: {
      category: "curtain-rods",
      q: "curtain",
      price_min: null,
      price_max: null,
      color: "black",
      material: "wood",
      size_length: "160-300 cm",
      product_type: "curtain_rod",
      mounting_method: "wall",
    },
    available: {
      category: [
        {
          handle: "home-goods",
          name: "Home goods",
          parent_handle: null,
        },
        {
          handle: "curtain-rods",
          name: "Curtain rods",
          parent_handle: "home-goods",
        },
      ],
      price: {
        min: 90000,
        max: 260000,
      },
      color: ["black", "brass"],
      material: ["wood", "steel"],
      size_length: ["160-300 cm"],
      product_type: ["curtain_rod"],
      mounting_method: ["wall"],
    },
  },
  pagination: {
    page: 2,
    limit: 4,
    total: 7,
    total_pages: 2,
    has_next: false,
    has_prev: true,
  },
  empty: false,
};

const emptyCatalogResponse = {
  ...firstCatalogResponse,
  products: [],
  filters: {
    ...firstCatalogResponse.filters,
    selected: {
      ...firstCatalogResponse.filters.selected,
      q: "no-match",
    },
  },
  pagination: {
    page: 1,
    limit: 4,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
  empty: true,
};

const missingAttributesCatalogResponse = {
  ...firstCatalogResponse,
  products: [
    {
      ...firstCatalogResponse.products[0],
      handle: "fixture-optional-gap",
      title: "Fixture Optional Gap",
      attributes: {
        color: null,
        material: null,
        size_length: null,
        mounting_method: null,
      },
      has_optional_attribute_gap: true,
      variants: [
        {
          ...firstCatalogResponse.products[0].variants[0],
          sku: "FIXTURE-OPTIONAL-GAP",
          attributes: {
            color: null,
            material: null,
            size_length: null,
            mounting_method: null,
          },
        },
      ],
    },
  ],
  filters: {
    ...firstCatalogResponse.filters,
    selected: {
      category: null,
      q: null,
      price_min: null,
      price_max: null,
      color: null,
      material: null,
      size_length: null,
      product_type: null,
      mounting_method: null,
    },
  },
  pagination: {
    page: 1,
    limit: 4,
    total: 1,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  },
  empty: false,
};

async function run() {
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://backend.test";
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test_catalog";

  const fetchCalls = [];
  const responses = [
    { ok: true, status: 200, body: firstCatalogResponse },
    { ok: true, status: 200, body: emptyCatalogResponse },
    { ok: true, status: 200, body: missingAttributesCatalogResponse },
    { ok: false, status: 503, body: null },
  ];
  global.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    const response = responses.shift();
    assert.ok(response, "unexpected catalog fetch");
    return {
      ok: response.ok,
      status: response.status,
      json: async () => structuredClone(response.body),
    };
  };

  const {
    buildCatalogHref,
    buildCatalogQueryParams,
    catalogProductVariantSummary,
    readSearchParam,
    selectedCatalogFilters,
  } = require("../lib/catalog.ts");
  const { default: HomePage } = require("../app/page.tsx");
  const { default: CatalogLoading } = require("../app/loading.tsx");

  assert.equal(readSearchParam({ q: [" curtain ", "ignored"] }, "q"), "curtain");
  assert.equal(readSearchParam({ q: "   " }, "q"), null);

  const normalizedQuery = buildCatalogQueryParams({
    category: " curtain-rods ",
    q: ["curtain", "ignored"],
    color: "",
    page: "2",
    unknown: "not-forwarded",
  });
  assert.equal(normalizedQuery.get("category"), "curtain-rods");
  assert.equal(normalizedQuery.get("q"), "curtain");
  assert.equal(normalizedQuery.get("color"), null);
  assert.equal(normalizedQuery.get("page"), "2");
  assert.equal(normalizedQuery.get("limit"), "4");
  assert.equal(normalizedQuery.get("unknown"), null);

  const updatedHref = new URL(
    buildCatalogHref(
      { category: "curtain-rods", q: "curtain", page: "3", limit: "8" },
      { color: "black", page: "1", q: null }
    ),
    "http://storefront.test"
  );
  assert.equal(updatedHref.searchParams.get("category"), "curtain-rods");
  assert.equal(updatedHref.searchParams.get("q"), null);
  assert.equal(updatedHref.searchParams.get("color"), "black");
  assert.equal(updatedHref.searchParams.get("page"), "1");
  assert.equal(updatedHref.searchParams.get("limit"), "8");

  const firstElement = await HomePage({
    searchParams: Promise.resolve({
      category: "curtain-rods",
      q: "curtain",
      color: "black",
      material: "wood",
      page: "2",
    }),
  });
  const firstHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, firstElement));

  assert.match(fetchCalls[0].url, /^http:\/\/backend\.test\/store\/catalog\?/);
  assert.match(fetchCalls[0].url, /category=curtain-rods/);
  assert.match(fetchCalls[0].url, /q=curtain/);
  assert.match(fetchCalls[0].url, /material=wood/);
  assert.match(fetchCalls[0].url, /limit=4/);
  assert.equal(fetchCalls[0].init.cache, "no-store");
  assert.equal(
    fetchCalls[0].init.headers["x-publishable-api-key"],
    "pk_test_catalog"
  );

  assert.match(firstHtml, /Fixture Dynamic Rod/);
  assert.match(firstHtml, /Curtain rods/);
  assert.match(firstHtml, /Home goods/);
  assert.match(firstHtml, /Color/);
  assert.match(firstHtml, /Material/);
  assert.match(firstHtml, /Size \/ length/);
  assert.match(firstHtml, /Product type/);
  assert.match(firstHtml, /Mounting/);
  assert.match(firstHtml, /Black/);
  assert.match(firstHtml, /Wood/);
  assert.match(firstHtml, /160-300 cm/);
  assert.match(firstHtml, /7 products from backend catalog/);
  assert.match(firstHtml, /Previous/);
  assert.match(firstHtml, /1 of 7/);
  assert.match(firstHtml, /Search<\/span>curtain/);
  assert.match(firstHtml, /Category<\/span>Curtain rods/);
  assert.match(firstHtml, /Color<\/span>Black/);

  const selectedState = selectedCatalogFilters(firstCatalogResponse);
  assert.deepEqual(
    selectedState.map((entry) => entry.label),
    [
      "Category",
      "Search",
      "Color",
      "Material",
      "Size / length",
      "Product type",
      "Mounting",
    ]
  );

  const secondElement = await HomePage({
    searchParams: Promise.resolve({
      q: "no-match",
      color: "black",
    }),
  });
  const secondHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, secondElement));
  assert.match(secondHtml, /No products match/);
  assert.match(secondHtml, /Change search, category, price, or filters/);

  const missingAttributesElement = await HomePage({
    searchParams: Promise.resolve({}),
  });
  const missingAttributesHtml = renderToStaticMarkup(
    React.createElement(React.Fragment, null, missingAttributesElement)
  );
  assert.match(missingAttributesHtml, /Fixture Optional Gap/);
  assert.match(missingAttributesHtml, /Some optional attributes are not set/);
  assert.doesNotMatch(missingAttributesHtml, /Color:/);
  assert.deepEqual(
    catalogProductVariantSummary(missingAttributesCatalogResponse.products[0]),
    {
      sku_count: 1,
      labels: [],
    }
  );

  const errorElement = await HomePage({
    searchParams: Promise.resolve({ q: "backend-error" }),
  });
  const errorHtml = renderToStaticMarkup(
    React.createElement(React.Fragment, null, errorElement)
  );
  assert.match(errorHtml, /Catalog is not available/);
  assert.match(errorHtml, /Catalog request failed with HTTP 503/);
  assert.doesNotMatch(errorHtml, /Catalog browser/);

  const loadingHtml = renderToStaticMarkup(
    React.createElement(CatalogLoading)
  );
  assert.match(loadingHtml, /Loading catalog/);
  assert.match(loadingHtml, /aria-busy="true"/);

  const pageSource = fs.readFileSync(path.join(__dirname, "..", "app", "page.tsx"), "utf8");
  assert.equal(pageSource.includes("steel-telescopic-curtain-rod"), false);
  assert.equal(pageSource.includes("wooden-classic-curtain-rod"), false);
  assert.equal(pageSource.includes("basic-home-hook-set"), false);

  if (process.env.ESHOP_CATALOG_TRACE_PATH) {
    fs.mkdirSync(path.dirname(process.env.ESHOP_CATALOG_TRACE_PATH), {
      recursive: true,
    });
    fs.writeFileSync(process.env.ESHOP_CATALOG_TRACE_PATH, firstHtml, "utf8");
  }

  if (process.env.ESHOP_CATALOG_EDGE_TRACE_PATH) {
    fs.mkdirSync(path.dirname(process.env.ESHOP_CATALOG_EDGE_TRACE_PATH), {
      recursive: true,
    });
    fs.writeFileSync(
      process.env.ESHOP_CATALOG_EDGE_TRACE_PATH,
      `<!doctype html><html><body>${loadingHtml}${secondHtml}${missingAttributesHtml}${errorHtml}</body></html>`,
      "utf8"
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "catalog",
        status: "ok",
        dataSource: "mocked-backend-catalog-contract",
        hardcodedCatalogSource: false,
        tracePath: process.env.ESHOP_CATALOG_TRACE_PATH || null,
        edgeTracePath: process.env.ESHOP_CATALOG_EDGE_TRACE_PATH || null,
        assertions: [
          "storefront requests backend store catalog route with explicit query params",
          "product cards render from backend response data",
          "category navigation is visible",
          "search input and required filters are visible",
          "selected filter state is visible",
          "pagination state is visible",
          "empty result state is visible",
          "backend error state is visible and does not render stale catalog UI",
          "missing optional attributes render without invented values",
          "route-level loading state is visible",
          "query-state helpers normalize supported params and preserve explicit overrides",
          "seeded catalog data is not embedded as UI source data",
        ],
      },
      null,
      2
    )}\n`
  );
}

module.exports = { run };
