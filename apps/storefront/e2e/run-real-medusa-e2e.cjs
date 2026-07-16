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
const backendPort = Number(process.env.ESHOP_E2E_BACKEND_PORT || "9116");
const storefrontPort = Number(
  process.env.ESHOP_E2E_STOREFRONT_PORT || "3116"
);
const backendUrl = `http://127.0.0.1:${backendPort}`;
const storefrontUrl = `http://127.0.0.1:${storefrontPort}`;
const selectedSuites = selectSuites(process.argv.slice(2));
const outputTaskId = selectedSuites.includes("cart") ? "TASK-026" : "TASK-016";
const outputDir = path.join(rootDir, ".tasks", outputTaskId, "playwright");
const backendLogPath = path.join(outputDir, "medusa-backend.log");
const progressLogPath = path.join(outputDir, "real-runtime-progress.log");
const cartReferenceKey = "eshop.cart.v1";

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
      NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID: seedSummary.sales_channel_id,
      NEXT_PUBLIC_E2E_CART_HANDOFF: selectedSuites.includes("cart")
        ? "true"
        : "false",
      PORT: String(backendPort),
      AUTH_CORS: corsOrigins(),
      STORE_CORS: corsOrigins(),
      STOREFRONT_PORT: String(storefrontPort),
    })
  );

  const backend = startBackend();
  let storefrontServer;
  let browser;
  let context;
  let traceStopped = false;
  let noKeyStatus;
  let cartEvidence = null;
  let cartContext = null;

  try {
    logStep("waiting for compiled Medusa health endpoint");
    await waitForHttp(`${backendUrl}/health`, 90_000);
    noKeyStatus = await verifyPublishableKeyBoundary(publishableKey);
    if (selectedSuites.includes("cart")) {
      cartContext = await resolveCartContext(publishableKey, seedSummary);
    }

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
    if (selectedSuites.includes("cart")) {
      cartEvidence = await verifyCart(page, browser, publishableKey, cartContext);
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

  writeRuntimeEvidence(noKeyStatus, publishableKey, cartEvidence);
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
        cartAcceptance: cartEvidence,
        variantIdentity: "medusa-product-variant-id",
        mediaContract: "string-url",
        trace: `.tasks/${outputTaskId}/playwright/real-medusa-trace.zip`,
        screenshots: screenshotPaths(selectedSuites),
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
  assert.ok(
    product.variants.every((variant) => variant.id.startsWith("variant_"))
  );
  assert.deepEqual(product.media, [
    "/seed/steel-telescopic-curtain-rod.svg",
  ]);

  await page.goto(`${storefrontUrl}/products/${product.handle}`);
  await visible(page.getByRole("heading", { name: product.title }));
  const productImage = page.getByRole("img", { name: product.title });
  await visible(productImage);
  assert.equal(await productImage.getAttribute("src"), product.media[0]);
  assert.equal(
    await productImage.evaluate(
      (image) => image.complete && image.naturalWidth > 0
    ),
    true
  );
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

async function verifyCart(page, browser, publishableKey, cartContext) {
  logStep("verifying cart browser acceptance through Medusa Store API");
  await installE2eMergeBearerHook(page);
  const product = await readProductDetail(
    "steel-telescopic-curtain-rod",
    publishableKey
  );
  const selectedVariant = requiredVariant(product, "CR-STL-BLK-160-300");
  const sourceCartId = await addConfiguredVariantToCart(
    page,
    product,
    selectedVariant,
    publishableKey
  );

  await page.goto(`${storefrontUrl}/cart`);
  await visible(page.locator(`[data-cart-id="${sourceCartId}"]`));
  await assertCartQuantity(page, sourceCartId, selectedVariant.id, 1, publishableKey);
  await assertReferenceEnvelope(page, sourceCartId);

  await updateBrowserCartLine(page, selectedVariant.id, 2);
  await assertCartQuantity(page, sourceCartId, selectedVariant.id, 2, publishableKey);

  const removableProduct = await readProductDetail(
    "basic-home-hook-set",
    publishableKey
  );
  const removableVariant = removableProduct.variants[0];
  const sameCartId = await addConfiguredVariantToCart(
    page,
    removableProduct,
    removableVariant,
    publishableKey
  );
  assert.equal(sameCartId, sourceCartId);
  await page.goto(`${storefrontUrl}/cart`);
  await assertCartQuantity(page, sourceCartId, removableVariant.id, 1, publishableKey);
  await removeBrowserCartLine(page, removableVariant.id);
  await waitForCartWithoutVariant(sourceCartId, removableVariant.id, publishableKey);
  await assertCartQuantity(page, sourceCartId, selectedVariant.id, 2, publishableKey);

  await page.screenshot({
    path: path.join(outputDir, "cart-guest-persistence.png"),
    fullPage: true,
  });

  await page.reload();
  await visible(page.locator(`[data-cart-id="${sourceCartId}"]`));
  await assertCartQuantity(page, sourceCartId, selectedVariant.id, 2, publishableKey);

  const staleStorageState = await page.context().storageState();

  const storageState = await page.context().storageState();
  const secondContext = await browser.newContext({ storageState });
  try {
    const secondPage = await secondContext.newPage();
    await secondPage.goto(`${storefrontUrl}/cart`);
    await visible(secondPage.locator(`[data-cart-id="${sourceCartId}"]`));
    await assertCartQuantity(
      secondPage,
      sourceCartId,
      selectedVariant.id,
      2,
      publishableKey
    );
    await secondPage.screenshot({
      path: path.join(outputDir, "cart-new-context-restore.png"),
      fullPage: true,
    });
  } finally {
    await secondContext.close().catch(() => {});
  }

  const auth = await createSyntheticCustomerSession(page, publishableKey);
  const targetBeforeMerge = await createAuthenticatedTargetCart(
    page,
    publishableKey,
    cartContext,
    auth.bearerToken,
    selectedVariant.id,
    3
  );
  assert.notEqual(targetBeforeMerge.id, sourceCartId);
  assert.equal(targetBeforeMerge.customer_id, auth.customerId);
  assert.equal(quantityForVariant(targetBeforeMerge, selectedVariant.id), 3);

  await setE2eMergeBearer(page, auth.bearerToken);
  await waitForE2eMergeHandoff(page);
  const merge = await triggerStorefrontMergeHandoff(page);
  assert.equal(merge.sourceCartId, sourceCartId);
  assert.equal(merge.outcome, "merged");
  assert.equal(merge.replayed, false);
  assert.equal(merge.targetCartId, targetBeforeMerge.id);
  assert.equal(merge.stateCartId, targetBeforeMerge.id);
  assert.equal(merge.stateStatus, "ready");
  await assertReferenceEnvelope(page, merge.targetCartId);
  await page.goto(`${storefrontUrl}/cart`);
  await visible(page.locator(`[data-cart-id="${targetBeforeMerge.id}"]`));
  await assertCartQuantity(page, targetBeforeMerge.id, selectedVariant.id, 5, publishableKey);
  await page.screenshot({
    path: path.join(outputDir, "cart-auth-merge.png"),
    fullPage: true,
  });

  const staleSource = await browserStoreRequest(page, {
    path: `/store/carts/${encodeURIComponent(sourceCartId)}`,
    method: "GET",
    publishableKey,
  });
  assert.equal(staleSource.status, 404);

  const staleContext = await browser.newContext({ storageState: staleStorageState });
  try {
    await installE2eMergeBearerHook(staleContext, auth.bearerToken);
    const stalePage = await staleContext.newPage();
    await stalePage.goto(`${storefrontUrl}/products/${product.handle}`);
    await waitForE2eMergeHandoff(stalePage);
    const replay = await triggerStorefrontMergeHandoff(stalePage);
    assert.equal(replay.sourceCartId, sourceCartId);
    assert.equal(replay.outcome, "already_merged");
    assert.equal(replay.replayed, true);
    assert.equal(replay.targetCartId, targetBeforeMerge.id);
    assert.equal(replay.stateCartId, targetBeforeMerge.id);
    assert.equal(replay.stateStatus, "ready");
    await assertReferenceEnvelope(stalePage, targetBeforeMerge.id);
    await stalePage.goto(`${storefrontUrl}/cart`);
    await visible(stalePage.locator(`[data-cart-id="${targetBeforeMerge.id}"]`));
    await assertCartQuantity(
      stalePage,
      targetBeforeMerge.id,
      selectedVariant.id,
      5,
      publishableKey
    );
    await stalePage.screenshot({
      path: path.join(outputDir, "cart-replay.png"),
      fullPage: true,
    });
  } finally {
    await staleContext.close().catch(() => {});
  }

  return {
    status: "ok",
    sourceCart: redactId(sourceCartId),
    targetCart: redactId(targetBeforeMerge.id),
    customer: redactId(auth.customerId),
    guestQuantityAfterUpdate: 2,
    targetQuantityBeforeMerge: 3,
    mergedQuantity: 5,
    replayedQuantity: 5,
    consumedSourceStoreStatus: staleSource.status,
    mergeOutcome: merge.outcome,
    replayOutcome: "already_merged",
    browserStorage: "reference-only",
    auth: "synthetic-medusa-emailpass-bearer-through-provider-handoff",
  };
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

async function resolveCartContext(publishableKey, seedSummary) {
  const response = await fetch(`${backendUrl}/store/regions`, {
    headers: { "x-publishable-api-key": publishableKey },
  });
  assert.equal(response.ok, true, `regions returned HTTP ${response.status}`);
  const payload = await response.json();
  const region = (payload.regions || []).find(
    (candidate) =>
      candidate.name === "Москва" &&
      String(candidate.currency_code || "").toLowerCase() === "rub"
  );
  assert.match(region?.id || "", /^reg_/);
  assert.match(seedSummary?.sales_channel_id || "", /^sc_/);
  return {
    region_id: region.id,
    currency_code: String(region.currency_code || "rub").toLowerCase(),
    sales_channel_id: seedSummary.sales_channel_id,
  };
}

async function readStoreCart(cartId, publishableKey) {
  const response = await fetch(`${backendUrl}/store/carts/${encodeURIComponent(cartId)}`, {
    headers: { "x-publishable-api-key": publishableKey },
  });
  assert.equal(response.ok, true, `cart ${cartId} returned HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(typeof payload.cart?.id, "string");
  return payload.cart;
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

async function addConfiguredVariantToCart(
  page,
  product,
  variant,
  publishableKey
) {
  await page.goto(`${storefrontUrl}/products/${product.handle}`);
  for (const value of Object.values(variant.options || {}).filter(Boolean)) {
    await chooseOption(page, formatOptionLabel(value));
  }
  await visible(page.getByText("Variant is available", { exact: true }));
  await assertAddToCartState(page, false);
  await page.getByRole("button", { name: "Add to cart" }).click();
  const handoff = page.locator('[data-handoff-state="cart-action-added"]');
  await visible(handoff);
  const cartId = await handoff.getAttribute("data-cart-id");
  assert.match(cartId || "", /^cart_/);
  const cart = await readStoreCart(cartId, publishableKey);
  assert.ok(quantityForVariant(cart, variant.id) > 0);
  return cartId;
}

async function updateBrowserCartLine(page, variantId, quantity) {
  const line = page.locator(`[data-cart-line-variant-id="${variantId}"]`).first();
  await visible(line);
  await line.locator('input[name="quantity"]').fill(String(quantity));
  await line.getByRole("button", { name: "Update" }).click();
}

async function removeBrowserCartLine(page, variantId) {
  const line = page.locator(`[data-cart-line-variant-id="${variantId}"]`).first();
  await visible(line);
  await line.getByRole("button", { name: "Remove" }).click();
}

async function assertCartQuantity(page, cartId, variantId, quantity, publishableKey) {
  await waitForCartQuantity(cartId, variantId, quantity, publishableKey);
  await visible(page.locator(`[data-cart-id="${cartId}"]`));
  await visible(
    page
      .locator(`[data-cart-line-variant-id="${variantId}"]`)
      .getByText(`Quantity from backend: ${quantity}`, { exact: true })
  );
}

async function waitForCartQuantity(cartId, variantId, quantity, publishableKey) {
  const deadline = Date.now() + 20_000;
  let lastQuantity = null;
  while (Date.now() < deadline) {
    const cart = await readStoreCart(cartId, publishableKey);
    lastQuantity = quantityForVariant(cart, variantId);
    if (lastQuantity === quantity) return cart;
    await delay(250);
  }
  throw new Error(
    `Timed out waiting for ${variantId} quantity ${quantity}; last=${lastQuantity}`
  );
}

async function waitForCartWithoutVariant(cartId, variantId, publishableKey) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const cart = await readStoreCart(cartId, publishableKey);
    if (!lineForVariant(cart, variantId)) return cart;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${variantId} removal from ${cartId}`);
}

async function createSyntheticCustomerSession(page, publishableKey) {
  const suffix = `${process.pid}_${Date.now()}`;
  const email = `task026_${suffix}@example.test`;
  const password = `Task026_${suffix}_password`;

  const registered = await browserStoreRequest(page, {
    path: "/auth/customer/emailpass/register",
    method: "POST",
    body: { email, password },
  });
  assert.equal(registered.status, 200);
  assert.equal(typeof registered.body.token, "string");

  const customer = await browserStoreRequest(page, {
    path: "/store/customers",
    method: "POST",
    publishableKey,
    token: registered.body.token,
    body: {
      email,
      first_name: "TASK-026",
      last_name: "Synthetic",
    },
  });
  assert.equal(customer.status, 200);
  assert.match(customer.body.customer?.id || "", /^cus_/);

  const loggedIn = await browserStoreRequest(page, {
    path: "/auth/customer/emailpass",
    method: "POST",
    body: { email, password },
  });
  assert.equal(loggedIn.status, 200);
  assert.equal(typeof loggedIn.body.token, "string");

  return {
    customerId: customer.body.customer.id,
    bearerToken: loggedIn.body.token,
  };
}

async function createAuthenticatedTargetCart(
  page,
  publishableKey,
  cartContext,
  bearerToken,
  variantId,
  quantity
) {
  const created = await browserStoreRequest(page, {
    path: "/store/carts",
    method: "POST",
    publishableKey,
    body: cartContext,
  });
  assert.equal(created.status, 200);
  const cartId = created.body.cart.id;

  const attached = await browserStoreRequest(page, {
    path: `/store/carts/${encodeURIComponent(cartId)}/customer`,
    method: "POST",
    publishableKey,
    token: bearerToken,
    body: {},
  });
  assert.equal(attached.status, 200);

  const withLine = await browserStoreRequest(page, {
    path: `/store/carts/${encodeURIComponent(cartId)}/line-items`,
    method: "POST",
    publishableKey,
    body: { variant_id: variantId, quantity },
  });
  assert.equal(withLine.status, 200);
  return withLine.body.cart;
}

async function browserStoreRequest(
  page,
  { path: requestPath, method, publishableKey, token, body }
) {
  return page.evaluate(
    async ({ backendUrl, requestPath, method, publishableKey, token, body }) => {
      const headers = {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(publishableKey ? { "x-publishable-api-key": publishableKey } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${backendUrl}${requestPath}`, {
        method,
        credentials: "include",
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch (_error) {
        parsed = { raw: text };
      }
      return { status: response.status, ok: response.ok, body: parsed };
    },
    { backendUrl, requestPath, method, publishableKey, token, body }
  );
}

async function assertReferenceEnvelope(page, cartId) {
  const reference = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, cartReferenceKey);
  assert.deepEqual(Object.keys(reference || {}).sort(), ["cart_id", "version"]);
  assert.equal(reference.version, 1);
  assert.equal(reference.cart_id, cartId);
}

async function installE2eMergeBearerHook(target, bearerToken = "") {
  await target.addInitScript(
    ({ initialBearerToken }) => {
      const originalFetch = window.fetch.bind(window);
      let mergeBearerToken = initialBearerToken;

      window.__eshopE2eSetMergeBearer = (token) => {
        mergeBearerToken = token;
      };
      window.fetch = (input, init = {}) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof Request
              ? input.url
              : String(input);
        if (!mergeBearerToken || !/\/store\/carts\/[^/]+\/merge$/.test(url)) {
          return originalFetch(input, init);
        }

        const headers = new Headers(
          init.headers || (input instanceof Request ? input.headers : undefined)
        );
        headers.set("authorization", `Bearer ${mergeBearerToken}`);
        return originalFetch(input, { ...init, headers });
      };
    },
    { initialBearerToken: bearerToken }
  );
}

async function setE2eMergeBearer(page, bearerToken) {
  const set = await page.evaluate((token) => {
    if (typeof window.__eshopE2eSetMergeBearer !== "function") {
      return false;
    }
    window.__eshopE2eSetMergeBearer(token);
    return true;
  }, bearerToken);
  assert.equal(set, true, "E2E merge bearer hook is unavailable");
}

async function waitForE2eMergeHandoff(page) {
  await page.waitForFunction(
    () => window.__eshopE2eCartHandoffReady === true,
    undefined,
    { timeout: 20_000 }
  );
}

async function triggerStorefrontMergeHandoff(page) {
  return page.evaluate(async () => {
    const eventName = "eshop:e2e:merge-after-authentication";
    const completeEvent = `${eventName}:complete`;
    const failedEvent = `${eventName}:failed`;

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for storefront merge handoff."));
      }, 20_000);
      const complete = (event) => {
        cleanup();
        resolve(event.detail);
      };
      const failed = (event) => {
        cleanup();
        reject(new Error(event.detail?.message || "Storefront merge handoff failed."));
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        window.removeEventListener(completeEvent, complete);
        window.removeEventListener(failedEvent, failed);
      };

      window.addEventListener(completeEvent, complete, { once: true });
      window.addEventListener(failedEvent, failed, { once: true });
      window.dispatchEvent(new CustomEvent(eventName));
    });
  });
}

function requiredVariant(product, sku) {
  const variant = product.variants.find((candidate) => candidate.sku === sku);
  assert.ok(variant, `product ${product.handle} does not include ${sku}`);
  return variant;
}

function lineForVariant(cart, variantId) {
  return (cart.items || []).find((item) => item.variant_id === variantId) || null;
}

function quantityForVariant(cart, variantId) {
  return (cart.items || [])
    .filter((item) => item.variant_id === variantId)
    .reduce((total, item) => total + numericValue(item.quantity), 0);
}

function numericValue(value) {
  if (typeof value === "object" && value !== null && "value" in value) {
    return Number(value.value);
  }
  return Number(value);
}

function formatOptionLabel(value) {
  const label = String(value).replace(/[_/-]+/g, " ");
  if (/\d/.test(label)) {
    return label;
  }
  return label.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function redactId(id) {
  return typeof id === "string" && id.length > 8 ? `...${id.slice(-8)}` : id;
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
  const supported = ["catalog", "product-detail", "cart"];
  const selected = args.filter((arg) => supported.includes(arg));
  return selected.length > 0 ? Array.from(new Set(selected)) : ["catalog", "product-detail"];
}

function writeRuntimeEvidence(noKeyStatus, publishableKey, cartEvidence) {
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
      `durable_cart_persistence=${cartEvidence ? "true" : "false"}`,
      `cart_acceptance=${cartEvidence ? cartEvidence.status : "not-run"}`,
      `synthetic_auth=${cartEvidence ? cartEvidence.auth : "not-run"}`,
      "",
    ].join("\n"),
    "utf8"
  );
}

function screenshotPaths(suites) {
  return suites.flatMap((suite) => {
    if (suite === "cart") {
      return [
        "cart-guest-persistence.png",
        "cart-new-context-restore.png",
        "cart-auth-merge.png",
        "cart-replay.png",
      ].map((file) => `.tasks/${outputTaskId}/playwright/${file}`);
    }
    return [`.tasks/${outputTaskId}/playwright/${suite}.png`];
  });
}

function corsOrigins() {
  return [
    storefrontUrl,
    `http://localhost:${storefrontPort}`,
    "http://localhost:3000",
  ].join(",");
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
