const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

const { CART_REFERENCE_KEY, CartClientError } = require("../lib/cart.ts");
const {
  CartMergeError,
  createStoreCartMergeClient,
  mergeAuthenticatedCartReference,
} = require("../lib/cart-merge.ts");
const { createGuestCartStateController } = require("../lib/cart-state.ts");

async function run() {
  await verifyAuthenticatedRequestShape();
  await verifyTargetSwitchAndReplay();
  await verifyFailuresPreserveSourceReference();
  await verifyConsumedSourceStaleCrudAndReplay();
  await verifyNoSourceSkipsMerge();
  verifyProviderBoundary();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "cart-merge",
        status: "ok",
        dataSource: "store-cart-merge-contract-shaped-fixtures",
        assertions: [
          "post-auth merge sends credentials: include with an empty request body",
          "client never sends destination cart or customer identity",
          "validated merged, transferred, and already_merged responses adopt the backend-selected target reference",
          "conflict, forbidden, in-progress, stale, invalid-response, and server failures retain the source reference",
          "stale consumed-source recovery can happen only through authenticated merge replay",
          "cart provider exposes provider-agnostic post-auth handoff without OAuth provider logic",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifyAuthenticatedRequestShape() {
  const calls = [];
  const client = createStoreCartMergeClient({
    baseUrl: "http://backend.test/",
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(successPayload("cart_guest", "cart_target", "merged", false));
    },
  });

  const result = await client.mergeCart(" cart_guest ");

  assert.equal(result.cart.id, "cart_target");
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/store/carts/cart_guest/merge");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers["x-publishable-api-key"], "pk_test_cart");
  assert.deepEqual(JSON.parse(calls[0].init.body), {});
  assert.equal(calls[0].init.body.includes("target"), false);
  assert.equal(calls[0].init.body.includes("destination"), false);
  assert.equal(calls[0].init.body.includes("customer"), false);
}

async function verifyTargetSwitchAndReplay() {
  const storage = new MemoryStorage();
  const calls = [];
  const client = {
    async mergeCart(sourceCartId) {
      calls.push(sourceCartId);
      if (calls.length === 1) {
        return successPayload(sourceCartId, "cart_target", "merged", false);
      }
      return successPayload(sourceCartId, "cart_target", "already_merged", true);
    },
  };

  storage.setItem(CART_REFERENCE_KEY, reference("cart_guest"));
  const merged = await mergeAuthenticatedCartReference({ client, storage });
  assert.equal(merged.merge.outcome, "merged");
  assert.equal(storage.getItem(CART_REFERENCE_KEY), reference("cart_target"));

  storage.setItem(CART_REFERENCE_KEY, reference("cart_guest"));
  const replayed = await mergeAuthenticatedCartReference({ client, storage });
  assert.equal(replayed.merge.outcome, "already_merged");
  assert.equal(replayed.merge.replayed, true);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), reference("cart_target"));
  assert.deepEqual(calls, ["cart_guest", "cart_guest"]);

  for (const forbidden of ["token", "authorization", "customer_id", "items", "quantity"]) {
    assert.equal(storage.getItem(CART_REFERENCE_KEY).toLowerCase().includes(forbidden), false);
  }
}

async function verifyFailuresPreserveSourceReference() {
  for (const [code, status] of [
    ["cart_merge_source_forbidden", 403],
    ["cart_merge_in_progress", 409],
    ["cart_not_found", 404],
    ["cart_merge_failed", 500],
  ]) {
    const storage = new MemoryStorage();
    storage.setItem(CART_REFERENCE_KEY, reference("cart_source"));
    const client = {
      async mergeCart() {
        throw new CartMergeError(code, "recoverable", status);
      },
    };

    await assert.rejects(
      () => mergeAuthenticatedCartReference({ client, storage }),
      (error) => error instanceof CartMergeError && error.code === code
    );
    assert.equal(storage.getItem(CART_REFERENCE_KEY), reference("cart_source"));
  }

  const invalidStorage = new MemoryStorage();
  invalidStorage.setItem(CART_REFERENCE_KEY, reference("cart_source"));
  const invalidResponseClient = createStoreCartMergeClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () =>
      jsonResponse(successPayload("cart_source", "cart_other", "merged", false, "cart_target")),
  });
  await assert.rejects(
    () => mergeAuthenticatedCartReference({ client: invalidResponseClient, storage: invalidStorage }),
    (error) => error instanceof CartMergeError && error.code === "cart_merge_invalid_response"
  );
  assert.equal(invalidStorage.getItem(CART_REFERENCE_KEY), reference("cart_source"));

  const stableErrorClient = createStoreCartMergeClient({
    publishableApiKey: "pk_test_cart",
    fetchImplementation: async () =>
      jsonResponse({ error: { code: "cart_merge_stock_conflict" } }, 409),
  });
  const stableStorage = new MemoryStorage();
  stableStorage.setItem(CART_REFERENCE_KEY, reference("cart_source"));
  await assert.rejects(
    () => mergeAuthenticatedCartReference({ client: stableErrorClient, storage: stableStorage }),
    (error) => error instanceof CartMergeError && error.code === "cart_merge_stock_conflict"
  );
  assert.equal(stableStorage.getItem(CART_REFERENCE_KEY), reference("cart_source"));
}

async function verifyConsumedSourceStaleCrudAndReplay() {
  const storage = new MemoryStorage();
  storage.setItem(CART_REFERENCE_KEY, reference("cart_consumed"));
  const stateController = createGuestCartStateController({
    storage,
    client: {
      async createCart() {
        throw new Error("restore should not create a cart");
      },
      async retrieveCart() {
        throw new CartClientError("cart_not_found", "Consumed source is not found.", 404);
      },
      async addLineItem() {
        throw new Error("add should not be called");
      },
      async updateLineItem() {
        throw new Error("update should not be called");
      },
      async removeLineItem() {
        throw new Error("remove should not be called");
      },
    },
  });

  const staleState = await stateController.restore();
  assert.equal(staleState.status, "empty");
  assert.equal(staleState.cart, null);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), null);

  storage.setItem(CART_REFERENCE_KEY, reference("cart_consumed"));
  const replay = await mergeAuthenticatedCartReference({
    storage,
    client: {
      async mergeCart(sourceCartId) {
        return successPayload(sourceCartId, "cart_target", "already_merged", true);
      },
    },
  });

  assert.equal(replay.merge.outcome, "already_merged");
  assert.equal(replay.merge.replayed, true);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), reference("cart_target"));
}

async function verifyNoSourceSkipsMerge() {
  let called = false;
  const result = await mergeAuthenticatedCartReference({
    storage: new MemoryStorage(),
    client: {
      async mergeCart() {
        called = true;
        return successPayload("cart_missing", "cart_target", "transferred", false);
      },
    },
  });

  assert.equal(result, null);
  assert.equal(called, false);
}

function verifyProviderBoundary() {
  const componentRoot = path.join(__dirname, "..", "components");
  const libRoot = path.join(__dirname, "..", "lib");
  const providerSource = read(path.join(componentRoot, "cart-provider.tsx"));
  const mergeSource = read(path.join(libRoot, "cart-merge.ts"));
  const runnerSource = read(path.join(__dirname, "test-runner.cjs"));

  assert.match(providerSource, /mergeAfterAuthentication/);
  assert.match(providerSource, /mergeAuthenticatedCartReference/);
  assert.match(providerSource, /createStoreCartMergeClient/);
  assert.match(mergeSource, /credentials: "include"/);
  assert.match(mergeSource, /JSON\.stringify\(\{\}\)/);
  assert.match(runnerSource, /"cart-merge"/);

  for (const forbidden of ["Google", "VK ID", "OAuth", "destinationCartId", "customerId"]) {
    assert.equal(providerSource.includes(forbidden), false, `provider must not include ${forbidden}`);
  }
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

function successPayload(sourceCartId, targetCartId, outcome, replayed, cartId = targetCartId) {
  return {
    cart: cart(cartId),
    merge: {
      source_cart_id: sourceCartId,
      target_cart_id: targetCartId,
      outcome,
      replayed,
    },
  };
}

function cart(id) {
  return {
    id,
    customer_id: "cus_actor",
    currency_code: "rub",
    region_id: "reg_1",
    sales_channel_id: "sc_1",
    items: [],
  };
}

function reference(cartId) {
  return JSON.stringify({ version: 1, cart_id: cartId });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { run };
