const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const cli = require.resolve("@medusajs/cli/cli");
const root = process.cwd();
const backendRoot = path.join(root, "apps", "backend");
const backend = path.join(root, "apps", "backend", ".medusa", "server");
const fixtureScript = path.join(root, ".tasks", "TASK-038", "route-level-fixtures.ts");
const provider = path.join(
  root,
  "apps",
  "storefront",
  "e2e",
  "auth-provider-double.cjs"
);
const base = "http://127.0.0.1:9117";
const publishableKey =
  "pk_6ca6faa76dd58bfcfccef5ccef469c0a67276ed66e2d53f6926519b2855e3469";

let child;
let fixtures;
let cookie = "";

async function waitForHealth() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // The compiled server is still starting.
    }
    await delay(500);
  }
  throw new Error("backend health timeout");
}

async function request(target, options = {}) {
  const url = target.startsWith("http") ? target : `${base}${target}`;
  const response = await fetch(url, {
    redirect: "manual",
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      "x-publishable-api-key": publishableKey,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  for (const line of setCookies) {
    const match = String(line).match(/(?:^|,\s*)(connect\.sid=[^;]+)/);
    if (match) cookie = match[1];
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: response.status, body };
}

async function main() {
  try {
    fixtures = runFixturePhase("setup");
    child = startBackend();
    await waitForHealth();

    const guest = await request("/store/wishlist");
    assert.equal(guest.status, 401);

    const start = await request("/auth/customer/google", {
      method: "POST",
      body: "{}",
    });
    assert.equal(start.status, 200);
    const authorization = new URL(start.body.location);
    const callback = new URL(authorization.searchParams.get("redirect_uri"));
    callback.searchParams.set("code", "task038-google-success");
    callback.searchParams.set("state", authorization.searchParams.get("state"));

    const complete = await request(callback.pathname + callback.search);
    assert.equal(complete.status, 302);

    const currentCustomer = await request("/store/customers/me");
    assert.equal(currentCustomer.status, 200);

    const catalog = await request("/store/catalog?limit=1");
    assert.equal(catalog.status, 200);
    const product = catalog.body.products?.[0];
    assert.ok(product?.id);

    const add = await request("/store/wishlist/items", {
      method: "POST",
      body: JSON.stringify({ product_id: product.id }),
    });
    assert.ok([200, 201].includes(add.status));

    const list = await request("/store/wishlist");
    assert.equal(list.status, 200);
    assert.equal(list.body.count, 1);
    assert.deepEqual(list.body.items[0], add.body.item);

    const remove = await request(
      `/store/wishlist/items/${encodeURIComponent(product.id)}`,
      { method: "DELETE" }
    );
    assert.equal(remove.status, 200);
    assert.equal(remove.body.removed, true);

    const repeatedRemove = await request(
      `/store/wishlist/items/${encodeURIComponent(product.id)}`,
      { method: "DELETE" }
    );
    assert.equal(repeatedRemove.status, 200);
    assert.equal(repeatedRemove.body.removed, false);

    const routeMatrix = await runRouteLevelMatrix(
      fixtures.products,
      fixtures.handles
    );

    const logout = await request("/auth/session", { method: "DELETE" });
    assert.equal(logout.status, 200);
    const afterLogout = await request("/store/wishlist");
    assert.equal(afterLogout.status, 401);

    const evidence = {
      suite: "wishlist-session-boundary",
      status: "ok",
      authTransport: "session-cookie",
      guestStatus: guest.status,
      authStartStatus: start.status,
      callbackStatus: complete.status,
      currentCustomerStatus: currentCustomer.status,
      addStatus: add.status,
      listStatus: list.status,
      removeStatus: remove.status,
      repeatedRemoveStatus: repeatedRemove.status,
      logoutStatus: logout.status,
      afterLogoutWishlistStatus: afterLogout.status,
      routeLevelMatrix: routeMatrix,
    };
    fs.writeFileSync(
      path.join(root, ".tasks", "TASK-038", "route-level-http-matrix.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8"
    );
    process.stdout.write(
      `${JSON.stringify(evidence, null, 2)}\n`
    );
  } finally {
    await stopBackend();
    runFixturePhase("cleanup", fixtures);
  }
}

function startBackend() {
  return spawn(process.execPath, [cli, "start"], {
    cwd: backend,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: "9117",
      BACKEND_PORT: "9117",
      STORE_CORS: "http://127.0.0.1:3117",
      AUTH_CORS: "http://127.0.0.1:3117",
      JWT_SECRET: "task038-local-jwt-secret",
      COOKIE_SECRET: "task038-local-cookie-secret",
      GOOGLE_AUTH_ENABLED: "true",
      GOOGLE_OAUTH_CLIENT_ID: "task038-local-google-client",
      GOOGLE_OAUTH_CLIENT_SECRET: "task038-local-google-secret",
      GOOGLE_OAUTH_CALLBACK_URL: `${base}/auth/customer/google/complete`,
      VK_ID_AUTH_ENABLED: "false",
      ESHOP_E2E_AUTH_PROVIDER_DOUBLE: "true",
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        `--require=${provider}`,
      ]
        .filter(Boolean)
        .join(" "),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
}

function runFixturePhase(phase, ids) {
  const env = {
    ...process.env,
    NODE_ENV: "development",
    TASK038_ROUTE_MATRIX_PHASE: phase,
    TASK038_ROUTE_MATRIX_PUBLISHABLE_KEY: publishableKey,
    ...(ids
      ? { TASK038_ROUTE_MATRIX_FIXTURE_IDS: JSON.stringify(ids) }
      : {}),
  };
  let output = "";
  try {
    output = execFileSync(
      process.execPath,
      [cli, "exec", fixtureScript],
      {
        cwd: backendRoot,
        env,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
  } catch {
    throw new Error(`TASK-038 route fixture ${phase} failed.`);
  }

  if (phase !== "setup") return undefined;
  const marker = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("TASK038_ROUTE_MATRIX_FIXTURES="));
  assert.ok(marker, "Route fixture setup did not return fixture IDs.");
  return JSON.parse(marker.slice("TASK038_ROUTE_MATRIX_FIXTURES=".length));
}

async function stopBackend() {
  if (!child) return;
  const processToStop = child;
  child = undefined;
  if (processToStop.exitCode !== null || processToStop.signalCode !== null) return;

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    processToStop.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    processToStop.kill();
  });
}

async function runRouteLevelMatrix(productIds, handles) {
  const hiddenCases = [
    ["missing", "prod_missing_task038_route_matrix"],
    ["unpublished", productIds.unpublished],
    ["channel-invisible", productIds["channel-invisible"]],
    ["inactive-category", productIds["inactive-category"]],
  ];
  const hiddenResults = [];

  for (const [name, productId] of hiddenCases) {
    const add = await request("/store/wishlist/items", {
      method: "POST",
      body: JSON.stringify({ product_id: productId }),
    });
    assert.equal(add.status, 404);
    assert.deepEqual(add.body.error, {
      code: "wishlist_product_not_found",
      message: "Wishlist product was not found.",
      details: {},
    });
    const list = await request("/store/wishlist");
    assert.equal(list.status, 200);
    assert.equal(list.body.count, 0);
    hiddenResults.push({
      case: name,
      addStatus: add.status,
      addErrorCode: add.body.error.code,
      listStatus: list.status,
      listCount: list.body.count,
    });
  }

  const productDetail = await request(
    `/store/product-detail/${encodeURIComponent(handles["out-of-stock"])}`
  );
  assert.equal(productDetail.status, 200, JSON.stringify(productDetail.body));
  const outOfStock = await request("/store/wishlist/items", {
    method: "POST",
    body: JSON.stringify({ product_id: productIds["out-of-stock"] }),
  });
  assert.equal(outOfStock.status, 201, JSON.stringify(outOfStock.body));
  assert.equal(outOfStock.body.item.product.is_available, false);
  const listed = await request("/store/wishlist");
  assert.equal(listed.status, 200);
  assert.equal(listed.body.count, 1);
  assert.deepEqual(listed.body.items[0], outOfStock.body.item);
  const removed = await request(
    `/store/wishlist/items/${encodeURIComponent(productIds["out-of-stock"])}`,
    { method: "DELETE" }
  );
  assert.deepEqual(removed.body, {
    product_id: productIds["out-of-stock"],
    removed: true,
  });

  return {
    hiddenCases: hiddenResults,
    hiddenErrorSignature: "404:wishlist_product_not_found",
    outOfStock: {
      addStatus: outOfStock.status,
      listStatus: listed.status,
      listCount: listed.body.count,
      isAvailable: outOfStock.body.item.product.is_available,
      removeStatus: removed.status,
    },
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error) => {
  console.error(error.stack || error);
  if (child) child.kill();
  process.exitCode = 1;
});
