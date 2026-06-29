const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const {
  checkPort,
  childEnv,
  runNpmSync,
} = require("../../../scripts/local-runtime.cjs");

const rootDir = path.resolve(__dirname, "..", "..", "..");
const storefrontDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, ".tasks", "TASK-009", "playwright");
const backendPort = Number(process.env.ESHOP_E2E_BACKEND_PORT || "9109");
const storefrontPort = Number(
  process.env.ESHOP_E2E_STOREFRONT_PORT || "3109"
);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const storefrontUrl = `http://127.0.0.1:${storefrontPort}`;

Object.assign(
  process.env,
  childEnv({
    BACKEND_PORT: String(backendPort),
    LOCAL_BACKEND_URL: backendUrl,
    LOCAL_STOREFRONT_URL: storefrontUrl,
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: backendUrl,
    PORT: String(backendPort),
    STOREFRONT_PORT: String(storefrontPort),
  })
);

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  await assertPortsAvailable();
  seedCatalog();

  const { createCatalogE2EServer } = require(path.join(
    rootDir,
    "apps",
    "backend",
    "test",
    "catalog-e2e-server.cjs"
  ));
  const next = require("next");
  const backendServer = createCatalogE2EServer();
  let storefrontServer;
  let nextApp;
  let browser;
  let context;
  let traceStopped = false;

  try {
    await listen(backendServer, backendPort);

    nextApp = next({
      dev: true,
      dir: storefrontDir,
      hostname: "127.0.0.1",
      port: storefrontPort,
    });
    await nextApp.prepare();
    storefrontServer = http.createServer(nextApp.getRequestHandler());
    await listen(storefrontServer, storefrontPort);

    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    });
    context = await browser.newContext();
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    const page = await context.newPage();

    await verifyBrowseAndOptionalAttributes(page);
    await verifyFilters(page);
    await verifyEmptyState(page);

    await page.screenshot({
      path: path.join(outputDir, "catalog-empty-state.png"),
      fullPage: true,
    });
    await context.tracing.stop({
      path: path.join(outputDir, "catalog-trace.zip"),
    });
    traceStopped = true;

    writeRuntimeEvidence();
    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "catalog-e2e",
          status: "ok",
          browser: process.env.PLAYWRIGHT_CHANNEL || "msedge",
          dataSource: "seeded-backend-postgresql",
          backendHarness: "apps/backend/test/catalog-e2e-server.cjs",
          storefrontRuntime: "next-dev",
          productionData: false,
          trace: ".tasks/TASK-009/playwright/catalog-trace.zip",
          screenshot:
            ".tasks/TASK-009/playwright/catalog-empty-state.png",
          assertions: [
            "catalog browse mirrors backend results",
            "category browse narrows seeded products",
            "search narrows seeded products",
            "price, color, material, size/length, product type, and mounting filters narrow seeded products",
            "combined search and filters narrow seeded products",
            "empty result renders without backend error state",
            "missing optional attributes render safely",
          ],
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    const firstPage = context?.pages().at(0);
    if (firstPage) {
      await firstPage
        .screenshot({
          path: path.join(outputDir, "catalog-failure.png"),
          fullPage: true,
        })
        .catch(() => {});
    }
    throw error;
  } finally {
    if (context && !traceStopped) {
      await context.tracing
        .stop({ path: path.join(outputDir, "catalog-failure-trace.zip") })
        .catch(() => {});
    }
    void browser?.close().catch(() => {});
  }
}

async function verifyBrowseAndOptionalAttributes(page) {
  const query = new URLSearchParams({ limit: "20" });
  const catalog = await readBackendCatalog(query);

  assert.ok(
    catalog.products.some((product) => product.handle.includes("curtain"))
  );
  assert.ok(
    catalog.products.some(
      (product) => product.handle === "basic-home-hook-set"
    )
  );

  await page.goto(`${storefrontUrl}/?${query.toString()}`);
  await visible(page.getByRole("heading", { name: "Home goods" }));
  await browserMatchesBackend(page, catalog);
  await visible(page.getByText("Some optional attributes are not set"));

  for (const name of [
    "color",
    "material",
    "size_length",
    "product_type",
    "mounting_method",
  ]) {
    await visible(page.locator(`select[name="${name}"]`));
  }
  await visible(page.locator('input[name="price_min"]'));
  await visible(page.locator('input[name="price_max"]'));
  await visible(page.locator('input[name="q"]'));
}

async function verifyFilters(page) {
  const cases = [
    [
      "category browse",
      { category: "curtain-rods" },
      "steel-telescopic-curtain-rod",
    ],
    ["search", { q: "wooden" }, "wooden-classic-curtain-rod"],
    [
      "price range",
      { price_min: "240000", price_max: "250000" },
      "steel-telescopic-curtain-rod",
    ],
    ["color", { color: "black" }, "steel-telescopic-curtain-rod"],
    ["material", { material: "wood" }, "wooden-classic-curtain-rod"],
    ["size or length", { size_length: "200 cm" }, "wooden-classic-curtain-rod"],
    [
      "product type",
      { product_type: "curtain_track" },
      "ceiling-aluminum-curtain-track",
    ],
    [
      "mounting method",
      { mounting_method: "ceiling" },
      "ceiling-aluminum-curtain-track",
    ],
    [
      "combined search and filters",
      { q: "curtain", category: "curtain-rods", material: "wood" },
      "wooden-classic-curtain-rod",
    ],
  ];

  for (const [name, params, expectedHandle] of cases) {
    const query = new URLSearchParams({ ...params, limit: "20" });
    const catalog = await readBackendCatalog(query);

    assert.equal(catalog.empty, false, `${name} unexpectedly returned empty`);
    assert.ok(
      catalog.products.some((product) => product.handle === expectedHandle),
      `${name} did not return ${expectedHandle}`
    );

    await page.goto(`${storefrontUrl}/?${query.toString()}`);
    await browserMatchesBackend(page, catalog);
  }
}

async function verifyEmptyState(page) {
  const query = new URLSearchParams({
    q: "no-such-product",
    color: "black",
    limit: "20",
  });
  const catalog = await readBackendCatalog(query);

  assert.equal(catalog.empty, true);
  assert.deepEqual(catalog.products, []);

  await page.goto(`${storefrontUrl}/?${query.toString()}`);
  await browserMatchesBackend(page, catalog);
  await visible(page.getByRole("heading", { name: "No products match" }));
  assert.equal(
    await page
      .getByRole("heading", { name: "Catalog is not available" })
      .count(),
    0
  );
}

async function readBackendCatalog(query) {
  const response = await fetch(
    `${backendUrl}/store/catalog?${query.toString()}`
  );
  assert.equal(response.ok, true, `backend returned HTTP ${response.status}`);
  return response.json();
}

async function browserMatchesBackend(page, catalog) {
  await visible(
    page.getByText(
      `${catalog.pagination.total} products from backend catalog`,
      { exact: true }
    )
  );

  for (const product of catalog.products) {
    await visible(
      page.getByRole("link", { name: product.title, exact: true })
    );
  }
}

async function visible(locator) {
  await locator.first().waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await locator.first().isVisible(), true);
}

async function assertPortsAvailable() {
  for (const port of [backendPort, storefrontPort]) {
    const result = await checkPort("127.0.0.1", port);
    assert.equal(
      result.available,
      true,
      `E2E port ${port} is already in use`
    );
  }
}

function seedCatalog() {
  const result = runNpmSync([
    "--workspace",
    "apps/backend",
    "run",
    "db:seed",
  ]);
  if (result.status !== 0) {
    throw new Error(
      ["Catalog seed failed.", result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
    );
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function writeRuntimeEvidence() {
  fs.writeFileSync(
    path.join(outputDir, "catalog-servers.log"),
    [
      `backend=${backendUrl}`,
      `storefront=${storefrontUrl}`,
      "backend_source=seeded-backend-postgresql",
      "storefront_runtime=next-dev",
      "production_data=false",
      "",
    ].join("\n"),
    "utf8"
  );
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(
      error && (error.stack || error.message)
        ? error.stack || error.message
        : error
    );
    process.exit(1);
  }
);
