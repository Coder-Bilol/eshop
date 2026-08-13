const assert = require("node:assert/strict");
const fs = require("node:fs");
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
  WishlistClientError,
  createStoreWishlistClient,
} = require("../lib/wishlist.ts");

async function run() {
  await verifySessionClientRoutesAndBackendShapes();
  await verifyStableErrorsAndResponseValidation();
  verifyWishlistImplementationDoesNotUseBrowserStorage();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-client",
        status: "ok",
        assertions: [
          "list/add/remove use credentials include and the publishable key without a bearer header",
          "list and mutations validate the exact backend-shaped wishlist responses",
          "backend error codes map to stable sanitized client errors",
          "wishlist client has no localStorage or sessionStorage boundary",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifySessionClientRoutesAndBackendShapes() {
  const calls = [];
  const responses = [
    jsonResponse({ items: [item("prod_1")], count: 1 }),
    jsonResponse({ item: item("prod_2", "Backend truth"), created: true }, 201),
    jsonResponse({ product_id: "prod/2", removed: false }),
  ];
  const client = createStoreWishlistClient({
    baseUrl: "http://backend.test/",
    publishableApiKey: "pk_test_wishlist",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), init });
      return responses.shift();
    },
  });

  assert.equal((await client.list())[0].product_id, "prod_1");
  assert.equal((await client.add(" prod_2 ")).item.product.title, "Backend truth");
  assert.deepEqual(await client.remove("prod/2"), {
    product_id: "prod/2",
    removed: false,
  });

  assert.deepEqual(
    calls.map((call) => [call.init.method, new URL(call.url).pathname]),
    [
      ["GET", "/store/wishlist"],
      ["POST", "/store/wishlist/items"],
      ["DELETE", "/store/wishlist/items/prod%2F2"],
    ]
  );
  assert.deepEqual(JSON.parse(calls[1].init.body), { product_id: "prod_2" });
  for (const call of calls) {
    assert.equal(call.init.credentials, "include");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.headers["x-publishable-api-key"], "pk_test_wishlist");
    assert.equal("authorization" in call.init.headers, false);
  }
  assert.equal("body" in calls[0].init, false);
}

async function verifyStableErrorsAndResponseValidation() {
  const expiredClient = createStoreWishlistClient({
    publishableApiKey: "pk_test_wishlist",
    fetchImplementation: async () =>
      jsonResponse(
        { error: { code: "wishlist_auth_required", message: "cookie-secret" } },
        401
      ),
  });
  await assert.rejects(
    () => expiredClient.list(),
    (error) =>
      error instanceof WishlistClientError &&
      error.code === "wishlist_auth_required" &&
      error.status === 401 &&
      !error.message.includes("cookie-secret")
  );

  const missingProductClient = createStoreWishlistClient({
    publishableApiKey: "pk_test_wishlist",
    fetchImplementation: async () =>
      jsonResponse({ error: { code: "wishlist_product_not_found" } }, 404),
  });
  await assert.rejects(
    () => missingProductClient.add("prod_missing"),
    (error) =>
      error instanceof WishlistClientError &&
      error.code === "wishlist_product_not_found" &&
      error.status === 404
  );

  const invalidResponseClient = createStoreWishlistClient({
    publishableApiKey: "pk_test_wishlist",
    fetchImplementation: async () => jsonResponse({ items: [], count: 2 }),
  });
  await assert.rejects(
    () => invalidResponseClient.list(),
    (error) =>
      error instanceof WishlistClientError &&
      error.code === "wishlist_invalid_response" &&
      error.status === 502
  );

  const previousPublishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  try {
    assert.throws(
      () =>
        createStoreWishlistClient({
          fetchImplementation: async () => jsonResponse({}),
        }),
      (error) => error.code === "wishlist_publishable_key_missing"
    );
  } finally {
    if (previousPublishableKey === undefined) {
      delete process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = previousPublishableKey;
    }
  }
}

function verifyWishlistImplementationDoesNotUseBrowserStorage() {
  for (const filename of ["../lib/wishlist.ts", "../lib/wishlist-state.ts", "../components/wishlist-provider.tsx"]) {
    const source = fs.readFileSync(require("node:path").join(__dirname, filename), "utf8");
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
  }
}

function item(productId, title = "Synthetic product") {
  return {
    id: `witem_${productId}`,
    product_id: productId,
    created_at: "2026-08-08T00:00:00.000Z",
    product: {
      id: productId,
      handle: "synthetic-product",
      title,
      thumbnail: null,
      category: { handle: "catalog", name: "Catalog" },
      price: { amount: 159900, currency_code: "RUB" },
      is_available: true,
    },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

module.exports = { run };
