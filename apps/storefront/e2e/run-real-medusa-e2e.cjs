const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
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
const outputTaskId = resolveOutputTaskId();
const outputDir = path.join(rootDir, ".tasks", outputTaskId, "playwright");
const backendLogPath = path.join(outputDir, "medusa-backend.log");
const progressLogPath = path.join(outputDir, "real-runtime-progress.log");
const cartReferenceKey = "eshop.cart.v1";
const authReturnPathKey = "eshop.auth.return-path.v1";
const authProviderDoublePath = path.join(__dirname, "auth-provider-double.cjs");
const medusaCli = require.resolve("@medusajs/cli/cli");
const wishlistAcceptanceScript = path.join(
  backendDir,
  "src",
  "scripts",
  "smoke-wishlist-acceptance.ts"
);
const checkoutAcceptanceScript = path.join(
  backendDir,
  "src",
  "scripts",
  "smoke-checkout-delivery-acceptance.ts"
);
const checkoutCompletionMarker = "TASK-049-CHECKOUT-BROWSER-COMPLETE";
const pendingOrderCompletionMarker = "TASK-052-PENDING-ORDER-BROWSER-COMPLETE";
const pendingOrderAcceptanceScript = path.join(
  backendDir,
  "src",
  "scripts",
  "smoke-pending-order-acceptance.ts"
);
let backendStartupDiagnostics = "";

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  invalidateCheckoutSuccessArtifacts();
  invalidatePendingOrderSuccessArtifacts();
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
      MEDUSA_FILE_URL:
        process.env.MEDUSA_FILE_URL?.trim() || `${backendUrl}/static`,
      NEXT_PUBLIC_E2E_CART_HANDOFF: selectedSuites.some((suite) =>
        ["auth", "cart", "wishlist", "pending-order"].includes(suite)
      )
        ? "true"
        : "false",
      NODE_ENV: "development",
      PORT: String(backendPort),
      AUTH_CORS: corsOrigins(),
      STORE_CORS: corsOrigins(),
      STOREFRONT_PORT: String(storefrontPort),
      JWT_SECRET: "task034-local-jwt-secret",
      COOKIE_SECRET: "task034-local-cookie-secret",
      GOOGLE_AUTH_ENABLED: selectedSuites.some((suite) =>
        ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
      )
        ? "true"
        : "false",
      GOOGLE_OAUTH_CLIENT_ID: "task034-local-google-client",
      GOOGLE_OAUTH_CLIENT_SECRET: "task034-local-google-secret",
      GOOGLE_OAUTH_CALLBACK_URL: `${backendUrl}/auth/customer/google/complete`,
      VK_ID_AUTH_ENABLED: selectedSuites.some((suite) =>
        ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
      )
        ? "true"
        : "false",
      VK_ID_CLIENT_ID: "340034",
      VK_ID_SERVICE_TOKEN: "task034-local-vk-service-token",
      VK_ID_CALLBACK_URL: `${backendUrl}/auth/customer/vkid/complete`,
      ESHOP_E2E_AUTH_PROVIDER_DOUBLE: selectedSuites.some((suite) =>
        ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
      )
        ? "true"
        : "false",
      NODE_OPTIONS: selectedSuites.some((suite) =>
        ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
      )
        ? `${process.env.NODE_OPTIONS || ""} --require=${authProviderDoublePath}`.trim()
        : process.env.NODE_OPTIONS,
    })
  );

  const backend = startBackend();
  let storefrontServer;
  let browser;
  let context;
  let traceStopped = false;
  let noKeyStatus;
  let cartEvidence = null;
  let authEvidence = null;
  let wishlistEvidence = null;
  let checkoutEvidence = null;
  let pendingOrderEvidence = null;
  let cartContext = null;
  let wishlistFixtures = null;
  let checkoutFixtures = null;
  let pendingOrderFixtures = null;
  let checkoutScreenshot = null;
  let pendingOrderScreenshot = null;

  try {
    logStep("waiting for compiled Medusa health endpoint");
    await waitForHttp(
      `${backendUrl}/health`,
      selectedSuites.some((suite) =>
        ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
      )
        ? 180_000
        : 90_000,
      backend
    );
    noKeyStatus = await verifyPublishableKeyBoundary(publishableKey);
    if (
      selectedSuites.some((suite) =>
        ["auth", "cart", "pending-order"].includes(suite)
      )
    ) {
      cartContext = await resolveCartContext(publishableKey, seedSummary);
    }
    if (selectedSuites.includes("wishlist")) {
      logStep("creating synthetic wishlist lifecycle fixtures");
      wishlistFixtures = createWishlistAcceptanceFixtures(publishableKey);
    }
    if (
      selectedSuites.some((suite) =>
        ["checkout-delivery", "pending-order"].includes(suite)
      )
    ) {
      logStep("creating synthetic Admin Shipping Options for checkout browser acceptance");
      checkoutFixtures = createCheckoutAcceptanceFixtures();
    }
    if (selectedSuites.includes("pending-order")) {
      pendingOrderFixtures = createPendingOrderAcceptanceFixtures();
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
    if (
      selectedSuites.some((suite) =>
        ["checkout-delivery", "pending-order"].includes(suite)
      )
    ) {
      context.setDefaultNavigationTimeout(120_000);
      context.setDefaultTimeout(60_000);
    }
    if (
      !selectedSuites.some((suite) =>
        ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
      )
    ) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
    } else {
      traceStopped = true;
    }
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
    if (selectedSuites.includes("auth")) {
      authEvidence = await verifyAuth(browser, publishableKey, cartContext);
    }
    if (selectedSuites.includes("wishlist")) {
      wishlistEvidence = await verifyWishlist(
        browser,
        publishableKey,
        wishlistFixtures
      );
    }
    if (selectedSuites.includes("checkout-delivery")) {
      const checkoutResult = await verifyCheckoutDelivery(
        page,
        publishableKey,
        checkoutFixtures
      );
      checkoutEvidence = checkoutResult.evidence;
      checkoutScreenshot = checkoutResult.screenshot;
    }
    if (selectedSuites.includes("pending-order")) {
      const pendingOrderResult = await verifyPendingOrder(
        page,
        publishableKey,
        cartContext,
        pendingOrderFixtures
      );
      pendingOrderEvidence = pendingOrderResult.evidence;
      pendingOrderScreenshot = pendingOrderResult.screenshot;
    }

    if (!traceStopped) {
      await context.tracing.stop({
        path: path.join(outputDir, "real-medusa-trace.zip"),
      });
      traceStopped = true;
    }
  } catch (error) {
    invalidateCheckoutSuccessArtifacts();
    invalidatePendingOrderSuccessArtifacts();
    const page = context?.pages().at(0);
    if (page && selectedSuites.includes("pending-order")) {
      const safeFailureState = page
        .locator(
          '[data-pending-order-state="created"], [data-pending-order-error="true"]'
        )
        .first();
      if ((await safeFailureState.count().catch(() => 0)) > 0) {
        await safeFailureState
          .screenshot({
            path: path.join(outputDir, "pending-order-failure.png"),
          })
          .catch(() => {});
      }
    } else {
      await page
        ?.screenshot({
          path: path.join(outputDir, "real-medusa-failure.png"),
          fullPage: true,
        })
        .catch(() => {});
    }
    throw error;
  } finally {
    let checkoutCleanupFailure = null;
    let pendingOrderCleanupFailure = null;
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
    if (pendingOrderFixtures) {
      logStep("cleaning synthetic pending-order browser fixtures");
      try {
        cleanupPendingOrderAcceptanceFixtures(pendingOrderFixtures);
      } catch (error) {
        pendingOrderCleanupFailure = error;
      }
    }
    if (checkoutFixtures) {
      logStep("cleaning synthetic checkout Shipping Options");
      try {
        cleanupCheckoutAcceptanceFixtures(checkoutFixtures);
      } catch (error) {
        checkoutCleanupFailure = error;
      }
    }
    if (wishlistFixtures) {
      logStep("cleaning synthetic wishlist lifecycle fixtures");
      cleanupWishlistAcceptanceFixtures(wishlistFixtures);
    }
    logStep("stopping Medusa backend");
    await stopChild(backend);
    logStep("checking released ports");
    await waitForPortsReleased();
    logStep("cleanup complete");
    if (pendingOrderCleanupFailure) throw pendingOrderCleanupFailure;
    if (checkoutCleanupFailure) throw checkoutCleanupFailure;
  }

  writeRuntimeEvidence(
    noKeyStatus,
    publishableKey,
    cartEvidence,
    authEvidence,
    wishlistEvidence,
    checkoutEvidence,
    pendingOrderEvidence
  );
  publishCheckoutSuccessArtifacts(checkoutEvidence, checkoutScreenshot);
  publishPendingOrderSuccessArtifacts(
    pendingOrderEvidence,
    pendingOrderScreenshot
  );
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
        authAcceptance: authEvidence,
        wishlistAcceptance: wishlistEvidence,
        checkoutDeliveryAcceptance: checkoutEvidence,
        pendingOrderAcceptance: pendingOrderEvidence,
        variantIdentity: "medusa-product-variant-id",
        mediaContract: "string-url",
        trace: selectedSuites.includes("auth")
          ? ["google", "vkid"].map(
              (provider) =>
                `.tasks/${outputTaskId}/playwright/auth-${provider}-sanitized-trace.zip`
            )
          : selectedSuites.includes("wishlist")
            ? `.tasks/${outputTaskId}/playwright/wishlist-browser-report.json`
          : selectedSuites.includes("checkout-delivery")
            ? `.tasks/${outputTaskId}/playwright/checkout-browser-report.json`
          : selectedSuites.includes("pending-order")
            ? `.tasks/${outputTaskId}/playwright/pending-order-browser-report.json`
          : `.tasks/${outputTaskId}/playwright/real-medusa-trace.zip`,
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

async function verifyAuth(browser, publishableKey, cartContext) {
  logStep("verifying browser auth, cart handoff, checkout gate, and logout");
  const results = [];
  const requestedProvider =
    process.env.ESHOP_E2E_AUTH_PROVIDER ||
    process.argv.slice(2).find((value) => ["google", "vkid"].includes(value));
  const providers = ["google", "vkid"].filter(
    (provider) => !requestedProvider || provider === requestedProvider
  );
  assert.ok(providers.length > 0, "Unsupported ESHOP_E2E_AUTH_PROVIDER value");

  for (const provider of providers) {
    const context = await browser.newContext();
    context.setDefaultNavigationTimeout(120_000);
    context.setDefaultTimeout(60_000);
    const consoleMessages = [];
    let sourceCartId = null;
    let mergeAttempts = 0;

    try {
      await installAuthProviderRoutes(context);
      const page = await context.newPage();
      page.on("console", (message) => consoleMessages.push(message.text()));

      if (provider === "google") {
        const product = await readProductDetail(
          "steel-telescopic-curtain-rod",
          publishableKey
        );
        const variant = requiredVariant(product, "CR-STL-BLK-160-300");
        sourceCartId = await addConfiguredVariantToCart(
          page,
          product,
          variant,
          publishableKey
        );
        await page.route(`${backendUrl}/store/carts/*/merge`, async (route) => {
          if (route.request().method() !== "POST") {
            await route.continue();
            return;
          }
          mergeAttempts += 1;
          if (mergeAttempts === 1) {
            await route.fulfill({
              status: 409,
              contentType: "application/json",
              headers: {
                "access-control-allow-credentials": "true",
                "access-control-allow-origin": storefrontUrl,
              },
              body: JSON.stringify({
                error: { code: "cart_merge_stock_conflict" },
              }),
            });
            return;
          }
          await route.continue();
        });
      }

      await page.goto(`${storefrontUrl}/checkout`);
      await waitForCleanStorefrontPath(page, "/login");
      await assertReturnPathEnvelope(page, "/checkout");

      const negativeMode = provider === "google" ? "cancel" : "failure";
      await completeProviderAttempt(page, provider, negativeMode);
      await waitForCleanStorefrontPath(page, "/auth/complete");
      await visible(
        page.getByRole("heading", {
          name: negativeMode === "cancel" ? "Sign-in cancelled" : "Sign-in cancelled",
        })
      );
      if (sourceCartId) {
        await assertReferenceEnvelope(page, sourceCartId);
      }
      await page.getByRole("link", { name: "Try sign-in again" }).click();
      await waitForCleanStorefrontPath(page, "/login");

      const previousSessionCookie = (await context.cookies(backendUrl)).find(
        (cookie) => cookie.name === "connect.sid"
      );
      const callback = await completeProviderAttempt(page, provider, "success");
      if (provider === "google") {
        await waitForCleanStorefrontPath(page, "/auth/complete");
        await page.waitForTimeout(3_000);
        const observation = await page.evaluate(() => ({
          completionState: document
            .querySelector("[data-auth-completion-state]")
            ?.getAttribute("data-auth-completion-state"),
          path: location.pathname,
        }));
        const sessionRequest = page.waitForRequest(
          (request) => request.url() === `${backendUrl}/store/customers/me`,
          { timeout: 10_000 }
        );
        const sessionProbe = await browserStoreRequest(page, {
          path: "/store/customers/me",
          method: "GET",
          publishableKey,
        });
        const sessionHeaders = await (await sessionRequest).allHeaders();
        const sessionCookie = (await context.cookies(backendUrl)).find(
          (cookie) => cookie.name === "connect.sid"
        );
        logStep(
          `google completion observation path=${observation.path} state=${observation.completionState || "none"} callback=${callback.status} set_cookie=${callback.setCookie} browser_cookie=${Boolean(sessionCookie)} cookie_changed=${Boolean(sessionCookie && sessionCookie.value !== previousSessionCookie?.value)} cookie_sent=${Boolean(sessionHeaders.cookie)} cookie_secure=${sessionCookie?.secure ?? "none"} session=${sessionProbe.status} merge_attempts=${mergeAttempts}`
        );
        await page.waitForFunction(
          () => {
            const completion = document.querySelector("[data-auth-completion-state]");
            return (
              completion?.getAttribute("data-auth-completion-state") ===
              "merge_blocked"
            );
          },
          undefined,
          { timeout: 30_000 }
        );
        await visible(page.getByRole("heading", { name: "Cart needs another attempt" }));
        assert.equal(mergeAttempts, 1);
        await assertReferenceEnvelope(page, sourceCartId);
        assert.equal(
          (await browserStoreRequest(page, {
            path: "/store/customers/me",
            method: "GET",
            publishableKey,
          })).status,
          200
        );
        await page.getByRole("button", { name: "Retry cart merge" }).click();
      }

      await waitForCleanStorefrontPath(page, "/checkout");
      await visible(page.locator('[data-checkout-continuation="ft-006-handoff"]'));
      const current = await browserStoreRequest(page, {
        path: "/store/customers/me",
        method: "GET",
        publishableKey,
      });
      assert.equal(current.status, 200);
      assert.match(current.body.customer?.id || "", /^cus_/);
      await assertReturnPathAbsent(page);

      if (sourceCartId) {
        assert.equal(mergeAttempts, 2);
        const reference = await readBrowserCartReference(page);
        assert.match(reference?.cart_id || "", /^cart_/);
        const mergedCart = await readStoreCart(reference.cart_id, publishableKey);
        assert.equal(mergedCart.customer_id, current.body.customer.id);
      }

      await page.goto(callback.url);
      await waitForCleanStorefrontPath(page, "/auth/complete");
      await visible(page.getByRole("heading", { name: "Sign-in cancelled" }));
      await page.goto(`${storefrontUrl}/checkout`);
      await waitForCleanStorefrontPath(page, "/checkout");
      await visible(page.locator('[data-checkout-continuation="ft-006-handoff"]'));

      if (provider === "google") {
        const expired = await browserStoreRequest(page, {
          path: "/auth/session",
          method: "DELETE",
          publishableKey,
        });
        assert.equal(expired.status, 200);
        await page.goto(`${storefrontUrl}/checkout`);
        await waitForCleanStorefrontPath(page, "/login");
        assert.ok(await readBrowserCartReference(page));
        await completeProviderAttempt(page, provider, "success");
        await waitForCleanStorefrontPath(page, "/checkout");
        await visible(page.locator('[data-checkout-continuation="ft-006-handoff"]'));
      }

      await assertBrowserStoragePrivacy(page);
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false,
      });
      await page.screenshot({
        path: path.join(outputDir, `auth-${provider}-checkout.png`),
        fullPage: true,
      });
      await context.tracing.stop({
        path: path.join(outputDir, `auth-${provider}-sanitized-trace.zip`),
      });

      await page.getByRole("button", { name: "Log out" }).click();
      await waitForCleanStorefrontPath(page, "/login");
      assert.equal(
        (await browserStoreRequest(page, {
          path: "/store/customers/me",
          method: "GET",
          publishableKey,
        })).status,
        401
      );
      assert.equal(await readBrowserCartReference(page), null);
      await assertReturnPathAbsent(page);
      assertEvidencePrivacy(consoleMessages.join("\n"));

      results.push({
        provider,
        callbackCleanup: true,
        checkoutGate: true,
        mergeConflictRetry: provider === "google",
        replayRejected: true,
        sessionExpiry: provider === "google",
        logoutCleanup: true,
      });
    } finally {
      await context.close().catch(() => {});
    }
  }

  return {
    status: "ok",
    providers: results,
    browserStorage: "cart-reference-and-safe-return-path-only",
    providerNetwork: "local-double-only",
    artifactPrivacy: "sanitized-post-callback-traces",
  };
}

async function verifyCheckoutDelivery(page, publishableKey, fixtures) {
  assert.match(fixtures?.runId || "", /^task049/);
  logStep("verifying authenticated checkout delivery through real browser HTTP");
  const checkoutRequests = [];
  const forbiddenRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== backendUrl) return;
    const pathname = url.pathname;
    if (pathname === "/store/checkout" && request.method() === "POST") {
      let body = null;
      try {
        body = request.postDataJSON();
      } catch (_error) {
        body = null;
      }
      checkoutRequests.push({ method: body?.delivery_method, payment: body?.payment_method });
    }
    if (/\/store\/(orders|payment|payments)|\/payment\/|yookassa|stripe/i.test(pathname)) {
      forbiddenRequests.push(pathname);
    }
  });

  await page.goto(`${storefrontUrl}/checkout`);
  await waitForCleanStorefrontPath(page, "/login");

  const customerId = await authenticateBrowserCustomer(
    page.context(),
    page,
    "google"
  );
  assert.match(customerId, /^cus_/);
  const current = await browserStoreRequest(page, {
    path: "/store/customers/me",
    method: "GET",
    publishableKey,
  });
  assert.equal(current.status, 200);
  assert.match(current.body.customer?.id || "", /^cus_/);

  await page.goto(`${storefrontUrl}/checkout`);
  await waitForCleanStorefrontPath(page, "/checkout");
  await visible(page.locator('[data-checkout-auth-state="authenticated_ready"]'));
  await visible(page.locator('[data-checkout-form="ft-006"]'));

  for (const field of ["name", "email", "phone", "city", "comment"]) {
    assert.equal(await page.locator(`[name="${field}"]`).count(), 1);
  }
  assert.equal(await page.locator('[name="address"]').count(), 0);
  assert.deepEqual(
    await page.locator('[data-delivery-option] input').evaluateAll((inputs) =>
      inputs.map((input) => input.value)
    ),
    ["pickup", "city_courier", "transport_company"]
  );
  assert.deepEqual(
    await page.locator('[data-payment-option] input').evaluateAll((inputs) =>
      inputs.map((input) => input.value)
    ),
    ["card", "sbp", "sberpay"]
  );

  await page.locator('[name="name"]').fill(" Synthetic Browser Buyer ");
  await page.locator('[name="email"]').fill(" SYNTHETIC.BROWSER@EXAMPLE.TEST ");
  await page.locator('[name="city"]').fill(" Synthetic Browser City ");
  await page.getByRole("button", { name: "Validate checkout details" }).click();
  await visible(page.locator('[data-checkout-error="validation"]'));
  assert.equal(await page.locator('[name="phone"]').getAttribute("aria-invalid"), "true");

  await page.locator('[name="phone"]').fill("+7 900 000 00 00");
  await page.locator('[name="comment"]').fill("Synthetic browser note");
  await submitCheckoutFromBrowser(page, "pickup", "card", /0/);

  await page.locator('[data-delivery-option="city_courier"] input').check();
  await visible(page.locator('[name="address"]'));
  await page.locator('[name="address"]').fill("Synthetic browser address");
  await page.locator('[data-payment-option="sbp"] input').check();
  await submitCheckoutFromBrowser(page, "city_courier", "sbp", /500/);

  await page.locator('[data-delivery-option="transport_company"] input').check();
  await visible(page.locator('[name="address"]'));
  await page.locator('[name="address"]').fill("Synthetic browser transport address");
  await page.locator('[data-payment-option="sberpay"] input').check();
  await submitCheckoutFromBrowser(page, "transport_company", "sberpay", /700/);

  runBackendAcceptancePhase(fixtures, "browser-disable");
  const unavailableResponse = page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/store/checkout` &&
      response.request().method() === "POST",
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: "Validate checkout details" }).click();
  const unavailable = await unavailableResponse;
  assert.equal(unavailable.status(), 422);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.error?.code, "delivery_method_unavailable");
  await visible(page.locator('[data-checkout-error="unavailable"]'));
  assert.equal(
    await page.locator('[data-delivery-option="transport_company"] input').isChecked(),
    true
  );
  assert.equal(checkoutRequests.at(-1)?.method, "transport_company");

  await page.locator('[data-delivery-option="pickup"] input').check();
  assert.equal(await page.locator('[name="address"]').count(), 0);
  await page.locator('[data-payment-option="card"] input').check();
  await submitCheckoutFromBrowser(page, "pickup", "card", /0/);
  assert.equal(checkoutRequests.at(-1)?.method, "pickup");
  assert.equal(forbiddenRequests.length, 0);

  await assertBrowserStoragePrivacy(page);
  const screenshot = await page.screenshot({ fullPage: true });
  assert.equal(
    checkoutRequests.every(
      (request) =>
        ["pickup", "city_courier", "transport_company"].includes(request.method) &&
        ["card", "sbp", "sberpay"].includes(request.payment)
    ),
    true
  );
  await page.getByRole("button", { name: "Log out" }).click();
  await waitForCleanStorefrontPath(page, "/login");
  assert.equal(
    (await browserStoreRequest(page, {
      path: "/store/customers/me",
      method: "GET",
      publishableKey,
    })).status,
    401
  );

  return {
    screenshot,
    evidence: {
      status: "ok",
      runId: fixtures.runId,
      authenticatedReadyGate: true,
      realMedusaSession: true,
      fields: {
        contact: ["name", "email", "phone", "city"],
        conditionalAddress: true,
        optionalComment: true,
      },
      deliveryIds: ["pickup", "city_courier", "transport_company"],
      tariffsRub: [0, 500, 700],
      paymentIds: ["card", "sbp", "sberpay"],
      invalidFieldRecovery: true,
      unavailableRecovery: "422 delivery_method_unavailable then explicit pickup selection",
      noSilentSubstitution: true,
      noOrderOrProviderRequests: true,
      forbiddenRequestCount: forbiddenRequests.length,
      artifactPrivacy: "sanitized-report-and-screenshot; no trace or cookies",
    },
  };
}

async function verifyPendingOrder(
  page,
  publishableKey,
  cartContext,
  fixtures
) {
  assert.match(fixtures?.runId || "", /^task052/);
  assert.ok(cartContext, "Pending-order cart context is missing.");
  logStep("verifying pending-order lifecycle through real browser and Medusa");

  const pendingRequests = [];
  const forbiddenProviderRequests = [];
  const captureRequest = (request) => {
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (
      url.origin === backendUrl &&
      pathname === "/store/checkout/order" &&
      request.method() === "POST"
    ) {
      let body = null;
      try {
        body = request.postDataJSON();
      } catch (_error) {
        body = null;
      }
      pendingRequests.push({
        idempotencyKey: request.headers()["idempotency-key"] || null,
        cartId: body?.cart_id || null,
        bodyKeys: body && typeof body === "object" ? Object.keys(body).sort() : [],
        containsClientAuthority: /customer_id|unit_price|line_items|tariff_amount/i.test(
          JSON.stringify(body)
        ),
      });
    }
    if (
      /yookassa|stripe/i.test(url.hostname) ||
      /\/store\/(?:orders|payments?)(?:\/|$)|\/payment(?:\/|$)/i.test(pathname)
    ) {
      forbiddenProviderRequests.push(`${url.origin}${pathname}`);
    }
  };
  page.on("request", captureRequest);

  try {
    await page.goto(`${storefrontUrl}/checkout`);
    await waitForCleanStorefrontPath(page, "/login");

    const customerId = await authenticateBrowserCustomer(
      page.context(),
      page,
      "google"
    );
    assert.match(customerId, /^cus_/);
    writePendingOrderBrowserState(fixtures, { customerId });

    const product = await readProductDetail(
      "steel-telescopic-curtain-rod",
      publishableKey
    );
    const variant = requiredVariant(product, "CR-STL-BLK-160-300");
    const cart = await createAuthenticatedTargetCart(
      page,
      publishableKey,
      cartContext,
      undefined,
      variant.id,
      1
    );
    assert.match(cart.id || "", /^cart_/);
    assert.equal(cart.customer_id, customerId);
    assert.equal(quantityForVariant(cart, variant.id), 1);
    writePendingOrderBrowserState(fixtures, {
      customerId,
      cartId: cart.id,
    });
    await page.evaluate(
      ({ key, cartId }) => {
        localStorage.setItem(key, JSON.stringify({ version: 1, cart_id: cartId }));
      },
      { key: cartReferenceKey, cartId: cart.id }
    );

    await page.goto(`${storefrontUrl}/checkout`);
    await waitForCleanStorefrontPath(page, "/checkout");
    await visible(page.locator('[data-checkout-auth-state="authenticated_ready"]'));
    await visible(page.locator('[data-checkout-form="ft-006"]'));
    await assertReferenceEnvelope(page, cart.id);

    await page.locator('[name="name"]').fill("Synthetic Pending Buyer");
    await page.locator('[name="email"]').fill("pending.browser@example.test");
    await page.locator('[name="phone"]').fill("+7 900 000 00 52");
    await page.locator('[name="city"]').fill("Synthetic Browser City");
    await page.locator('[data-delivery-option="pickup"] input').check();
    await page.locator('[data-payment-option="card"] input').check();
    await submitCheckoutFromBrowser(page, "pickup", "card", /0/);

    const firstResponsePromise = waitForPendingOrderResponse(page);
    await page.getByRole("button", { name: "Create pending order" }).click();
    const firstResponse = await firstResponsePromise;
    assert.equal(firstResponse.status(), 201);
    const firstBody = await firstResponse.json();
    writePendingOrderBrowserState(fixtures, {
      customerId,
      cartId: cart.id,
      orderId: firstBody.order_id,
      expiresAt: firstBody.expires_at,
    });
    assert.match(firstBody.order_id || "", /^order_/);
    assert.equal(firstBody.status, "pending_payment");
    assert.equal(firstBody.payment_id, "card");
    assert.ok(Date.parse(firstBody.expires_at) > Date.now());

    const pendingPanel = page.locator('[data-pending-order-state="created"]');
    await visible(pendingPanel);
    assert.equal(await pendingPanel.getAttribute("data-order-id"), firstBody.order_id);
    await visible(
      pendingPanel.getByText(
        "Payment has not been confirmed and no payment provider was called."
      )
    );
    assert.equal(pendingRequests.length, 1);
    assert.match(
      pendingRequests[0].idempotencyKey || "",
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.equal(pendingRequests[0].cartId, cart.id);
    assert.equal(pendingRequests[0].containsClientAuthority, false);
    assert.deepEqual(pendingRequests[0].bodyKeys, [
      "cart_id",
      "city",
      "delivery_method",
      "email",
      "name",
      "payment_method",
      "phone",
    ]);

    const replayResponsePromise = waitForPendingOrderResponse(page);
    await page
      .getByRole("button", { name: "Retry pending-order handoff" })
      .click();
    const replayResponse = await replayResponsePromise;
    assert.equal(replayResponse.status(), 200);
    const replayBody = await replayResponse.json();
    assert.equal(replayBody.order_id, firstBody.order_id);
    assert.equal(replayBody.expires_at, firstBody.expires_at);
    assert.equal(pendingRequests.length, 2);
    assert.equal(
      pendingRequests[1].idempotencyKey,
      pendingRequests[0].idempotencyKey
    );
    assert.equal(pendingRequests[1].cartId, cart.id);
    assert.equal(pendingRequests[1].containsClientAuthority, false);

    const backendVerification = runPendingOrderAcceptancePhase(
      fixtures,
      "browser-verify"
    );
    const screenshot = await pendingPanel.screenshot();
    const expiryVerification = runPendingOrderAcceptancePhase(
      fixtures,
      "browser-expire"
    );

    const expiredRetryResponsePromise = waitForPendingOrderResponse(page);
    await page
      .getByRole("button", { name: "Retry pending-order handoff" })
      .click();
    const expiredRetryResponse = await expiredRetryResponsePromise;
    assert.equal(expiredRetryResponse.status(), 409);
    const expiredRetryBody = await expiredRetryResponse.json();
    assert.equal(
      expiredRetryBody.error?.code,
      "checkout_idempotency_conflict"
    );
    await visible(page.locator('[data-pending-order-error="true"]'));
    assert.equal(
      await page.locator('[data-pending-order-state="created"]').count(),
      0
    );
    assert.equal(pendingRequests.length, 3);
    assert.equal(
      pendingRequests[2].idempotencyKey,
      pendingRequests[0].idempotencyKey
    );
    assert.equal(pendingRequests[2].cartId, cart.id);
    assert.equal(pendingRequests[2].containsClientAuthority, false);

    assert.equal(forbiddenProviderRequests.length, 0);
    await assertBrowserStoragePrivacy(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await waitForCleanStorefrontPath(page, "/login");

    return {
      screenshot,
      evidence: {
        status: "ok",
        runId: fixtures.runId,
        authenticatedReadyGate: true,
        realMedusaSession: true,
        realMedusaPostgresql: true,
        freshUuidIdempotencyKey: true,
        creationStatus: firstResponse.status(),
        replayStatus: replayResponse.status(),
        sameOrderRetry: true,
        sameKeyRetry: true,
        opaqueCartReferenceOnly: true,
        clientAuthoritativeTotals: false,
        nativeStatus: backendVerification.nativeStatus,
        logicalStatus: backendVerification.logicalStatus,
        reservationCount: backendVerification.reservationCount,
        reservationLinkedToOrderLines:
          backendVerification.reservationLinkedToOrderLines,
        serverComputedExpiry: backendVerification.serverComputedExpiry,
        controlledExpiry: expiryVerification.controlledClock,
        reservationsReleased: expiryVerification.reservationsReleased,
        repeatedCleanupSafe: expiryVerification.repeatedCleanupSafe,
        expiredRetryStatus: expiredRetryResponse.status(),
        expiredRetryRejected: true,
        expiredRetryCountsUnchanged: true,
        expiredRetryShowsSanitizedError: true,
        providerRequest: false,
        forbiddenProviderRequestCount: forbiddenProviderRequests.length,
        browserStorage: "opaque-cart-reference-only",
        artifactPrivacy:
          "pending-state-only screenshot contains a synthetic opaque order ID and expiry; no trace, cookies, contact data, credentials, or provider payloads",
      },
    };
  } finally {
    page.off("request", captureRequest);
  }
}

function waitForPendingOrderResponse(page) {
  return page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/store/checkout/order` &&
      response.request().method() === "POST",
    { timeout: 60_000 }
  );
}

async function submitCheckoutFromBrowser(page, deliveryMethod, paymentMethod, tariffPattern) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/store/checkout` &&
      response.request().method() === "POST",
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: "Validate checkout details" }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const body = await response.json();
  assert.equal(body.snapshot?.delivery_method, deliveryMethod);
  assert.equal(body.payment_id, paymentMethod);
  await visible(page.locator('[data-checkout-handoff="validated"]'));
  const selected = page.locator(`[data-delivery-option="${deliveryMethod}"]`);
  await visible(selected);
  assert.match(await selected.innerText(), tariffPattern);
}

async function verifyWishlist(browser, publishableKey, fixtures) {
  assert.ok(fixtures?.state?.productIds, "Wishlist fixture state is missing.");
  logStep("verifying wishlist lifecycle through real Medusa and browser boundaries");

  const lifecycle = runWishlistAcceptancePhase(fixtures, "read");
  const catalogProduct = await readProductDetail(
    "steel-telescopic-curtain-rod",
    publishableKey
  );
  const detailProduct = await readProductDetail(
    "basic-home-hook-set",
    publishableKey
  );

  const customerAContext = await browser.newContext();
  customerAContext.setDefaultNavigationTimeout(120_000);
  customerAContext.setDefaultTimeout(60_000);
  const customerAPage = await customerAContext.newPage();
  let customerBContext;
  let durableContext;
  let expiredContext;
  let finalContext;

  try {
    const browserCustomerId = await authenticateBrowserCustomer(
      customerAContext,
      customerAPage,
      "google"
    );
    const browserSetup = runWishlistAcceptancePhase(
      fixtures,
      "browser-setup",
      browserCustomerId
    );
    const browserSetupProjection = await verifyRetainedWishlistProjection(
      customerAPage,
      publishableKey,
      browserSetup.browserFixtures
    );
    await verifyWishlistCatalogAndDetailMutations(
      customerAPage,
      catalogProduct,
      detailProduct
    );
    await customerAPage.goto(`${storefrontUrl}/`);
    await wishlistButton(customerAPage, catalogProduct.id).click();
    await waitForWishlistButtonState(customerAPage, catalogProduct.id, "saved");

    customerBContext = await browser.newContext();
    customerBContext.setDefaultNavigationTimeout(120_000);
    customerBContext.setDefaultTimeout(60_000);
    const customerBPage = await customerBContext.newPage();
    await authenticateBrowserCustomer(customerBContext, customerBPage, "vkid");
    await verifyWishlistCustomerIsolation(
      customerAPage,
      customerBPage,
      catalogProduct
    );
    await customerBContext.close();
    customerBContext = null;

    const hiddenVisibility = await verifyWishlistVisibility(
      customerAPage,
      publishableKey,
      browserSetup.browserFixtures
    );
    const restored = await verifyRestoredWishlistProduct(
      customerAPage,
      browserSetup.browserFixtures.restored
    );
    const outOfStock = await verifyOutOfStockWishlistProduct(
      customerAPage,
      publishableKey,
      browserSetup.browserFixtures.outOfStock
    );

    const guest = await verifyGuestWishlistRouting(
      browser,
      catalogProduct
    );
    const mergeBlockedEvidence = await verifyMergeBlockedWishlist(
      browser,
      publishableKey,
      catalogProduct
    );

    await customerAPage.goto(`${storefrontUrl}/checkout`);
    await visible(customerAPage.locator('[data-checkout-continuation="ft-006-handoff"]'));
    await customerAPage.getByRole("button", { name: "Log out" }).click();
    await waitForCleanStorefrontPath(customerAPage, "/login");
    assert.equal(
      (
        await browserStoreRequest(customerAPage, {
          path: "/store/customers/me",
          method: "GET",
          publishableKey,
        })
      ).status,
      401
    );
    await assertWishlistStoragePrivacy(customerAPage, []);

    durableContext = await browser.newContext();
    durableContext.setDefaultNavigationTimeout(120_000);
    durableContext.setDefaultTimeout(60_000);
    const durablePage = await durableContext.newPage();
    await authenticateBrowserCustomer(durableContext, durablePage, "google");
    await durablePage.goto(`${storefrontUrl}/wishlist`);
    await waitForWishlistPageState(durablePage, "products");
    await visible(durablePage.locator(`[data-product-id="${catalogProduct.id}"]`));

    expiredContext = durableContext;
    const expiredPage = durablePage;
    const expired = await browserStoreRequest(expiredPage, {
      path: "/auth/session",
      method: "DELETE",
      publishableKey,
    });
    assert.equal(expired.status, 200);
    await expiredPage
      .locator(`[data-product-id="${catalogProduct.id}"] button`)
      .click();
    await waitForWishlistPageState(expiredPage, "session-expired");
    await assertWishlistStoragePrivacy(expiredPage, []);
    await expiredContext.close();
    expiredContext = null;
    durableContext = null;

    finalContext = await browser.newContext();
    finalContext.setDefaultNavigationTimeout(120_000);
    finalContext.setDefaultTimeout(60_000);
    const finalPage = await finalContext.newPage();
    await authenticateBrowserCustomer(finalContext, finalPage, "google");
    await finalPage.goto(`${storefrontUrl}/wishlist`);
    await waitForWishlistPageState(finalPage, "products");
    await visible(finalPage.locator(`[data-product-id="${catalogProduct.id}"]`));
    await finalPage
      .locator(`[data-product-id="${catalogProduct.id}"] button`)
      .click();
    await finalPage
      .locator(`article.wishlistCard[data-product-id="${catalogProduct.id}"]`)
      .waitFor({ state: "detached" });
    await waitForWishlistPageState(finalPage, "products");
    assert.equal(
      await finalPage.locator(
        `article.wishlistCard[data-product-id="${catalogProduct.id}"]`
      ).count(),
      0
    );
    await browserStoreRequest(finalPage, {
      path: "/auth/session",
      method: "DELETE",
      publishableKey,
    });

    const evidence = {
      status: "ok",
      realBrowser: true,
      sourceBoundary: "playwright-storefront-medusa-session-cookie-postgresql",
      catalogDetailWishlist: true,
      reloadPersistence: true,
      twoCustomerIsolation: true,
      guestLoginRouting: guest,
      browserSetup: {
        browserCustomerBound: browserSetup.browserCustomerBound,
        retainedRows: browserSetup.retainedRows,
        salesChannelResolution: browserSetup.salesChannelResolution,
        fixtureSalesChannelAligned: browserSetup.fixtureSalesChannelAligned,
        sanitizedFixtureHandoff: true,
      },
      browserSetupProjection,
      hiddenVisibility,
      restoredProduct: restored,
      outOfStock,
      mergeBlockedWishlistIndependence: mergeBlockedEvidence,
      logoutCleanup: true,
      sessionExpiryCleanup: true,
      storageScan: true,
      backendLifecycleAcceptance: lifecycle,
      syntheticFixturesOnly: true,
      evidencePrivacy: "coarse-assertions-only-no-cookies-or-session-identifiers",
    };
    fs.writeFileSync(
      path.join(outputDir, "wishlist-browser-report.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8"
    );
    await customerAPage.screenshot({
      path: path.join(outputDir, "wishlist-session-expired.png"),
      fullPage: true,
    });
    return evidence;
  } finally {
    await customerBContext?.close().catch(() => {});
    await expiredContext?.close().catch(() => {});
    await durableContext?.close().catch(() => {});
    await finalContext?.close().catch(() => {});
    await customerAContext.close().catch(() => {});
  }
}

async function verifyWishlistCatalogAndDetailMutations(
  page,
  catalogProduct,
  detailProduct
) {
  await page.goto(`${storefrontUrl}/`);
  await visible(page.getByRole("heading", { name: "Home goods" }));
  await wishlistButton(page, catalogProduct.id).click();
  await waitForWishlistButtonState(page, catalogProduct.id, "saved");

  await page.goto(`${storefrontUrl}/products/${catalogProduct.handle}`);
  await visible(page.getByRole("heading", { name: catalogProduct.title }));
  await waitForWishlistButtonState(page, catalogProduct.id, "saved");
  await wishlistButton(page, catalogProduct.id).click();
  await waitForWishlistButtonState(page, catalogProduct.id, "idle");

  await page.goto(`${storefrontUrl}/products/${detailProduct.handle}`);
  await visible(page.getByRole("heading", { name: detailProduct.title }));
  await wishlistButton(page, detailProduct.id).click();
  await waitForWishlistButtonState(page, detailProduct.id, "saved");
  await page.reload();
  await waitForWishlistButtonState(page, detailProduct.id, "saved");

  await page.goto(`${storefrontUrl}/wishlist`);
  await waitForWishlistPageState(page, "products");
  await visible(page.locator(`[data-product-id="${detailProduct.id}"]`));
  await wishlistButton(page, detailProduct.id).click();
  await page
    .locator(`article.wishlistCard[data-product-id="${detailProduct.id}"]`)
    .waitFor({ state: "detached" });
  await waitForWishlistPageState(page, "products");
  assert.equal(
    await page.locator(`article.wishlistCard[data-product-id="${detailProduct.id}"]`).count(),
    0
  );

  await page.goto(`${storefrontUrl}/`);
  await wishlistButton(page, catalogProduct.id).click();
  await waitForWishlistButtonState(page, catalogProduct.id, "saved");
  await page.reload();
  await waitForWishlistButtonState(page, catalogProduct.id, "saved");
  await wishlistButton(page, catalogProduct.id).click();
  await waitForWishlistButtonState(page, catalogProduct.id, "idle");
  await assertWishlistStoragePrivacy(page, []);
}

async function verifyWishlistCustomerIsolation(pageA, pageB, product) {
  await pageB.goto(`${storefrontUrl}/wishlist`);
  await waitForWishlistPageState(pageB, "empty");
  const foreignRemove = await browserStoreRequest(pageB, {
    path: `/store/wishlist/items/${encodeURIComponent(product.id)}`,
    method: "DELETE",
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  });
  assert.equal(foreignRemove.status, 200);
  assert.deepEqual(foreignRemove.body, {
    product_id: product.id,
    removed: false,
  });

  await pageB.goto(`${storefrontUrl}/`);
  await wishlistButton(pageB, product.id).click();
  await waitForWishlistButtonState(pageB, product.id, "saved");
  await wishlistButton(pageB, product.id).click();
  await waitForWishlistButtonState(pageB, product.id, "idle");

  await pageA.goto(`${storefrontUrl}/wishlist`);
  await waitForWishlistPageState(pageA, "products");
  await visible(pageA.locator(`[data-product-id="${product.id}"]`));
  await assertWishlistStoragePrivacy(pageB, []);
}

async function verifyWishlistVisibility(page, publishableKey, browserFixtures) {
  const hiddenProducts = browserFixtures.hiddenProductIds;
  const signatures = [];
  for (const productId of hiddenProducts) {
    const result = await browserStoreRequest(page, {
      path: "/store/wishlist/items",
      method: "POST",
      publishableKey,
      body: { product_id: productId },
    });
    assert.equal(result.status, 404);
    assert.deepEqual(Object.keys(result.body || {}), ["error"]);
    assert.equal(result.body.error.code, "wishlist_product_not_found");
    assert.deepEqual(result.body.error.details, {});
    assertEvidencePrivacy(JSON.stringify(result.body));
    signatures.push(JSON.stringify(result.body));
  }
  assert.equal(new Set(signatures).size, 1);

  const listed = await browserStoreRequest(page, {
    path: "/store/wishlist",
    method: "GET",
    publishableKey,
  });
  assert.equal(listed.status, 200);
  for (const productId of hiddenProducts) {
    assert.equal(
      (listed.body.items || []).some((item) => item.product_id === productId),
      false
    );
  }
  return {
    hiddenAdd404: true,
    unifiedError: true,
    listOmission: true,
    durableHiddenRowsOmitted: true,
    cases: 4,
  };
}

async function verifyRetainedWishlistProjection(page, publishableKey, browserFixtures) {
  const restoredProduct = await browserStoreRequest(page, {
    path: `/store/product-detail/${encodeURIComponent(browserFixtures.restored.handle)}`,
    method: "GET",
    publishableKey,
  });
  const outOfStockProduct = await browserStoreRequest(page, {
    path: `/store/product-detail/${encodeURIComponent(browserFixtures.outOfStock.handle)}`,
    method: "GET",
    publishableKey,
  });
  const listed = await browserStoreRequest(page, {
    path: "/store/wishlist",
    method: "GET",
    publishableKey,
  });
  assert.equal(listed.status, 200);
  const items = listed.body.items || [];
  const restored = items.find(
    (item) => item.product_id === browserFixtures.restored.productId
  );
  const outOfStock = items.find(
    (item) => item.product_id === browserFixtures.outOfStock.productId
  );
  assert.ok(
    restored,
    `Browser setup projection mismatch: restoredDetail=${restoredProduct.status}, outOfStockDetail=${outOfStockProduct.status}, visibleRows=${items.length}, restoredPresent=${Boolean(restored)}, outOfStockPresent=${Boolean(outOfStock)}`
  );
  assert.ok(outOfStock, "Browser setup did not retain the out-of-stock product.");
  assert.equal(outOfStock.product.is_available, false);
  return {
    visibleRows: 2,
    restoredPresent: true,
    outOfStockPresent: true,
    outOfStockUnavailable: true,
  };
}

async function verifyRestoredWishlistProduct(page, fixture) {
  const listed = await browserStoreRequest(page, {
    path: "/store/wishlist",
    method: "GET",
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  });
  assert.equal(listed.status, 200);
  const item = (listed.body.items || []).find(
    (candidate) => candidate.product_id === fixture.productId
  );
  assert.ok(item, "Restored wishlist product is missing from the browser list.");
  assert.equal(item.product.id, fixture.productId);
  assert.equal(item.product.handle, fixture.handle);
  return {
    browserListBoundaryChecked: true,
    restoredProductVisible: true,
    currentHandleChecked: true,
  };
}

async function verifyOutOfStockWishlistProduct(page, publishableKey, fixture) {
  const listed = await browserStoreRequest(page, {
    path: "/store/wishlist",
    method: "GET",
    publishableKey,
  });
  assert.equal(listed.status, 200);
  const item = (listed.body.items || []).find(
    (candidate) => candidate.product_id === fixture.productId
  );
  assert.ok(item, "Out-of-stock wishlist product is missing from the browser list.");
  assert.equal(item.product.id, fixture.productId);
  assert.equal(item.product.handle, fixture.handle);
  assert.equal(item.product.is_available, false);
  return {
    browserListBoundaryChecked: true,
    visibleUnavailable: true,
    isAvailableFalse: true,
  };
}

async function verifyGuestWishlistRouting(browser, product) {
  const context = await browser.newContext();
  context.setDefaultNavigationTimeout(120_000);
  context.setDefaultTimeout(60_000);
  try {
    const page = await context.newPage();
    await page.goto(`${storefrontUrl}/`);
    const button = wishlistButton(page, product.id);
    await button.click();
    await waitForCleanStorefrontPath(page, "/login");
    await assertReturnPathEnvelope(page, "/");
    await assertWishlistStoragePrivacy(page, [], [authReturnPathKey]);
    return { loginRoute: true, noGuestPersistence: true };
  } finally {
    await context.close().catch(() => {});
  }
}

async function verifyMergeBlockedWishlist(browser, publishableKey, product) {
  const context = await browser.newContext();
  context.setDefaultNavigationTimeout(120_000);
  context.setDefaultTimeout(60_000);
  const page = await context.newPage();
  await installAuthProviderRoutes(context);
  let mergeAttempts = 0;
  await page.route(`${backendUrl}/store/carts/*/merge`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    mergeAttempts += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      headers: {
        "access-control-allow-credentials": "true",
        "access-control-allow-origin": storefrontUrl,
      },
      body: JSON.stringify({ error: { code: "cart_merge_stock_conflict" } }),
    });
  });

  try {
    const productDetail = await readProductDetail(product.handle, publishableKey);
    await addConfiguredVariantToCart(
      page,
      productDetail,
      requiredVariant(productDetail, "CR-STL-BLK-160-300"),
      publishableKey
    );
    await page.goto(`${storefrontUrl}/checkout`);
    await waitForCleanStorefrontPath(page, "/login");
    await completeProviderAttempt(page, "google", "success");
    await page.waitForURL(
      (url) => url.origin === storefrontUrl && url.pathname === "/auth/complete",
      { timeout: 30_000 }
    );
    await visible(page.locator('[data-auth-completion-state="merge_blocked"]'));
    assert.ok(mergeAttempts >= 1);

    await page.goto(`${storefrontUrl}/wishlist`);
    await waitForWishlistPageState(page, "products");
    await waitForWishlistButtonState(page, product.id, "saved");
    await page.goto(`${storefrontUrl}/`);
    await waitForWishlistButtonState(page, product.id, "saved");
    await wishlistButton(page, product.id).click();
    await waitForWishlistButtonState(page, product.id, "idle");
    await wishlistButton(page, product.id).click();
    await waitForWishlistButtonState(page, product.id, "saved");

    await page.goto(`${storefrontUrl}/checkout`);
    await visible(page.locator('[data-checkout-auth-state="merge_blocked"]'));
    await visible(page.locator('[data-cart-readiness="blocked"]'));
    assert.equal(
      await page.locator('[data-checkout-continuation="ft-006-handoff"]').count(),
      0
    );
    await assertWishlistStoragePrivacy(page, [cartReferenceKey], [authReturnPathKey]);
    return { validCustomerWishlist: true, checkoutBlocked: true };
  } finally {
    await browserStoreRequest(page, {
      path: "/auth/session",
      method: "DELETE",
      publishableKey,
    }).catch(() => {});
    await context.close().catch(() => {});
  }
}

async function authenticateBrowserCustomer(context, page, provider) {
  await installAuthProviderRoutes(context);
  await page.goto(`${storefrontUrl}/login`);
  await completeProviderAttempt(page, provider, "success");
  await page.waitForURL(
    (url) =>
      url.origin === storefrontUrl &&
      (url.pathname === "/auth/complete" || url.pathname === "/"),
    { timeout: 30_000 }
  );
  await page.goto(`${storefrontUrl}/`);
  const current = await waitForCurrentCustomer(page);
  assert.match(current.body.customer?.id || "", /^cus_/);
  return current.body.customer.id;
}

async function waitForCurrentCustomer(page) {
  const deadline = Date.now() + 30_000;
  let lastStatus = null;
  while (Date.now() < deadline) {
    const current = await browserStoreRequest(page, {
      path: "/store/customers/me",
      method: "GET",
      publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
    });
    lastStatus = current.status;
    if (current.status === 200) return current;
    await delay(250);
  }
  throw new Error(`Timed out waiting for synthetic customer session; status=${lastStatus}`);
}

function wishlistButton(page, productId) {
  return page.locator(`button[data-product-id="${productId}"]`).first();
}

async function waitForWishlistButtonState(page, productId, state) {
  const button = wishlistButton(page, productId);
  await visible(button);
  await page.waitForFunction(
    ({ productId: expectedProductId, expectedState }) =>
      document.querySelector(
        `button[data-product-id="${expectedProductId}"]`
      )?.getAttribute("data-wishlist-state") === expectedState,
    { productId, expectedState: state },
    { timeout: 30_000 }
  );
  assert.equal(await button.getAttribute("data-wishlist-state"), state);
}

async function waitForWishlistPageState(page, state) {
  await visible(page.locator(`main[data-wishlist-page-state="${state}"]`));
}

async function assertWishlistStoragePrivacy(
  page,
  allowedLocalKeys,
  allowedSessionKeys = []
) {
  const storage = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  const serialized = JSON.stringify(storage);
  assertEvidencePrivacy(serialized);
  const localKeys = Object.keys(storage.local);
  assert.equal(
    localKeys.some((key) => /wishlist|favorite|customer|product/i.test(key)),
    false
  );
  assert.equal(
    localKeys.every((key) => allowedLocalKeys.includes(key)),
    true
  );
  const sessionKeys = Object.keys(storage.session).filter(
    (key) => !key.startsWith("__next_debug_channel:")
  );
  assert.equal(
    sessionKeys.every((key) => allowedSessionKeys.includes(key)),
    true
  );
}

function createWishlistAcceptanceFixtures(publishableKey) {
  const runId = `task042${process.pid.toString(36)}${Date.now().toString(36)}`;
  const stateFile = path.join(
    os.tmpdir(),
    `${runId}-wishlist-acceptance-state.json`
  );
  const fixtures = { runId, stateFile, state: null, publishableKey };
  try {
    runWishlistAcceptancePhase(fixtures, "write");
    fixtures.state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    assert.equal(fixtures.state.runId, runId);
    assert.equal(Object.keys(fixtures.state.productIds || {}).length, 6);
    return fixtures;
  } catch (error) {
    cleanupWishlistAcceptanceFixtures(fixtures);
    throw error;
  }
}

function runWishlistAcceptancePhase(fixtures, phase, browserCustomerId = null) {
  const output = execFileSync(
    process.execPath,
    [medusaCli, "exec", "./src/scripts/smoke-wishlist-acceptance.ts"],
    {
      cwd: backendDir,
      env: childEnv({
        WISHLIST_ACCEPTANCE_PHASE: phase,
        WISHLIST_ACCEPTANCE_RUN_ID: fixtures.runId,
        WISHLIST_ACCEPTANCE_STATE_FILE: fixtures.stateFile,
        WISHLIST_ACCEPTANCE_PUBLISHABLE_API_KEY: fixtures.publishableKey,
        ...(browserCustomerId
          ? { WISHLIST_ACCEPTANCE_BROWSER_CUSTOMER_ID: browserCustomerId }
          : {}),
      }),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  const result = extractAcceptanceResult(output, phase);
  assert.match(output, new RegExp(`\\"phase\\"\\s*:\\s*\\"${phase}\\"`));
  assert.match(output, /\"status\"\s*:\s*\"ok\"/);
  assert.equal(result.phase, phase);
  assert.equal(result.status, "ok");
  if (phase === "write" || phase === "browser-setup") {
    assert.equal(result.salesChannelResolution, "publishable-key-query");
    assert.equal(result.fixtureSalesChannelAligned, true);
  }
  const assertions = [
    "hidden404AndListOmission",
    "visibilityRestoration",
    "outOfStockVisibleUnavailable",
  ];
  if (phase === "read") {
    for (const assertion of assertions) {
      assert.match(output, new RegExp(`\\"${assertion}\\"\\s*:\\s*true`));
    }
  }
  if (phase === "browser-setup") {
    assert.equal(result.browserCustomerBound, true);
    assert.deepEqual(result.retainedRows, {
      hidden: 4,
      restored: 1,
      outOfStock: 1,
    });
    const browserFixtures = result.browserFixtures;
    assert.ok(browserFixtures);
    assert.equal(browserFixtures.hiddenProductIds?.length, 4);
    browserFixtures.hiddenProductIds.forEach((productId) =>
      assert.match(productId, /^prod_[A-Za-z0-9_-]+$/)
    );
    for (const fixture of [browserFixtures.restored, browserFixtures.outOfStock]) {
      assert.match(fixture?.productId || "", /^prod_[A-Za-z0-9_-]+$/);
      assert.match(fixture?.handle || "", /^[a-z0-9-]+$/);
    }
    return {
      phase,
      status: "ok",
      realMedusaPostgresql: true,
      salesChannelResolution: result.salesChannelResolution,
      fixtureSalesChannelAligned: result.fixtureSalesChannelAligned,
      browserCustomerBound: true,
      retainedRows: result.retainedRows,
      browserFixtures: {
        hiddenProductIds: browserFixtures.hiddenProductIds,
        restored: {
          productId: browserFixtures.restored.productId,
          handle: browserFixtures.restored.handle,
        },
        outOfStock: {
          productId: browserFixtures.outOfStock.productId,
          handle: browserFixtures.outOfStock.handle,
        },
      },
    };
  }
  return {
    phase,
    status: "ok",
    realMedusaPostgresql: true,
    ...(phase === "read"
      ? {
          assertions: {
            hidden404AndListOmission: true,
            visibilityRestoration: true,
            outOfStockVisibleUnavailable: true,
          },
        }
      : {}),
  };
}

function extractAcceptanceResult(
  output,
  phase,
  suite = "wishlist-acceptance"
) {
  const results = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" && depth === 0) {
      start = index;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(output.slice(start, index + 1));
          if (
            parsed?.suite === suite &&
            parsed.phase === phase &&
            parsed.status === "ok"
          ) {
            results.push(parsed);
          }
        } catch (_error) {
          // Ignore non-JSON brace blocks emitted by the CLI logger.
        }
        start = -1;
      }
    }
  }

  assert.ok(
    results.length > 0,
    `Missing sanitized ${suite} ${phase} acceptance result.`
  );
  return results.at(-1);
}

function cleanupWishlistAcceptanceFixtures(fixtures) {
  try {
    runWishlistAcceptancePhase(fixtures, "cleanup");
  } finally {
    fs.rmSync(fixtures.stateFile, { force: true });
  }
}

function createCheckoutAcceptanceFixtures() {
  const runId = `task049${process.pid.toString(36)}${Date.now().toString(36)}`;
  const stateFile = path.join(
    os.tmpdir(),
    `${runId}-checkout-delivery-state.json`
  );
  const fixtures = { runId, stateFile };
  try {
    runBackendAcceptancePhase(fixtures, "browser-fixtures");
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    assert.equal(state.runId, runId);
    assert.equal(state.resourceLedger?.optionIds?.length, 3);
    return fixtures;
  } catch (error) {
    cleanupCheckoutAcceptanceFixtures(fixtures);
    throw error;
  }
}

function runBackendAcceptancePhase(fixtures, phase) {
  let output;
  logStep(`starting checkout backend phase: ${phase}`);
  try {
    output = execFileSync(
      process.execPath,
      [medusaCli, "exec", "./src/scripts/smoke-checkout-delivery-acceptance.ts"],
      {
        cwd: backendDir,
        env: childEnv({
          CHECKOUT_ACCEPTANCE_PHASE: phase,
          CHECKOUT_ACCEPTANCE_STATE_FILE: fixtures.stateFile,
          CHECKOUT_ACCEPTANCE_RUN_ID: fixtures.runId,
        }),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 8 * 1024 * 1024,
        timeout: selectedSuites.includes("pending-order") ? 600_000 : 240_000,
      }
    );
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`TASK-049 checkout fixture phase failed: ${phase}${detail}`);
  }
  assert.match(output, new RegExp(`\"phase\"\\s*:\\s*\"${phase}\"`));
  assert.match(output, /\"status\"\s*:\s*\"ok\"/);
  logStep(`completed checkout backend phase: ${phase}`);
}

function cleanupCheckoutAcceptanceFixtures(fixtures) {
  if (!fs.existsSync(fixtures.stateFile)) return;
  try {
    runBackendAcceptancePhase(fixtures, "browser-cleanup");
    fs.rmSync(fixtures.stateFile, { force: true });
    fs.rmSync(`${fixtures.stateFile}.tmp`, { force: true });
  } catch (error) {
    // Keep the persisted ledger so a later browser-cleanup phase can recover it.
    throw error;
  }
}

function createPendingOrderAcceptanceFixtures() {
  const runId = `task052${process.pid.toString(36)}${Date.now().toString(36)}`;
  return {
    runId,
    stateFile: path.join(
      os.tmpdir(),
      `${runId}-pending-order-browser-state.json`
    ),
  };
}

function writePendingOrderBrowserState(fixtures, update) {
  const current = fs.existsSync(fixtures.stateFile)
    ? JSON.parse(fs.readFileSync(fixtures.stateFile, "utf8"))
    : { runId: fixtures.runId };
  const next = { ...current, ...update, runId: fixtures.runId };
  const tempPath = `${fixtures.stateFile}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(next), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(tempPath, fixtures.stateFile);
}

function runPendingOrderAcceptancePhase(fixtures, phase) {
  let output;
  logStep(`starting pending-order backend phase: ${phase}`);
  try {
    output = execFileSync(
      process.execPath,
      [medusaCli, "exec", "./src/scripts/smoke-pending-order-acceptance.ts"],
      {
        cwd: backendDir,
        env: childEnv({
          PENDING_ORDER_ACCEPTANCE_PHASE: phase,
          PENDING_ORDER_ACCEPTANCE_STATE_FILE: fixtures.stateFile,
        }),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 8 * 1024 * 1024,
        timeout: 600_000,
      }
    );
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`TASK-052 pending-order phase failed: ${phase}${detail}`);
  }
  const result = extractAcceptanceResult(
    output,
    phase,
    "pending-order-browser"
  );
  assert.equal(result.status, "ok");
  assert.equal(result.providerRequest, false);
  assert.equal(result.productionData, false);
  logStep(`completed pending-order backend phase: ${phase}`);
  return result;
}

function cleanupPendingOrderAcceptanceFixtures(fixtures) {
  if (!fs.existsSync(fixtures.stateFile)) return;
  try {
    runPendingOrderAcceptancePhase(fixtures, "browser-cleanup");
    fs.rmSync(fixtures.stateFile, { force: true });
    fs.rmSync(`${fixtures.stateFile}.tmp`, { force: true });
  } catch (error) {
    // Keep the exact local ledger so the cleanup phase can be retried safely.
    throw error;
  }
}

async function installAuthProviderRoutes(context) {
  for (const [provider, pattern] of [
    ["google", "https://accounts.google.com/o/oauth2/v2/auth**"],
    ["vkid", "https://id.vk.com/authorize**"],
  ]) {
    await context.route(pattern, async (route) => {
      const authorization = new URL(route.request().url());
      const callback = authorization.searchParams.get("redirect_uri");
      const state = authorization.searchParams.get("state");
      assert.equal(
        callback,
        `${backendUrl}/auth/customer/${provider}/complete`
      );
      assert.ok(state);

      const success = new URL(callback);
      success.searchParams.set("code", `task034-${provider}-success`);
      success.searchParams.set("state", state);
      if (provider === "vkid") success.searchParams.set("device_id", "task034-device");

      const failure = new URL(callback);
      failure.searchParams.set("code", `task034-${provider}-failure`);
      failure.searchParams.set("state", state);
      if (provider === "vkid") failure.searchParams.set("device_id", "task034-device");

      const cancel = new URL(callback);
      cancel.searchParams.set("error", "access_denied");
      cancel.searchParams.set("state", state);

      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: providerPage(provider, {
          cancel: cancel.toString(),
          failure: failure.toString(),
          success: success.toString(),
        }),
      });
    });
  }
}

function providerPage(provider, destinations) {
  const label = provider === "google" ? "Google" : "VK ID";
  return `<!doctype html><html><body><main><h1>${label} local provider</h1>
    <button id="approve">Continue</button><button id="cancel">Cancel</button>
    <button id="fail">Fail safely</button></main><script>
    const destinations = ${JSON.stringify(destinations)};
    document.querySelector('#approve').onclick = () => location.assign(destinations.success);
    document.querySelector('#cancel').onclick = () => location.assign(destinations.cancel);
    document.querySelector('#fail').onclick = () => location.assign(destinations.failure);
    </script></body></html>`;
}

async function completeProviderAttempt(page, provider, mode) {
  await page
    .getByRole("button", { name: provider === "google" ? "Google" : "VK ID" })
    .click();
  await page.waitForURL(
    (url) =>
      url.origin === (provider === "google" ? "https://accounts.google.com" : "https://id.vk.com"),
    { timeout: 20_000 }
  );
  const authorization = new URL(page.url());
  const callback = new URL(authorization.searchParams.get("redirect_uri"));
  callback.searchParams.set(
    mode === "cancel" ? "error" : "code",
    mode === "cancel" ? "access_denied" : `task034-${provider}-${mode}`
  );
  callback.searchParams.set("state", authorization.searchParams.get("state"));
  if (provider === "vkid" && mode !== "cancel") {
    callback.searchParams.set("device_id", "task034-device");
  }
  const callbackResponse = page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return (
        url.origin === backendUrl &&
        url.pathname === `/auth/customer/${provider}/complete`
      );
    },
    { timeout: 30_000 }
  );
  await page
    .getByRole("button", {
      name: mode === "success" ? "Continue" : mode === "cancel" ? "Cancel" : "Fail safely",
    })
    .click();
  const response = await callbackResponse;
  const headers = await response.allHeaders();
  return {
    url: callback.toString(),
    status: response.status(),
    setCookie: Object.hasOwn(headers, "set-cookie"),
  };
}

async function waitForCleanStorefrontPath(page, pathname) {
  await page.waitForURL(
    (url) =>
      url.origin === storefrontUrl &&
      url.pathname === pathname &&
      url.search === "" &&
      url.hash === "",
    { timeout: 30_000 }
  );
}

async function assertReturnPathEnvelope(page, expectedPath) {
  const value = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, authReturnPathKey);
  assert.deepEqual(value, { version: 1, path: expectedPath });
}

async function assertReturnPathAbsent(page) {
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), authReturnPathKey),
    null
  );
}

async function readBrowserCartReference(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, cartReferenceKey);
}

async function assertBrowserStoragePrivacy(page) {
  const storage = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
  }));
  assertEvidencePrivacy(JSON.stringify(storage));
  assert.equal(
    Object.keys(storage.local).every((key) => key === cartReferenceKey),
    true
  );
  const unexpectedSessionKeys = Object.keys(storage.session).filter(
    (key) => !key.startsWith("__next_debug_channel:")
  );
  assert.deepEqual(unexpectedSessionKeys, []);
}

function assertEvidencePrivacy(value) {
  assert.equal(
    /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|service[_-]?token|connect\.sid|@example\.test)/i.test(
      value
    ),
    false
  );
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
  backendStartupDiagnostics = "";
  fs.writeFileSync(backendLogPath, "", "utf8");
  const log = fs.createWriteStream(backendLogPath, { flags: "a" });
  const medusaCli = require.resolve("@medusajs/cli/cli");
  const child = spawn(process.execPath, [medusaCli, "start"], {
    cwd: compiledBackendDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (
    selectedSuites.some((suite) =>
      ["auth", "wishlist", "checkout-delivery", "pending-order"].includes(suite)
    )
  ) {
    log.write("backend_output=suppressed_for_sensitive_browser_acceptance\n");
    child.stdout.resume();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      backendStartupDiagnostics = `${backendStartupDiagnostics}${chunk}`.slice(-8_192);
    });
  } else {
    child.stdout.pipe(log);
    child.stderr.pipe(log);
  }
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

async function waitForHttp(url, timeoutMs, child = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(
        `Backend exited before ${url} became ready.${formatBackendDiagnostics()}`
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_error) {
      // Startup is still in progress.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}${formatBackendDiagnostics()}`);
}

function formatBackendDiagnostics() {
  const diagnostics = backendStartupDiagnostics.trim();
  if (!diagnostics) return "";
  return `\nBackend startup diagnostics:\n${diagnostics}`;
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
  const supported = [
    "catalog",
    "product-detail",
    "cart",
    "auth",
    "wishlist",
    "checkout-delivery",
    "pending-order",
  ];
  const selected = args.filter((arg) => supported.includes(arg));
  return selected.length > 0 ? Array.from(new Set(selected)) : ["catalog", "product-detail"];
}

function resolveOutputTaskId() {
  const requested = process.env.ESHOP_E2E_OUTPUT_TASK_ID?.trim();
  if (requested) {
    assert.match(requested, /^TASK-[0-9]{3}$/);
    return requested;
  }
  return selectedSuites.includes("wishlist")
    ? "TASK-042"
    : selectedSuites.includes("pending-order")
      ? "TASK-052"
      : selectedSuites.includes("auth")
        ? "TASK-034"
        : selectedSuites.includes("checkout-delivery")
          ? "TASK-049"
          : selectedSuites.includes("cart")
            ? "TASK-026"
            : "TASK-016";
}

function writeRuntimeEvidence(
  noKeyStatus,
  publishableKey,
  cartEvidence,
  authEvidence,
  wishlistEvidence,
  checkoutEvidence,
  pendingOrderEvidence
) {
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
      `browser_auth_acceptance=${authEvidence ? authEvidence.status : "not-run"}`,
      `provider_network=${authEvidence ? authEvidence.providerNetwork : "not-run"}`,
      `artifact_privacy=${authEvidence ? authEvidence.artifactPrivacy : "not-run"}`,
      `browser_wishlist_acceptance=${wishlistEvidence ? wishlistEvidence.status : "not-run"}`,
      `wishlist_storage_scan=${wishlistEvidence ? wishlistEvidence.storageScan : "not-run"}`,
      `browser_checkout_delivery_acceptance=${checkoutEvidence ? checkoutEvidence.status : "not-run"}`,
      `checkout_delivery_artifact_privacy=${checkoutEvidence ? checkoutEvidence.artifactPrivacy : "not-run"}`,
      `checkout_run_id=${checkoutEvidence ? checkoutEvidence.runId : "not-run"}`,
      `checkout_completion_marker=${checkoutEvidence ? checkoutCompletionMarker : "not-run"}`,
      `browser_pending_order_acceptance=${pendingOrderEvidence ? pendingOrderEvidence.status : "not-run"}`,
      `pending_order_same_order_retry=${pendingOrderEvidence ? pendingOrderEvidence.sameOrderRetry : "not-run"}`,
      `pending_order_controlled_expiry=${pendingOrderEvidence ? pendingOrderEvidence.controlledExpiry : "not-run"}`,
      `pending_order_provider_request=${pendingOrderEvidence ? pendingOrderEvidence.providerRequest : "not-run"}`,
      `pending_order_artifact_privacy=${pendingOrderEvidence ? pendingOrderEvidence.artifactPrivacy : "not-run"}`,
      `pending_order_run_id=${pendingOrderEvidence ? pendingOrderEvidence.runId : "not-run"}`,
      `pending_order_completion_marker=${pendingOrderEvidence ? pendingOrderCompletionMarker : "not-run"}`,
      "",
    ].join("\n"),
    "utf8"
  );
}

function checkoutSuccessArtifactPaths() {
  const reportPath = path.join(outputDir, "checkout-browser-report.json");
  const screenshotPath = path.join(outputDir, "checkout-delivery.png");
  return {
    reportPath,
    screenshotPath,
    reportTempPath: `${reportPath}.tmp-${process.pid}`,
    screenshotTempPath: `${screenshotPath}.tmp-${process.pid}`,
    runtimePath: path.join(outputDir, "real-runtime.log"),
  };
}

function invalidateCheckoutSuccessArtifacts() {
  if (!selectedSuites.includes("checkout-delivery")) return;
  const paths = checkoutSuccessArtifactPaths();
  for (const artifactPath of [
    paths.reportPath,
    paths.screenshotPath,
    paths.reportTempPath,
    paths.screenshotTempPath,
    paths.runtimePath,
  ]) {
    fs.rmSync(artifactPath, { force: true });
  }
}

function publishCheckoutSuccessArtifacts(checkoutEvidence, screenshot) {
  if (!checkoutEvidence) return;
  assert.ok(Buffer.isBuffer(screenshot), "Checkout screenshot was not captured in memory.");
  assert.equal(checkoutEvidence.status, "ok");
  assert.match(checkoutEvidence.runId || "", /^task049/);

  const paths = checkoutSuccessArtifactPaths();
  const report = {
    ...checkoutEvidence,
    completionMarker: checkoutCompletionMarker,
    artifactsPublishedAfterCleanup: true,
    requestBodyPrivacy:
      "synthetic values asserted in memory; values omitted from report",
    productionData: false,
  };
  try {
    fs.writeFileSync(paths.screenshotTempPath, screenshot, { mode: 0o600 });
    fs.writeFileSync(
      paths.reportTempPath,
      JSON.stringify(report, null, 2),
      { encoding: "utf8", mode: 0o600 }
    );
    fs.renameSync(paths.screenshotTempPath, paths.screenshotPath);
    fs.renameSync(paths.reportTempPath, paths.reportPath);
  } catch (error) {
    invalidateCheckoutSuccessArtifacts();
    throw error;
  }
}

function pendingOrderSuccessArtifactPaths() {
  const reportPath = path.join(outputDir, "pending-order-browser-report.json");
  const screenshotPath = path.join(outputDir, "pending-order.png");
  return {
    reportPath,
    screenshotPath,
    reportTempPath: `${reportPath}.tmp-${process.pid}`,
    screenshotTempPath: `${screenshotPath}.tmp-${process.pid}`,
    runtimePath: path.join(outputDir, "real-runtime.log"),
    failurePath: path.join(outputDir, "pending-order-failure.png"),
    legacyFailurePath: path.join(outputDir, "real-medusa-failure.png"),
    legacyFailureTracePath: path.join(
      outputDir,
      "real-medusa-failure-trace.zip"
    ),
  };
}

function invalidatePendingOrderSuccessArtifacts() {
  if (!selectedSuites.includes("pending-order")) return;
  const paths = pendingOrderSuccessArtifactPaths();
  for (const artifactPath of [
    paths.reportPath,
    paths.screenshotPath,
    paths.reportTempPath,
    paths.screenshotTempPath,
    paths.runtimePath,
    paths.failurePath,
    paths.legacyFailurePath,
    paths.legacyFailureTracePath,
  ]) {
    fs.rmSync(artifactPath, { force: true });
  }
}

function publishPendingOrderSuccessArtifacts(pendingOrderEvidence, screenshot) {
  if (!pendingOrderEvidence) return;
  assert.ok(
    Buffer.isBuffer(screenshot),
    "Pending-order screenshot was not captured in memory."
  );
  assert.equal(pendingOrderEvidence.status, "ok");
  assert.match(pendingOrderEvidence.runId || "", /^task052/);

  const paths = pendingOrderSuccessArtifactPaths();
  const report = {
    ...pendingOrderEvidence,
    completionMarker: pendingOrderCompletionMarker,
    artifactsPublishedAfterCleanup: true,
    requestBodyPrivacy:
      "synthetic contact values asserted only in memory; values omitted from report",
    syntheticOpaqueOrderIdInScreenshot: true,
    productionData: false,
  };
  try {
    fs.writeFileSync(paths.screenshotTempPath, screenshot, { mode: 0o600 });
    fs.writeFileSync(paths.reportTempPath, JSON.stringify(report, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(paths.screenshotTempPath, paths.screenshotPath);
    fs.renameSync(paths.reportTempPath, paths.reportPath);
  } catch (error) {
    invalidatePendingOrderSuccessArtifacts();
    throw error;
  }
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
    if (suite === "auth") {
      return ["google", "vkid"].map(
        (provider) =>
          `.tasks/${outputTaskId}/playwright/auth-${provider}-checkout.png`
      );
    }
    if (suite === "wishlist") {
      return [
        `.tasks/${outputTaskId}/playwright/wishlist-session-expired.png`,
      ];
    }
    if (suite === "checkout-delivery") {
      return [
        `.tasks/${outputTaskId}/playwright/checkout-delivery.png`,
        `.tasks/${outputTaskId}/playwright/checkout-browser-report.json`,
      ];
    }
    if (suite === "pending-order") {
      return [
        `.tasks/${outputTaskId}/playwright/pending-order.png`,
        `.tasks/${outputTaskId}/playwright/pending-order-browser-report.json`,
      ];
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
    invalidateCheckoutSuccessArtifacts();
    console.error(
      error && (error.stack || error.message)
        ? error.stack || error.message
        : error
    );
    process.exit(1);
  }
);
