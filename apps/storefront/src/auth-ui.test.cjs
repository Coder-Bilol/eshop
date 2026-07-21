const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

const {
  consumeAuthenticatedReturnPath,
  createAuthCompletionController,
  readCompletionSignal,
  resolveCartReadiness,
  viewForMergeFailure,
} = require("../components/auth-completion.tsx");
const {
  createExclusiveAction,
  safeAuthFailureMessage,
} = require("../components/auth-login.tsx");
const { CART_REFERENCE_KEY } = require("../lib/cart.ts");
const { CartMergeError } = require("../lib/cart-merge.ts");
const { mergeAuthenticatedCartReference } = require("../lib/cart-merge.ts");
const { createGuestCartStateController } = require("../lib/cart-state.ts");

async function run() {
  verifySanitizedCompletionSignals();
  await verifyTruthfulCartReadiness();
  await verifyCompletionControllerConcurrency();
  await verifyExclusiveLoginAction();
  verifyReturnPathReadinessGate();
  verifyUiProviderBoundariesAndPrivacy();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "auth-ui",
        status: "ok",
        assertions: [
          "Google and VK ID login expose pending, safe failure, and retry UI",
          "completion strips its URL before rendering bounded cancel/failure states",
          "session-established completion invokes the existing CartProvider merge handoff",
          "only documented merge and no-source handoffs reach readiness",
          "recoverable merge failure remains blocked and retryable without raw detail",
          "auth loss, retry supersession, and unmount invalidate stale merge results",
          "login and merge actions are one-flight under duplicate input",
          "the safe return path requires authenticated_ready and a current session",
          "provider callback values, tokens, raw errors, and customer PII are not rendered",
        ],
      },
      null,
      2
    )}\n`
  );
}

function verifySanitizedCompletionSignals() {
  assert.deepEqual(
    readCompletionSignal("?provider=google&status=success"),
    { kind: "success" }
  );
  assert.deepEqual(
    readCompletionSignal("?status=success&provider=vkid"),
    { kind: "success" }
  );
  assert.deepEqual(
    readCompletionSignal("?provider=vkid&status=auth_callback_invalid"),
    { kind: "cancelled" }
  );

  for (const hostile of [
    "?provider=google&status=success&code=secret",
    "?provider=google&status=success&state=secret",
    "?provider=google&status=success&access_token=secret",
    "?provider=google&status=raw-provider-error",
    "?provider=google&provider=vkid&status=success",
    "?provider=unknown&status=success",
    "",
  ]) {
    const signal = readCompletionSignal(hostile);
    assert.equal(signal.kind, "failure", hostile);
    assert.equal(JSON.stringify(signal).includes("secret"), false);
    assert.equal(JSON.stringify(signal).includes("raw-provider-error"), false);
  }
  assert.equal(readCompletionSignal("?provider=google&status=success", "#code").kind, "failure");
  assert.equal(safeAuthFailureMessage("auth_rate_limited").includes("attempts"), true);
  assert.equal(safeAuthFailureMessage("auth_invalid_request").includes("invalid"), false);
}

async function verifyTruthfulCartReadiness() {
  let mergeCalls = 0;
  assert.equal(
    await resolveCartReadiness(async () => {
      mergeCalls += 1;
      return cartProviderNoSourceHandoff();
    }),
    "no_source"
  );
  assert.equal(
    await resolveCartReadiness(async () => {
      mergeCalls += 1;
      return cartProviderMergedHandoff();
    }),
    "merged"
  );
  assert.equal(
    await resolveCartReadiness(async () => {
      mergeCalls += 1;
      return cartProviderMergedHandoff({
        target_cart_id: "cart_source",
        outcome: "transferred",
      });
    }),
    "merged"
  );
  assert.equal(
    await resolveCartReadiness(async () => {
      mergeCalls += 1;
      return cartProviderMergedHandoff({ outcome: "already_merged", replayed: true });
    }),
    "merged"
  );

  for (const handoff of [
    {
      result: mergedResult(),
      state: cartState("backend_error", cart("cart_target"), safeCartError()),
    },
    {
      result: mergedResult(),
      state: cartState("empty", cart("cart_target")),
    },
    {
      result: { cart: {}, merge: { outcome: "unknown" } },
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: null,
      state: cartState("unknown", null),
    },
    {
      result: mergedResult(),
      state: cartState("ready", cart("cart_target"), safeCartError()),
    },
    {
      result: mergedResult(),
      state: cartState("ready", cart("cart_target"), null, "restore"),
    },
    {
      result: mergedResult({ source_cart_id: undefined }),
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: mergedResult({ replayed: undefined }),
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: mergedResult({ outcome: "transferred" }),
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: mergedResult({ source_cart_id: "cart_target" }),
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: mergedResult({ outcome: "already_merged", replayed: false }),
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: mergedResult({ replayed: true }),
      state: cartState("ready", cart("cart_target")),
    },
    {
      result: null,
      state: cartState("idle", null, null, "restore"),
    },
  ]) {
    await assert.rejects(
      () => resolveCartReadiness(async () => handoff),
      /could not be confirmed/
    );

    const blockedViews = [];
    const blockedController = createAuthCompletionController((view) =>
      blockedViews.push(view)
    );
    blockedController.mount();
    assert.equal(await blockedController.startMerge(async () => handoff), true);
    assert.equal(blockedViews.at(-1).status, "merge_blocked");
    assert.equal(
      blockedViews.some((view) => view.status === "authenticated_ready"),
      false
    );
    blockedController.unmount();
  }
  const recoverable = new Error("raw backend detail");
  await assert.rejects(
    () =>
      resolveCartReadiness(async () => {
        mergeCalls += 1;
        throw recoverable;
      }),
    recoverable
  );
  assert.equal(mergeCalls, 5);
  assert.equal(viewForMergeFailure(recoverable).status, "merge_blocked");
  assert.equal(viewForMergeFailure(recoverable).message.includes(recoverable.message), false);
  assert.equal(
    viewForMergeFailure(
      new CartMergeError("cart_merge_auth_required", "raw auth detail", 401)
    ).status,
    "auth_failed"
  );
}

async function verifyCompletionControllerConcurrency() {
  const views = [];
  const controller = createAuthCompletionController((view) => views.push(view));
  controller.mount();

  const authLossMerge = deferred();
  let mergeCalls = 0;
  const first = controller.startMerge(async () => {
    mergeCalls += 1;
    return authLossMerge.promise;
  });
  const duplicate = controller.startMerge(async () => {
    mergeCalls += 1;
    return cartProviderMergedHandoff();
  });
  assert.equal(await duplicate, false);
  assert.equal(mergeCalls, 1);
  controller.authenticationLost();
  authLossMerge.resolve(await cartProviderMergedHandoff());
  assert.equal(await first, false);
  assert.equal(views.at(-1).status, "auth_failed");
  assert.equal(views.some((view) => view.status === "authenticated_ready"), false);

  assert.equal(controller.resetForRetry(), true);
  const staleRetry = deferred();
  const stale = controller.startMerge(() => staleRetry.promise);
  controller.authenticationLost();
  assert.equal(controller.resetForRetry(), true);
  const current = controller.startMerge(() => cartProviderMergedHandoff());
  staleRetry.resolve(await cartProviderMergedHandoff());
  assert.equal(await stale, false);
  assert.equal(await current, true);
  assert.equal(views.at(-1).status, "authenticated_ready");

  assert.equal(controller.resetForRetry(), true);
  const staleUnmount = deferred();
  const beforeUnmount = controller.startMerge(() => staleUnmount.promise);
  controller.unmount();
  staleUnmount.resolve(await cartProviderMergedHandoff());
  assert.equal(await beforeUnmount, false);
  const viewCountAfterUnmount = views.length;

  controller.mount();
  const afterRemount = controller.startMerge(() => cartProviderNoSourceHandoff());
  assert.equal(await afterRemount, true);
  assert.equal(views.length, viewCountAfterUnmount + 2);
  assert.equal(views.at(-1).outcome, "no_source");
  controller.unmount();
}

async function verifyExclusiveLoginAction() {
  const guard = createExclusiveAction();
  const pending = deferred();
  let calls = 0;
  const first = guard.run(async () => {
    calls += 1;
    await pending.promise;
  });
  const duplicate = guard.run(async () => {
    calls += 1;
  });

  assert.equal(await duplicate, false);
  assert.equal(calls, 1);
  pending.resolve();
  assert.equal(await first, true);
  assert.equal(await guard.run(async () => { calls += 1; }), true);
  assert.equal(calls, 2);
}

function verifyReturnPathReadinessGate() {
  let consumeCalls = 0;
  const consume = () => {
    consumeCalls += 1;
    return "/checkout";
  };
  for (const status of [
    "processing",
    "cart_merge_pending",
    "merge_blocked",
    "auth_cancelled",
    "auth_failed",
  ]) {
    assert.equal(consumeAuthenticatedReturnPath(status, true, consume), null);
  }
  assert.equal(consumeCalls, 0);
  assert.equal(
    consumeAuthenticatedReturnPath("authenticated_ready", false, consume),
    null
  );
  assert.equal(consumeCalls, 0);
  assert.equal(
    consumeAuthenticatedReturnPath("authenticated_ready", true, consume),
    "/checkout"
  );
  assert.equal(consumeCalls, 1);
}

function verifyUiProviderBoundariesAndPrivacy() {
  const appRoot = path.join(__dirname, "..", "app");
  const componentRoot = path.join(__dirname, "..", "components");
  const loginPage = read(path.join(appRoot, "login", "page.tsx"));
  const completionPage = read(path.join(appRoot, "auth", "complete", "page.tsx"));
  const login = read(path.join(componentRoot, "auth-login.tsx"));
  const completion = read(path.join(componentRoot, "auth-completion.tsx"));
  const runner = read(path.join(__dirname, "test-runner.cjs"));

  assert.match(loginPage, /normalizeReturnPath/);
  assert.match(loginPage, /<AuthLogin returnPath=\{returnPath\}/);
  assert.match(completionPage, /<AuthCompletion \/>/);
  assert.match(login, /startLogin\(provider, returnPath\)/);
  assert.match(login, /window\.location\.assign\(location\)/);
  assert.match(login, /"google"/);
  assert.match(login, /"vkid"/);
  assert.match(login, /data-auth-pending/);
  assert.match(login, /data-auth-failure="safe"/);
  assert.match(login, /className="cartAction"/);
  assert.match(completion, /useAuth\(\)/);
  assert.match(completion, /useCart\(\)/);
  assert.match(completion, /mergeAfterAuthentication/);
  assert.match(completion, /window\.history\.replaceState/);
  assert.match(completion, /data-cart-readiness=\{view\.outcome\}/);
  assert.match(completion, /data-cart-readiness="blocked"/);
  assert.match(completion, /Retry cart merge/);
  assert.match(completion, /createAuthCompletionController/);
  assert.match(completion, /controller\.authenticationLost\(\)/);
  assert.match(login, /createExclusiveAction/);
  assert.match(runner, /"auth-ui"/);

  for (const forbidden of [
    "state.error?.message",
    "authState.customer.id",
    "authState.customer.email",
    "JSON.stringify(authState.customer)",
    "dangerouslySetInnerHTML",
  ]) {
    assert.equal(login.includes(forbidden) || completion.includes(forbidden), false, forbidden);
  }
}

function mergedResult(overrides = {}) {
  const targetCartId = overrides.target_cart_id ?? "cart_target";
  return {
    cart: cart(targetCartId),
    merge: {
      source_cart_id: "cart_source",
      target_cart_id: targetCartId,
      outcome: "merged",
      replayed: false,
      ...overrides,
    },
  };
}

async function cartProviderNoSourceHandoff() {
  const storage = new MemoryStorage();
  const controller = createCartController(storage);
  return composeCartProviderHandoff(controller, storage, {
    async mergeCart() {
      throw new Error("no source must skip the merge request");
    },
  });
}

async function cartProviderMergedHandoff(overrides = {}) {
  const storage = new MemoryStorage();
  storage.setItem(
    CART_REFERENCE_KEY,
    JSON.stringify({ version: 1, cart_id: "cart_source" })
  );
  const result = mergedResult(overrides);
  const controller = createCartController(storage, result.merge.target_cart_id);
  return composeCartProviderHandoff(controller, storage, {
    async mergeCart() {
      return result;
    },
  });
}

async function composeCartProviderHandoff(controller, storage, mergeClient) {
  const result = await mergeAuthenticatedCartReference({ client: mergeClient, storage });
  const state = result ? await controller.restore() : controller.getState();
  return { result, state };
}

function createCartController(storage, expectedCartId = "cart_target") {
  return createGuestCartStateController({
    storage,
    client: {
      async retrieveCart(cartId) {
        assert.equal(cartId, expectedCartId);
        return cart(cartId);
      },
    },
  });
}

function cartState(status, value, error = null, operation = null) {
  return { status, operation, cart: value, error };
}

function cart(id) {
  return {
    id,
    customer_id: "cus_test",
    currency_code: "rub",
    region_id: "reg_test",
    sales_channel_id: "sc_test",
    items: [{ id: "item_test", variant_id: "variant_test", quantity: 1 }],
  };
}

function safeCartError() {
  return {
    code: "cart_backend_unavailable",
    message: "safe fixture",
    httpStatus: 503,
    recoverable: true,
  };
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

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

module.exports = { run };
