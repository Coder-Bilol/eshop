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
const outputTaskId = selectedSuites.includes("wishlist")
  ? "TASK-042"
  : selectedSuites.includes("auth")
    ? "TASK-034"
  : selectedSuites.includes("cart")
    ? "TASK-026"
    : "TASK-016";
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
       NEXT_PUBLIC_E2E_CART_HANDOFF: selectedSuites.some((suite) =>
        ["auth", "cart", "wishlist"].includes(suite)
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
        ["auth", "wishlist"].includes(suite)
      )
        ? "true"
        : "false",
      GOOGLE_OAUTH_CLIENT_ID: "task034-local-google-client",
      GOOGLE_OAUTH_CLIENT_SECRET: "task034-local-google-secret",
      GOOGLE_OAUTH_CALLBACK_URL: `${backendUrl}/auth/customer/google/complete`,
       VK_ID_AUTH_ENABLED: selectedSuites.some((suite) =>
        ["auth", "wishlist"].includes(suite)
      )
        ? "true"
        : "false",
      VK_ID_CLIENT_ID: "340034",
      VK_ID_SERVICE_TOKEN: "task034-local-vk-service-token",
      VK_ID_CALLBACK_URL: `${backendUrl}/auth/customer/vkid/complete`,
       ESHOP_E2E_AUTH_PROVIDER_DOUBLE: selectedSuites.some((suite) =>
        ["auth", "wishlist"].includes(suite)
      )
        ? "true"
        : "false",
       NODE_OPTIONS: selectedSuites.some((suite) =>
        ["auth", "wishlist"].includes(suite)
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
  let cartContext = null;
  let wishlistFixtures = null;

  try {
    logStep("waiting for compiled Medusa health endpoint");
    await waitForHttp(
      `${backendUrl}/health`,
      selectedSuites.some((suite) => ["auth", "wishlist"].includes(suite))
        ? 180_000
        : 90_000
    );
    noKeyStatus = await verifyPublishableKeyBoundary(publishableKey);
    if (selectedSuites.some((suite) => ["auth", "cart"].includes(suite))) {
      cartContext = await resolveCartContext(publishableKey, seedSummary);
    }
    if (selectedSuites.includes("wishlist")) {
      logStep("creating synthetic wishlist lifecycle fixtures");
      wishlistFixtures = createWishlistAcceptanceFixtures(publishableKey);
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
    if (!selectedSuites.includes("auth") && !selectedSuites.includes("wishlist")) {
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

    if (!traceStopped) {
      await context.tracing.stop({
        path: path.join(outputDir, "real-medusa-trace.zip"),
      });
      traceStopped = true;
    }
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
    if (wishlistFixtures) {
      logStep("cleaning synthetic wishlist lifecycle fixtures");
      cleanupWishlistAcceptanceFixtures(wishlistFixtures);
    }
    logStep("stopping Medusa backend");
    await stopChild(backend);
    logStep("checking released ports");
    await waitForPortsReleased();
    logStep("cleanup complete");
  }

  writeRuntimeEvidence(
    noKeyStatus,
    publishableKey,
    cartEvidence,
    authEvidence,
    wishlistEvidence
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
        variantIdentity: "medusa-product-variant-id",
        mediaContract: "string-url",
        trace: selectedSuites.includes("auth")
          ? ["google", "vkid"].map(
              (provider) =>
                `.tasks/${outputTaskId}/playwright/auth-${provider}-sanitized-trace.zip`
            )
          : selectedSuites.includes("wishlist")
            ? `.tasks/${outputTaskId}/playwright/wishlist-browser-report.json`
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

function extractAcceptanceResult(output, phase) {
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
            parsed?.suite === "wishlist-acceptance" &&
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

  assert.ok(results.length > 0, `Missing sanitized ${phase} acceptance result.`);
  return results.at(-1);
}

function cleanupWishlistAcceptanceFixtures(fixtures) {
  try {
    runWishlistAcceptancePhase(fixtures, "cleanup");
  } finally {
    fs.rmSync(fixtures.stateFile, { force: true });
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
  fs.writeFileSync(backendLogPath, "", "utf8");
  const log = fs.createWriteStream(backendLogPath, { flags: "a" });
  const medusaCli = require.resolve("@medusajs/cli/cli");
  const child = spawn(process.execPath, [medusaCli, "start"], {
    cwd: compiledBackendDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  if (selectedSuites.some((suite) => ["auth", "wishlist"].includes(suite))) {
    log.write("backend_output=suppressed_for_sensitive_browser_acceptance\n");
    child.stdout.resume();
    child.stderr.resume();
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
  const supported = ["catalog", "product-detail", "cart", "auth", "wishlist"];
  const selected = args.filter((arg) => supported.includes(arg));
  return selected.length > 0 ? Array.from(new Set(selected)) : ["catalog", "product-detail"];
}

function writeRuntimeEvidence(
  noKeyStatus,
  publishableKey,
  cartEvidence,
  authEvidence,
  wishlistEvidence
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
