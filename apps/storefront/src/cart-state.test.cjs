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

const { CartClientError, CART_REFERENCE_KEY } = require("../lib/cart.ts");
const { createGuestCartStateController } = require("../lib/cart-state.ts");

async function run() {
  await verifyLazyCreateAddAndReferenceOnlyPersistence();
  await verifyRestoreMalformedAndStaleRecovery();
  await verifyMutationAdoptsBackendResponses();
  await verifyDeterministicFailureStates();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "cart-state",
        status: "ok",
        dataSource: "store-cart-client-shaped-fixtures",
        assertions: [
          "first valid add lazily creates a cart and persists only the opaque cart ID",
          "add, retrieve, absolute update, and remove adopt backend cart responses",
          "reload restores from eshop.cart.v1 without cached cart payloads",
          "malformed and not-found references are cleared without reconstructing contents",
          "loading, empty, validation, stock conflict, and backend failure states are deterministic",
          "backend failures keep the opaque reference available for retry",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifyLazyCreateAddAndReferenceOnlyPersistence() {
  const storage = new MemoryStorage();
  const calls = [];
  const client = {
    async createCart(input) {
      calls.push(["create", input]);
      return cart("cart_created", []);
    },
    async retrieveCart() {
      throw new Error("retrieve should not be called without a reference");
    },
    async addLineItem(cartId, variantId, quantity) {
      calls.push(["add", cartId, variantId, quantity]);
      return cart(cartId, [line("line_1", variantId, quantity)]);
    },
    async updateLineItem() {
      throw new Error("update should not be called");
    },
    async removeLineItem() {
      throw new Error("remove should not be called");
    },
  };
  const controller = createGuestCartStateController({
    client,
    storage,
    createCartInput: { region_id: "reg_1", sales_channel_id: "sc_1" },
  });

  const state = await controller.addItem({ variantId: " variant_1 ", quantity: 2 });

  assert.equal(state.status, "ready");
  assert.equal(state.cart.id, "cart_created");
  assert.deepEqual(state.cart.items, [line("line_1", "variant_1", 2)]);
  assert.deepEqual(calls, [
    ["create", { region_id: "reg_1", sales_channel_id: "sc_1" }],
    ["add", "cart_created", "variant_1", 2],
  ]);

  const raw = storage.getItem(CART_REFERENCE_KEY);
  assert.equal(raw, JSON.stringify({ version: 1, cart_id: "cart_created" }));
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
}

async function verifyRestoreMalformedAndStaleRecovery() {
  const storage = new MemoryStorage();
  const retrieved = cart("cart_restore", [line("line_restore", "variant_r", 1)]);
  const calls = [];
  const client = {
    async createCart() {
      throw new Error("restore should not create a cart");
    },
    async retrieveCart(cartId) {
      calls.push(["retrieve", cartId]);
      if (cartId === "cart_stale") {
        throw new CartClientError("cart_not_found", "The cart was not found.", 404);
      }
      return retrieved;
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
  };

  storage.setItem(CART_REFERENCE_KEY, JSON.stringify({ version: 1, cart_id: "cart_restore" }));
  let controller = createGuestCartStateController({ client, storage });
  let state = await controller.restore();
  assert.equal(state.status, "ready");
  assert.equal(state.cart, retrieved);
  assert.deepEqual(calls, [["retrieve", "cart_restore"]]);

  storage.setItem(
    CART_REFERENCE_KEY,
    JSON.stringify({ version: 1, cart_id: "cart_payload", items: [line("x", "v", 1)] })
  );
  controller = createGuestCartStateController({ client, storage });
  state = await controller.restore();
  assert.equal(state.status, "empty");
  assert.equal(state.cart, null);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), null);
  assert.deepEqual(calls, [["retrieve", "cart_restore"]]);

  storage.setItem(CART_REFERENCE_KEY, JSON.stringify({ version: 1, cart_id: "cart_stale" }));
  controller = createGuestCartStateController({ client, storage });
  state = await controller.restore();
  assert.equal(state.status, "empty");
  assert.equal(state.cart, null);
  assert.equal(state.error, null);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), null);
  assert.deepEqual(calls, [
    ["retrieve", "cart_restore"],
    ["retrieve", "cart_stale"],
  ]);
}

async function verifyMutationAdoptsBackendResponses() {
  const storage = new MemoryStorage();
  storage.setItem(CART_REFERENCE_KEY, JSON.stringify({ version: 1, cart_id: "cart_active" }));
  const calls = [];
  const client = {
    async createCart() {
      throw new Error("line mutation should not create a cart");
    },
    async retrieveCart(cartId) {
      calls.push(["retrieve", cartId]);
      return cart(cartId, [line("line_1", "variant_1", 1)]);
    },
    async addLineItem(cartId, variantId, quantity) {
      calls.push(["add", cartId, variantId, quantity]);
      return cart(cartId, [
        line("line_1", "variant_1", 1),
        line("line_2", variantId, quantity),
      ]);
    },
    async updateLineItem(cartId, lineItemId, quantity) {
      calls.push(["update", cartId, lineItemId, quantity]);
      return cart(cartId, [line(lineItemId, "variant_1", quantity)]);
    },
    async removeLineItem(cartId, lineItemId) {
      calls.push(["remove", cartId, lineItemId]);
      return cart(cartId, []);
    },
  };
  const controller = createGuestCartStateController({ client, storage });

  let state = await controller.restore();
  assert.equal(state.status, "ready");
  assert.equal(state.cart.items[0].quantity, 1);

  state = await controller.addItem({ variantId: "variant_2", quantity: 3 });
  assert.equal(state.status, "ready");
  assert.deepEqual(state.cart.items.map((item) => item.quantity), [1, 3]);

  state = await controller.updateItem({ lineItemId: "line_1", quantity: 5 });
  assert.equal(state.status, "ready");
  assert.deepEqual(state.cart.items, [line("line_1", "variant_1", 5)]);

  state = await controller.removeItem({ lineItemId: "line_1" });
  assert.equal(state.status, "empty");
  assert.deepEqual(state.cart.items, []);
  assert.deepEqual(calls, [
    ["retrieve", "cart_active"],
    ["add", "cart_active", "variant_2", 3],
    ["update", "cart_active", "line_1", 5],
    ["remove", "cart_active", "line_1"],
  ]);
}

async function verifyDeterministicFailureStates() {
  await verifyLoadingAndValidationState();
  await verifyStockConflictState();
  await verifyBackendFailureRetainsReference();
  await verifyMutationNotFoundClearsReference();
}

async function verifyLoadingAndValidationState() {
  const storage = new MemoryStorage();
  const deferredCreate = deferred();
  const client = {
    async createCart() {
      return deferredCreate.promise;
    },
    async retrieveCart() {
      throw new Error("retrieve should not be called");
    },
    async addLineItem(cartId, variantId, quantity) {
      return cart(cartId, [line("line_1", variantId, quantity)]);
    },
    async updateLineItem() {
      throw new Error("update should not be called");
    },
    async removeLineItem() {
      throw new Error("remove should not be called");
    },
  };
  const controller = createGuestCartStateController({ client, storage });
  const pending = controller.addItem({ variantId: "variant_1", quantity: 1 });
  assert.equal(controller.getState().status, "loading");
  assert.equal(controller.getState().operation, "add");
  deferredCreate.resolve(cart("cart_created", []));
  await pending;

  const invalid = await controller.addItem({ variantId: "variant_1", quantity: 0 });
  assert.equal(invalid.status, "validation_error");
  assert.equal(invalid.error.code, "cart_invalid_request");
  assert.equal(invalid.error.recoverable, true);
}

async function verifyStockConflictState() {
  const storage = new MemoryStorage();
  const client = {
    async createCart() {
      return cart("cart_conflict", []);
    },
    async retrieveCart() {
      throw new Error("retrieve should not be called");
    },
    async addLineItem() {
      throw new CartClientError(
        "cart_conflict",
        "The cart conflicts with its current state.",
        409
      );
    },
    async updateLineItem() {
      throw new Error("update should not be called");
    },
    async removeLineItem() {
      throw new Error("remove should not be called");
    },
  };
  const controller = createGuestCartStateController({ client, storage });
  const state = await controller.addItem({ variantId: "variant_sold_out", quantity: 1 });
  assert.equal(state.status, "stock_conflict");
  assert.equal(state.cart.id, "cart_conflict");
  assert.equal(state.error.code, "cart_conflict");
  assert.equal(storage.getItem(CART_REFERENCE_KEY), JSON.stringify({ version: 1, cart_id: "cart_conflict" }));
}

async function verifyBackendFailureRetainsReference() {
  const storage = new MemoryStorage();
  storage.setItem(CART_REFERENCE_KEY, JSON.stringify({ version: 1, cart_id: "cart_retry" }));
  const client = {
    async createCart() {
      throw new Error("create should not be called");
    },
    async retrieveCart() {
      throw new CartClientError(
        "cart_backend_unavailable",
        "The cart service is temporarily unavailable.",
        503
      );
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
  };
  const controller = createGuestCartStateController({ client, storage });
  const state = await controller.restore();
  assert.equal(state.status, "backend_error");
  assert.equal(state.error.code, "cart_backend_unavailable");
  assert.equal(storage.getItem(CART_REFERENCE_KEY), JSON.stringify({ version: 1, cart_id: "cart_retry" }));
}

async function verifyMutationNotFoundClearsReference() {
  const storage = new MemoryStorage();
  storage.setItem(CART_REFERENCE_KEY, JSON.stringify({ version: 1, cart_id: "cart_stale" }));
  const client = {
    async createCart() {
      throw new Error("create should not be called");
    },
    async retrieveCart(cartId) {
      throw new CartClientError("cart_not_found", `Missing ${cartId}`, 404);
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
  };
  const controller = createGuestCartStateController({ client, storage });
  const state = await controller.updateItem({ lineItemId: "line_stale", quantity: 2 });
  assert.equal(state.status, "empty");
  assert.equal(state.error.code, "cart_not_found");
  assert.equal(state.cart, null);
  assert.equal(storage.getItem(CART_REFERENCE_KEY), null);
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
    total: items.length,
  };
}

function line(id, variantId, quantity) {
  return {
    id,
    variant_id: variantId,
    quantity,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

module.exports = { run };

