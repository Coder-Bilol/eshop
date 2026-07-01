const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const {
  checkPort,
  childEnv,
  extractJsonFromOutput,
  runNpmSync,
} = require("../../../scripts/local-runtime.cjs");

const rootDir = path.resolve(__dirname, "..", "..", "..");
const backendDir = path.join(rootDir, "apps", "backend");
const compiledBackendDir = path.join(backendDir, ".medusa", "server");
const storefrontDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, ".tasks", "TASK-016", "playwright");
const backendPort = Number(process.env.ESHOP_E2E_BACKEND_PORT || "9116");
const storefrontPort = Number(
  process.env.ESHOP_E2E_STOREFRONT_PORT || "3116"
);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const storefrontUrl = `http://127.0.0.1:${storefrontPort}`;
const backendLogPath = path.join(outputDir, "medusa-backend.log");
const progressLogPath = path.join(outputDir, "real-runtime-progress.log");
const selectedSuites = selectSuites(process.argv.slice(2));

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(progressLogPath, "", "utf8");
  await assertPortsAvailable();

  logStep("building real Medusa backend");
  runRequiredNpm(["--workspace", "apps/backend", "run", "build"]);
  logStep("seeding canonical Medusa catalog");
  const seed = runRequiredNpm([
    "--workspace",
    "apps/backend",
    "run",
    "seed:medusa:catalog",
  ]);
  const seedSummary = extractJsonFromOutput(seed.stdout);
  const publishableKey = seedSummary?.publishable_api_key;
  assert.match(
    publishableKey || "",
    /^pk_/,
    "canonical seed did not return a publishable API key"
  );

  Object.assign(
    process.env,
    childEnv({
      BACKEND_PORT: String(backendPort),
      LOCAL_BACKEND_URL: backendUrl,
      LOCAL_STOREFRONT_URL: storefrontUrl,
      NEXT_PUBLIC_MEDUSA_BACKEND_URL: backendUrl,
      NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: publishableKey,
      PORT: String(backendPort),
      STOREFRONT_PORT: String(storefrontPort),
    })
  );

  const backend = startBackend();
  let storefrontServer;
  let browser;
  let context;
  let traceStopped = false;
  let noKeyStatus;

  try {
    logStep("waiting for compiled Medusa health endpoint");
    await waitForHttp(`${backendUrl}/health`, 90_000);
    noKeyStatus = await verifyPublishableKeyBoundary(publishableKey);

    logStep("preparing Next.js storefront");
    const next = require("next");
    const nextApp = next({
      dev: true,
      dir: storefrontDir,
      hostname: "127.0.0.1",
      port: storefrontPort,
    });
    await nextApp.prepare();
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

    if (selectedSuites.includes("catalog")) {
      await verifyCatalog(page, publishableKey);
    }
    if (selectedSuites.includes("product-detail")) {
      await verifyProductDetail(page, publishableKey);
    }

    await context.tracing.stop({
      path: path.join(outputDir, "real-medusa-trace.zip"),
    });
    traceStopped = true;
  } catch (error) {
    const page = context?.pages().at(0);
    await page
      ?.screenshot({
        path: path.join(outputDir, "real-medusa-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  } finally {
    logStep("cleanup started");
    if (context && !traceStopped) {
      await context.tracing
        .stop({
          path: path.join(outputDir, "real-medusa-failure-trace.zip"),
        })
        .catch(() => {});
    }
    logStep("closing browser");
    if (browser) {
      await withTimeout(browser.close(), 5_000).catch(() => {});
    }
    logStep("closing storefront server");
    await closeServer(storefrontServer);
    logStep("stopping Medusa backend");
    await stopChild(backend);
    logStep("checking released ports");
    await waitForPortsReleased();
    logStep("cleanup complete");
  }

  writeRuntimeEvidence(noKeyStatus, publishableKey);
  process.stdout.write(
    `${JSON.stringify(
      {
        command: "test:e2e",
        status: "ok",
        suites: selectedSuites,
        browser: process.env.PLAYWRIGHT_CHANNEL || "msedge",
        backendRuntime: "compiled-medusa-start",
        backendHarness: null,
        dataSource: "canonical-medusa-postgresql",
        publishableKeyBoundary: {
          withoutKeyStatus: noKeyStatus,
          withKeyStatus: 200,
        },
        variantIdentity: "medusa-product-variant-id",
        trace: ".tasks/TASK-016/playwright/real-medusa-trace.zip",
        screenshots: selectedSuites.map(
          (suite) => `.tasks/TASK-016/playwright/${suite}.png`
        ),
        processCleanup: "ports-released",
        productionData: false,
      },
      null,
      2
    )}\n`
  );
}

async function verifyCatalog(page, publishableKey) {
  logStep("verifying catalog through Medusa Store API");
  const baseQuery = new URLSearchParams({ limit: "20" });
  const base = await readCatalog(baseQuery, publishableKey);
  assert.equal(base.products.length, 5);
  assert.ok(
    base.products.every((product) =>
      product.variants.every((variant) => variant.id.startsWith("variant_"))
    )
  );

  await page.goto(`${storefrontUrl}/?${baseQuery.toString()}`);
  await visible(page.getByRole("heading", { name: "Home goods" }));
  await browserMatchesCatalog(page, base);
  await visible(page.getByText("Some optional attributes are not set"));

  const cases = [
    [{ category: "curtain-rods" }, "steel-telescopic-curtain-rod"],
    [{ q: "wooden" }, "wooden-classic-curtain-rod"],
    [
      { price_min: "240000", price_max: "250000" },
      "steel-telescopic-curtain-rod",
    ],
    [{ color: "black" }, "steel-telescopic-curtain-rod"],
    [{ material: "wood" }, "wooden-classic-curtain-rod"],
    [{ size_length: "200 cm" }, "wooden-classic-curtain-rod"],
    [{ product_type: "curtain_track" }, "ceiling-aluminum-curtain-track"],
    [{ mounting_method: "ceiling" }, "ceiling-aluminum-curtain-track"],
    [
      { q: "curtain", category: "curtain-rods", material: "wood" },
      "wooden-classic-curtain-rod",
    ],
  ];
  for (const [params, expectedHandle] of cases) {
    const query = new URLSearchParams({ ...params, limit: "20" });
    const catalog = await readCatalog(query, publishableKey);
    assert.ok(
      catalog.products.some((product) => product.handle === expectedHandle)
    );
    await page.goto(`${storefrontUrl}/?${query.toString()}`);
    await browserMatchesCatalog(page, catalog);
  }

  const emptyQuery = new URLSearchParams({
    q: "no-such-product",
    color: "black",
    limit: "20",
  });
  const empty = await readCatalog(emptyQuery, publishableKey);
  assert.equal(empty.empty, true);
  await page.goto(`${storefrontUrl}/?${emptyQuery.toString()}`);
  await visible(page.getByRole("heading", { name: "No products match" }));
  await page.screenshot({
    path: path.join(outputDir, "catalog.png"),
    fullPage: true,
  });
}

async function verifyProductDetail(page, publishableKey) {
  logStep("verifying product detail through Medusa Store API");
  const product = await readProductDetail(
    "steel-telescopic-curtain-rod",
    publishableKey
  );
  assert.equal(product.requires_selection, true);
  assert.ok(product.variants.every((variant) => variant.id.startsWith("variant_")));

  await page.goto(`${storefrontUrl}/products/${product.handle}`);
  await visible(page.getByRole("heading", { name: product.title }));
  await visible(page.getByText("Select all required options", { exact: true }));
  await assertAddToCartState(page, true);

  await chooseOption(page, "Black");
  await chooseOption(page, "Aluminum");
  await chooseOption(page, "160 300 cm");
  await visible(
    page.getByText("This combination is not available", { exact: true })
  );

  await chooseOption(page, "Brass");
  await chooseOption(page, "300 500 cm");
  await visible(
    page.getByText("Selected variant is unavailable", { exact: true })
  );
  await assertAddToCartState(page, true);

  await chooseOption(page, "Black");
  await chooseOption(page, "Steel");
  await chooseOption(page, "160 300 cm");
  await visible(page.getByText("Variant is available", { exact: true }));
  await assertAddToCartState(page, false);
  await page.getByRole("button", { name: "Add to cart" }).click();
  const handoff = page.locator(
    '[data-handoff-state="cart-action-unavailable"]'
  );
  await visible(handoff);
  const selectedVariant = product.variants.find(
    (variant) => variant.sku === "CR-STL-BLK-160-300"
  );
  assert.equal(
    await handoff.getAttribute("data-selected-variant-id"),
    selectedVariant.id
  );

  const defaultProduct = await readProductDetail(
    "basic-home-hook-set",
    publishableKey
  );
  assert.equal(defaultProduct.default_variant_id, defaultProduct.variants[0].id);
  await page.goto(`${storefrontUrl}/products/${defaultProduct.handle}`);
  await visible(page.getByText("Variant is available", { exact: true }));
  await assertAddToCartState(page, false);
  await page.getByRole("button", { name: "Add to cart" }).click();
  const defaultHandoff = page.locator(
    '[data-handoff-state="cart-action-unavailable"]'
  );
  await visible(defaultHandoff);
  assert.equal(
    await defaultHandoff.getAttribute("data-selected-variant-id"),
    defaultProduct.variants[0].id
  );

  await page.screenshot({
    path: path.join(outputDir, "product-detail.png"),
    fullPage: true,
  });
}

async function verifyPublishableKeyBoundary(publishableKey) {
  const noKey = await fetch(`${backendUrl}/store/catalog?limit=1`);
  assert.notEqual(noKey.status, 200, "Store API accepted a missing key");
  const withKey = await fetch(`${backendUrl}/store/catalog?limit=1`, {
    headers: { "x-publishable-api-key": publishableKey },
  });
  assert.equal(withKey.status, 200, "Store API rejected the seeded key");
  return noKey.status;
}

async function readCatalog(query, publishableKey) {
  const response = await fetch(
    `${backendUrl}/store/catalog?${query.toString()}`,
    { headers: { "x-publishable-api-key": publishableKey } }
  );
  assert.equal(response.ok, true, `catalog returned HTTP ${response.status}`);
  return response.json();
}

async function readProductDetail(handle, publishableKey) {
  const response = await fetch(
    `${backendUrl}/store/product-detail/${encodeURIComponent(handle)}`,
    { headers: { "x-publishable-api-key": publishableKey } }
  );
  assert.equal(
    response.ok,
    true,
    `product detail returned HTTP ${response.status}`
  );
  return response.json();
}

async function browserMatchesCatalog(page, catalog) {
  await visible(
    page.getByText(
      `${catalog.pagination.total} products from backend catalog`,
      { exact: true }
    )
  );
  for (const product of catalog.products) {
    await visible(page.getByRole("link", { name: product.title, exact: true }));
  }
}

async function chooseOption(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function assertAddToCartState(page, disabled) {
  const button = page.getByRole("button", { name: "Add to cart" });
  await visible(button);
  assert.equal(await button.isDisabled(), disabled);
}

async function visible(locator) {
  await locator.first().waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await locator.first().isVisible(), true);
}

function startBackend() {
  fs.writeFileSync(backendLogPath, "", "utf8");
  const log = fs.createWriteStream(backendLogPath, { flags: "a" });
  const medusaCli = require.resolve("@medusajs/cli/cli");
  const child = spawn(process.execPath, [medusaCli, "start"], {
    cwd: compiledBackendDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.once("exit", (code) => {
    log.end(`[exit] code=${code}\n`);
  });
  return child;
}

function runRequiredNpm(args) {
  const result = runNpmSync(args);
  if (result.status !== 0) {
    throw new Error(
      [`npm ${args.join(" ")} failed`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
    );
  }
  return result;
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_error) {
      // Startup is still in progress.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function assertPortsAvailable() {
  for (const port of [backendPort, storefrontPort]) {
    const result = await checkPort("127.0.0.1", port);
    assert.equal(result.available, true, `E2E port ${port} is already in use`);
  }
}

async function waitForPortsReleased() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const results = await Promise.all(
      [backendPort, storefrontPort].map((port) =>
        checkPort("127.0.0.1", port)
      )
    );
    if (results.every((result) => result.available)) return;
    await delay(250);
  }
  throw new Error("E2E process cleanup did not release all ports");
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) return resolve();
    const timeout = setTimeout(resolve, 2_000);
    server.closeAllConnections?.();
    server.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5_000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2_000),
    ]);
  }
}

function selectSuites(args) {
  const supported = ["catalog", "product-detail"];
  const selected = args.filter((arg) => supported.includes(arg));
  return selected.length > 0 ? Array.from(new Set(selected)) : supported;
}

function writeRuntimeEvidence(noKeyStatus, publishableKey) {
  fs.writeFileSync(
    path.join(outputDir, "real-runtime.log"),
    [
      `backend=${backendUrl}`,
      `storefront=${storefrontUrl}`,
      "backend_runtime=compiled-medusa-start",
      "backend_harness=none",
      "data_source=canonical-medusa-postgresql",
      `publishable_key_prefix=${publishableKey.slice(0, 3)}`,
      `without_key_status=${noKeyStatus}`,
      "with_key_status=200",
      "variant_identity=medusa-product-variant-id",
      "process_cleanup=ports-released",
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
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
