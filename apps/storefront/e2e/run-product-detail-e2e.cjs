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
const outputDir = path.join(rootDir, ".tasks", "TASK-014", "playwright");
const backendPort = Number(process.env.ESHOP_E2E_BACKEND_PORT || "9114");
const storefrontPort = Number(
  process.env.ESHOP_E2E_STOREFRONT_PORT || "3114"
);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const storefrontUrl = `http://127.0.0.1:${storefrontPort}`;
const progressLogPath = path.join(outputDir, "product-detail-progress.log");

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
  fs.writeFileSync(progressLogPath, "", "utf8");
  logStep("checking ports");
  await assertPortsAvailable();
  logStep("seeding catalog");
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
    logStep("starting backend harness");
    await listen(backendServer, backendPort);

    logStep("preparing next app");
    nextApp = next({
      dev: true,
      dir: storefrontDir,
      hostname: "127.0.0.1",
      port: storefrontPort,
    });
    await nextApp.prepare();
    logStep("starting storefront server");
    storefrontServer = http.createServer(nextApp.getRequestHandler());
    await listen(storefrontServer, storefrontPort);

    logStep("launching browser");
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

    logStep("verifying catalog card variant summary");
    await verifyCatalogCardVariantSummary(page);
    logStep("verifying configurable product detail");
    await verifyConfigurableProductDetail(page);
    logStep("verifying default SKU product detail");
    await verifyDefaultSkuProduct(page);

    logStep("stopping trace");
    await context.tracing.stop({
      path: path.join(outputDir, "product-detail-trace.zip"),
    });
    traceStopped = true;

    writeRuntimeEvidence();
    logStep("product-detail e2e complete");
    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "product-detail-e2e",
          status: "ok",
          browser: process.env.PLAYWRIGHT_CHANNEL || "msedge",
          dataSource: "seeded-backend-postgresql",
          backendHarness: "apps/backend/test/catalog-e2e-server.cjs",
          storefrontRuntime: "next-dev",
          productionData: false,
          trace: ".tasks/TASK-014/playwright/product-detail-trace.zip",
          screenshots: [
            ".tasks/TASK-014/playwright/product-detail-handoff.png",
            ".tasks/TASK-014/playwright/product-detail-default-sku.png",
          ],
          assertions: [
            "product card variant summary is rendered from backend catalog data",
            "product detail starts with missing required options and disabled add-to-cart",
            "impossible variant combinations stay blocked",
            "unavailable variants stay blocked",
            "valid selected variant reaches the narrow cart-action handoff",
            "single/default SKU product can reach the same handoff without durable cart persistence",
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
          path: path.join(outputDir, "product-detail-failure.png"),
          fullPage: true,
        })
        .catch(() => {});
    }
    throw error;
  } finally {
    logStep("cleanup started");
    if (context && !traceStopped) {
      await context.tracing
        .stop({ path: path.join(outputDir, "product-detail-failure-trace.zip") })
        .catch(() => {});
    }
    if (browser) {
      await withTimeout(browser.close(), 1_000).catch(() => {});
    }
    await closeServer(storefrontServer);
    await closeServer(backendServer);
    logStep("cleanup complete");
  }
}

async function verifyCatalogCardVariantSummary(page) {
  const query = new URLSearchParams({ category: "curtain-rods", limit: "20" });
  const catalog = await readBackendCatalog(query);
  const product = catalog.products.find(
    (item) => item.handle === "steel-telescopic-curtain-rod"
  );
  assert.ok(product, "seeded configurable product was not returned");
  assert.ok(product.variants.length >= 2);

  await page.goto(`${storefrontUrl}/?${query.toString()}`);
  await visible(page.getByRole("heading", { name: "Home goods" }));

  const card = page.locator("article.productCard").filter({
    has: page.getByRole("link", {
      name: product.title,
      exact: true,
    }),
  });
  await visible(card);
  await visible(
    card.getByText(`${product.variants.length} SKUs`, { exact: true })
  );
  await visible(card.getByText("Color: Black, Brass", { exact: true }));
  await visible(card.getByText("Material: Aluminum, Steel", { exact: true }));
  await visible(
    card.getByText("Size: 160 300 cm, 300 500 cm", { exact: true })
  );
}

async function verifyConfigurableProductDetail(page) {
  const product = await readBackendProductDetail(
    "steel-telescopic-curtain-rod"
  );
  assert.equal(product.requires_selection, true);
  assert.equal(product.default_variant_sku, null);

  await page.goto(`${storefrontUrl}/products/${product.handle}`);
  await visible(page.getByRole("heading", { name: product.title }));
  await visible(page.getByText("Select all required options", { exact: true }));
  await assertAddToCartDisabled(page);

  await chooseOption(page, "Black");
  await chooseOption(page, "Aluminum");
  await chooseOption(page, "160 300 cm");
  await visible(
    page.getByText("This combination is not available", { exact: true })
  );
  await assertAddToCartDisabled(page);

  await chooseOption(page, "Brass");
  await chooseOption(page, "300 500 cm");
  await visible(page.getByText("Selected variant is unavailable", { exact: true }));
  await visible(page.getByText("CR-STL-BRS-300-500 cannot be added.", { exact: true }));
  await assertAddToCartDisabled(page);

  await chooseOption(page, "Black");
  await chooseOption(page, "Steel");
  await chooseOption(page, "160 300 cm");
  await visible(page.getByText("Variant is available", { exact: true }));
  await visible(page.getByText("CR-STL-BLK-160-300 is ready to add.", { exact: true }));
  await assertAddToCartEnabled(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await visible(page.getByText("Cart is temporarily unavailable", { exact: true }));
  await visible(
    page.getByText(
      "CR-STL-BLK-160-300, quantity 1, was not added. Try again later.",
      { exact: true }
    )
  );
  await page.screenshot({
    path: path.join(outputDir, "product-detail-handoff.png"),
    fullPage: true,
  });
}

async function verifyDefaultSkuProduct(page) {
  const product = await readBackendProductDetail("basic-home-hook-set");
  assert.equal(product.requires_selection, false);
  assert.equal(product.selected_variant_sku, "HG-HOOK-BASIC");

  await page.goto(`${storefrontUrl}/products/${product.handle}`);
  await visible(page.getByRole("heading", { name: product.title }));
  await visible(page.getByText("Variant is available", { exact: true }));
  await visible(page.getByText("HG-HOOK-BASIC is ready to add.", { exact: true }));
  await assertAddToCartEnabled(page);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await visible(page.getByText("Cart is temporarily unavailable", { exact: true }));
  await visible(
    page.getByText(
      "HG-HOOK-BASIC, quantity 1, was not added. Try again later.",
      { exact: true }
    )
  );
  await page.screenshot({
    path: path.join(outputDir, "product-detail-default-sku.png"),
    fullPage: true,
  });
}

async function readBackendCatalog(query) {
  const response = await fetch(
    `${backendUrl}/store/catalog?${query.toString()}`
  );
  assert.equal(response.ok, true, `backend catalog returned HTTP ${response.status}`);
  return response.json();
}

async function readBackendProductDetail(handle) {
  const response = await fetch(
    `${backendUrl}/store/product-detail/${encodeURIComponent(handle)}`
  );
  assert.equal(
    response.ok,
    true,
    `backend product detail returned HTTP ${response.status}`
  );
  return response.json();
}

async function chooseOption(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function assertAddToCartDisabled(page) {
  await assertAddToCartState(page, true);
}

async function assertAddToCartEnabled(page) {
  await assertAddToCartState(page, false);
}

async function assertAddToCartState(page, disabled) {
  const button = page.getByRole("button", { name: "Add to cart" });
  await visible(button);
  assert.equal(await button.isDisabled(), disabled);
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
      ["Product detail seed failed.", result.stdout, result.stderr]
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

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, 1_000);
    server.closeAllConnections?.();
    server.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function writeRuntimeEvidence() {
  fs.writeFileSync(
    path.join(outputDir, "product-detail-servers.log"),
    [
      `backend=${backendUrl}`,
      `storefront=${storefrontUrl}`,
      "backend_source=seeded-backend-postgresql",
      "storefront_runtime=next-dev",
      "production_data=false",
      "durable_cart_persistence=false",
      "",
    ].join("\n"),
    "utf8"
  );
}

function logStep(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(progressLogPath, line, "utf8");
  process.stdout.write(line);
}

module.exports = { main };

if (require.main === module) {
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
}
