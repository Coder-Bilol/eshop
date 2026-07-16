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
  CART_REFERENCE_KEY,
  CartClientError,
  CartReferenceError,
  clearCartReference,
  createStoreCartClient,
  readCartReference,
  restoreReferencedCart,
  writeCartReference,
} = require("../lib/cart.ts");

async function run() {
  await verifyStoreCartRoutes();
  await verifyDefaultRegionResolution();
  await verifyStableErrorsAndValidation();
  await verifyReferenceOnlyPersistence();
  await verifyStaleReferenceRecovery();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "cart-client",
        status: "ok",
        dataSource: "installed-medusa-store-cart-contract-shaped-fixtures",
        assertions: [
          "lazy create resolves the configured Москва RUB Store region before create, retrieve, add, absolute update, and remove",
          "missing or ambiguous default region fails recoverably instead of choosing another region",
          "every Store cart request includes the publishable API key",
          "transport and HTTP failures map to stable CartClientError codes",
          "the eshop.cart.v1 envelope contains only version and opaque cart_id",
          "malformed, unsupported, empty, and payload-bearing references are cleared",
          "a stale backend reference is cleared only after cart_not_found",
          "browser storage never contains items, totals, auth tokens, or availability",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifyStoreCartRoutes() {
  const calls = [];
  const carts = [
    cart("cart_created", []),
    cart("cart_created", []),
    cart("cart_created", [line("line_1", "variant_1", 1)]),
    cart("cart_created", [line("line_1", "variant_1", 4)]),
  ];
  const fetchImplementation = async (url, init) => {
    calls.push({ url: String(url), init });
    if (new URL(url).pathname === "/store/regions") {
      return jsonResponse({
        regions: [
          { id: "reg_tver", name: "Тверь", currency_code: "rub" },
          { id: "reg_moscow", name: "Москва", currency_code: "rub" },
        ],
      });
    }
    if (init.method === "DELETE") {
      return jsonResponse({
        id: "line_1",
        object: "line-item",
        deleted: true,
        parent: cart("cart_created", []),
      });
    }
    return jsonResponse({ cart: carts.shift() });
  };
  const client = createStoreCartClient({
    baseUrl: "http://backend.test/",
    publishableApiKey: "pk_test_cart",
    salesChannelId: "sc_default",
    fetchImplementation,
  });

  assert.equal(
    (await client.createCart()).id,
    "cart_created"
  );
  assert.equal((await client.retrieveCart("cart_created")).id, "cart_created");
  assert.equal(
    (await client.addLineItem("cart_created", "variant_1", 1)).items[0]
      .quantity,
    1
  );
  assert.equal(
    (await client.updateLineItem("cart_created", "line_1", 4)).items[0]
      .quantity,
    4
  );
  assert.equal(
    (await client.removeLineItem("cart_created", "line_1")).items.length,
    0
  );

  assert.deepEqual(
    calls.map((call) => [call.init.method, new URL(call.url).pathname]),
    [
      ["GET", "/store/regions"],
      ["POST", "/store/carts"],
      ["GET", "/store/carts/cart_created"],
      ["POST", "/store/carts/cart_created/line-items"],
      ["POST", "/store/carts/cart_created/line-items/line_1"],
      ["DELETE", "/store/carts/cart_created/line-items/line_1"],
    ]
  );
  for (const call of calls) {
    assert.equal(
      call.init.headers["x-publishable-api-key"],
      "pk_test_cart"
    );
    assert.equal(call.init.cache, "no-store");
  }
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    currency_code: "rub",
    region_id: "reg_moscow",
    sales_channel_id: "sc_default",
  });
  assert.deepEqual(JSON.parse(calls[3].init.body), {
    variant_id: "variant_1",
    quantity: 1,
  });
  assert.deepEqual(JSON.parse(calls[4].init.body), { quantity: 4 });
  assert.equal(calls[4].init.body.includes("increment"), false);
}

async function verifyDefaultRegionResolution() {
  for (const regions of [
    [],
    [
      { id: "reg_moscow_1", name: "Москва", currency_code: "rub" },
      { id: "reg_moscow_2", name: "Москва", currency_code: "rub" },
    ],
  ]) {
    const client = createStoreCartClient({
      publishableApiKey: "pk_test_cart",
      salesChannelId: "sc_default",
      fetchImplementation: async () => jsonResponse({ regions }),
    });
    await assert.rejects(
      () => client.createCart(),
      (error) =>
        error instanceof CartClientError &&
        error.code === "cart_validation_failed" &&
        error.status === 400
    );
  }

  const calls = [];
  const explicitRegionClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ cart: cart("cart_explicit", []) });
    },
  });
  await explicitRegionClient.createCart({
    region_id: "reg_explicit",
    sales_channel_id: "sc_1",
  });
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ["/store/carts"]);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    region_id: "reg_explicit",
    sales_channel_id: "sc_1",
  });

  const missingChannelClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () =>
      jsonResponse({
        regions: [{ id: "reg_moscow", name: "Москва", currency_code: "rub" }],
      }),
  });
  await assert.rejects(
    () => missingChannelClient.createCart(),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_validation_failed" &&
      error.status === 400
  );
}

async function verifyStableErrorsAndValidation() {
  const statusClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () =>
      jsonResponse({ message: "native Medusa error" }, 409),
  });
  await assert.rejects(
    () => statusClient.retrieveCart("cart_conflict"),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_conflict" &&
      error.status === 409
  );

  const networkClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () => {
      throw new Error("socket details must not escape");
    },
  });
  await assert.rejects(
    () => networkClient.retrieveCart("cart_network"),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_network_error" &&
      !error.message.includes("socket details")
  );

  const invalidResponseClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () => jsonResponse({ cart: null }),
  });
  await assert.rejects(
    () => invalidResponseClient.retrieveCart("cart_invalid"),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_invalid_response"
  );

  let called = false;
  const validationClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () => {
      called = true;
      return jsonResponse({ cart: cart("unexpected", []) });
    },
  });
  assert.throws(
    () => validationClient.updateLineItem("cart_1", "line_1", 0),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_invalid_request"
  );
  assert.throws(
    () => validationClient.addLineItem("cart_1", "variant_1", 1.5),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_invalid_request"
  );
  assert.equal(called, false);
}

async function verifyReferenceOnlyPersistence() {
  const storage = new MemoryStorage();
  const written = writeCartReference(" cart_opaque ", storage);
  assert.deepEqual(written, { version: 1, cart_id: "cart_opaque" });
  assert.deepEqual(readCartReference(storage), {
    version: 1,
    cart_id: "cart_opaque",
  });

  const raw = storage.getItem(CART_REFERENCE_KEY);
  assert.equal(
    raw,
    JSON.stringify({ version: 1, cart_id: "cart_opaque" })
  );
  for (const forbidden of [
    "items",
    "quantity",
    "total",
    "price",
    "customer_id",
    "token",
    "authorization",
    "availability",
  ]) {
    assert.equal(raw.toLowerCase().includes(forbidden), false);
  }

  for (const invalid of [
    "{not-json",
    JSON.stringify({ version: 2, cart_id: "cart_opaque" }),
    JSON.stringify({ version: 1, cart_id: "" }),
    JSON.stringify({ version: 1, cart_id: " cart_opaque " }),
    JSON.stringify({
      version: 1,
      cart_id: "cart_opaque",
      items: [{ quantity: 1 }],
    }),
    JSON.stringify({
      version: 1,
      cart_id: "cart_opaque",
      auth_token: "forbidden",
    }),
  ]) {
    storage.setItem(CART_REFERENCE_KEY, invalid);
    assert.equal(readCartReference(storage), null);
    assert.equal(storage.getItem(CART_REFERENCE_KEY), null);
  }

  assert.throws(
    () => writeCartReference("   ", storage),
    (error) =>
      error instanceof CartReferenceError &&
      error.code === "cart_reference_invalid"
  );

  writeCartReference("cart_clear", storage);
  clearCartReference(storage);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), null);
}

async function verifyStaleReferenceRecovery() {
  const storage = new MemoryStorage();
  writeCartReference("cart_stale", storage);
  const staleClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () =>
      jsonResponse({ message: "not found" }, 404),
  });

  assert.equal(await restoreReferencedCart(staleClient, storage), null);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), null);

  writeCartReference("cart_retry", storage);
  const unavailableClient = createStoreCartClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () =>
      jsonResponse({ message: "unavailable" }, 503),
  });
  await assert.rejects(
    () => restoreReferencedCart(unavailableClient, storage),
    (error) =>
      error instanceof CartClientError &&
      error.code === "cart_backend_unavailable"
  );
  assert.deepEqual(readCartReference(storage), {
    version: 1,
    cart_id: "cart_retry",
  });
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function cart(id, items) {
  return {
    id,
    customer_id: null,
    currency_code: "rub",
    region_id: "reg_1",
    sales_channel_id: "sc_1",
    items,
    total: 0,
  };
}

function line(id, variantId, quantity) {
  return {
    id,
    variant_id: variantId,
    quantity,
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

module.exports = { run };
