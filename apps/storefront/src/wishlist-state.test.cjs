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

const { WishlistClientError } = require("../lib/wishlist.ts");
const { createWishlistStateController } = require("../lib/wishlist-state.ts");

async function run() {
  await verifyCurrentCustomerLoadAndMergeIndependence();
  await verifyPerProductPendingAndErrorIsolation();
  await verifyBackendTruthAndGuestNoMutation();
  await verifySessionExpiryLogoutAndStaleResponseClearing();
  verifyProviderBoundaryAndStorageRules();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-state",
        status: "ok",
        assertions: [
          "successful current-customer capability loads backend state without a cart merge dependency",
          "each product has independent pending and error state and duplicate mutation is suppressed",
          "add adopts the backend item and remove adopts removed=false absence truth",
          "guest add/remove makes no mutation call",
          "wishlist 401, clear/logout, and stale in-flight responses retain no customer or wishlist data",
          "provider has no wishlist browser storage boundary",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifyCurrentCustomerLoadAndMergeIndependence() {
  const calls = [];
  const controller = createWishlistStateController({
    client: {
      async list() {
        calls.push("list");
        return [item("prod_saved")];
      },
      async add() {
        throw new Error("mutation should not run");
      },
      async remove() {
        throw new Error("mutation should not run");
      },
    },
  });

  const state = await controller.load("cus_session");
  assert.equal(state.status, "ready");
  assert.equal(state.customerId, "cus_session");
  assert.deepEqual(state.items, [item("prod_saved")]);
  assert.deepEqual(calls, ["list"]);
}

async function verifyPerProductPendingAndErrorIsolation() {
  const deferredAdds = new Map([
    ["prod_a", deferred()],
    ["prod_b", deferred()],
  ]);
  const addCalls = [];
  const controller = createWishlistStateController({
    client: {
      async list() {
        return [];
      },
      async add(productId) {
        addCalls.push(productId);
        return deferredAdds.get(productId).promise;
      },
      async remove() {
        throw new Error("remove should not run");
      },
    },
  });
  await controller.load("cus_pending");

  const addA = controller.add("prod_a");
  const addB = controller.add("prod_b");
  assert.deepEqual(controller.getState().pendingProductIds.sort(), ["prod_a", "prod_b"]);

  const duplicate = await controller.add("prod_a");
  assert.deepEqual(duplicate.pendingProductIds.sort(), ["prod_a", "prod_b"]);
  assert.deepEqual(addCalls, ["prod_a", "prod_b"]);

  deferredAdds
    .get("prod_a")
    .resolve({ item: item("prod_a", "Authoritative A"), created: true });
  const afterA = await addA;
  assert.deepEqual(afterA.pendingProductIds, ["prod_b"]);
  assert.equal(afterA.items[0].product.title, "Authoritative A");
  assert.equal(afterA.errors.prod_a, undefined);

  deferredAdds
    .get("prod_b")
    .reject(new WishlistClientError("wishlist_operation_failed", "Retry later.", 503));
  const afterB = await addB;
  assert.deepEqual(afterB.pendingProductIds, []);
  assert.equal(afterB.errors.prod_b.code, "wishlist_operation_failed");
  assert.equal(afterB.errors.prod_a, undefined);
}

async function verifyBackendTruthAndGuestNoMutation() {
  let mutationCalls = 0;
  const guestController = createWishlistStateController({
    client: {
      async list() {
        throw new Error("guest list should not run");
      },
      async add() {
        mutationCalls += 1;
        throw new Error("guest add should not run");
      },
      async remove() {
        mutationCalls += 1;
        throw new Error("guest remove should not run");
      },
    },
  });
  assert.equal((await guestController.add("prod_guest")).status, "guest");
  assert.equal((await guestController.remove("prod_guest")).status, "guest");
  assert.equal(mutationCalls, 0);

  let removeResult = { product_id: "prod_saved", removed: false };
  const controller = createWishlistStateController({
    client: {
      async list() {
        return [item("prod_saved", "Old response")];
      },
      async add() {
        return { item: item("prod_saved", "New backend response"), created: false };
      },
      async remove() {
        return removeResult;
      },
    },
  });
  await controller.load("cus_truth");
  const added = await controller.add("prod_saved");
  assert.equal(added.items[0].product.title, "New backend response");
  const removed = await controller.remove("prod_saved");
  assert.equal(removed.items.length, 0);
  assert.equal(removed.status, "ready");
}

async function verifySessionExpiryLogoutAndStaleResponseClearing() {
  let expired = false;
  const controller = createWishlistStateController({
    client: {
      async list() {
        if (expired) {
          throw new WishlistClientError(
            "wishlist_auth_required",
            "Customer authentication is required.",
            401
          );
        }
        return [item("prod_expiry")];
      },
      async add() {
        throw new Error("not needed");
      },
      async remove() {
        throw new Error("not needed");
      },
    },
  });
  await controller.load("cus_expiry");
  expired = true;
  const expiredState = await controller.load("cus_expiry");
  assert.deepEqual(expiredState, guestState());

  const pendingList = deferred();
  const staleController = createWishlistStateController({
    client: {
      async list() {
        return pendingList.promise;
      },
      async add() {
        throw new Error("not needed");
      },
      async remove() {
        throw new Error("not needed");
      },
    },
  });
  const load = staleController.load("cus_stale");
  assert.equal(staleController.getState().status, "loading");
  assert.deepEqual(staleController.clear(), guestState());
  pendingList.resolve([item("prod_stale")]);
  await load;
  assert.deepEqual(staleController.getState(), guestState());

  const logoutController = createWishlistStateController({
    client: {
      async list() {
        return [item("prod_logout")];
      },
      async add() {
        throw new Error("not needed");
      },
      async remove() {
        throw new Error("not needed");
      },
    },
  });
  await logoutController.load("cus_logout");
  assert.deepEqual(logoutController.clear(), guestState());
}

function verifyProviderBoundaryAndStorageRules() {
  const provider = fs.readFileSync(
    path.join(__dirname, "../components/wishlist-provider.tsx"),
    "utf8"
  );
  assert.match(provider, /session_established/);
  assert.doesNotMatch(provider, /mergeAfterAuthentication|useCart|merge_blocked/);
  assert.doesNotMatch(provider, /localStorage|sessionStorage/);
  for (const filename of ["../lib/wishlist.ts", "../lib/wishlist-state.ts"]) {
    const source = fs.readFileSync(path.join(__dirname, filename), "utf8");
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

function guestState() {
  return {
    status: "guest",
    customerId: null,
    items: [],
    pendingProductIds: [],
    errors: {},
    error: null,
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
