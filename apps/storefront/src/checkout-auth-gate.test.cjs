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
  CHECKOUT_LOGIN_LOCATION,
  CHECKOUT_RETURN_PATH,
  canRenderCheckoutContinuation,
  classifyCheckoutCart,
  createCheckoutGateController,
  prepareCheckoutLogin,
} = require("../components/checkout-auth-gate.tsx");

async function run() {
  verifyStateMatrixAndSafeReturn();
  verifyCartClassification();
  await verifyControllerReadinessAndRetry();
  await verifyStaleWorkFailsClosed();
  verifyScopedUiBoundary();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "checkout-auth-gate",
        status: "ok",
        assertions: [
          "guest navigation stores /checkout only in sessionStorage and uses a clean /login URL",
          "every gate state except authenticated_ready blocks continuation",
          "backend-restored no-source and current-customer carts reach readiness",
          "guest cart uses the existing merge handoff and foreign ownership fails closed",
          "merge failure remains blocked and retryable without losing the session",
          "auth loss and unmount invalidate stale cart work",
          "continuation is only an FT-006 handoff and preserves backend authorization",
          "buyer-visible logout uses the confirmed AuthStateController path",
        ],
      },
      null,
      2
    )}\n`
  );
}

function verifyStateMatrixAndSafeReturn() {
  assert.equal(CHECKOUT_RETURN_PATH, "/checkout");
  assert.equal(CHECKOUT_LOGIN_LOCATION, "/login");
  const stored = [];
  assert.equal(
    prepareCheckoutLogin((value) => {
      stored.push(value);
      return value;
    }),
    CHECKOUT_LOGIN_LOCATION
  );
  assert.deepEqual(stored, ["/checkout"]);
  assert.equal(CHECKOUT_LOGIN_LOCATION.includes("return_path"), false);

  for (const status of [
    "checking_session",
    "guest",
    "auth_starting",
    "provider_pending",
    "callback_validating",
    "customer_resolving",
    "session_established",
    "cart_merge_pending",
    "merge_blocked",
    "auth_failed",
    "logging_out",
  ]) {
    assert.equal(canRenderCheckoutContinuation(status), false, status);
  }
  assert.equal(canRenderCheckoutContinuation("authenticated_ready"), true);
}

function verifyCartClassification() {
  assert.equal(
    classifyCheckoutCart(cartState("empty", null), "cus_current"),
    "authenticated_ready"
  );
  assert.equal(
    classifyCheckoutCart(
      cartState("ready", cart("cart_customer", "cus_current")),
      "cus_current"
    ),
    "authenticated_ready"
  );
  assert.equal(
    classifyCheckoutCart(
      cartState("ready", cart("cart_guest", null)),
      "cus_current"
    ),
    "merge_required"
  );

  for (const state of [
    cartState("ready", cart("cart_foreign", "cus_other")),
    cartState("loading", cart("cart_guest", null), null, "restore"),
    cartState("backend_error", cart("cart_guest", null), safeCartError()),
    cartState("idle", null),
  ]) {
    assert.equal(
      classifyCheckoutCart(state, "cus_current"),
      "merge_blocked"
    );
  }
}

async function verifyControllerReadinessAndRetry() {
  const noSourceViews = [];
  const noSourceController = createCheckoutGateController((view) =>
    noSourceViews.push(view)
  );
  noSourceController.mount();
  assert.equal(
    await noSourceController.start({
      customerId: "cus_current",
      async restoreCart() {
        return cartState("empty", null);
      },
      async mergeAfterAuthentication() {
        throw new Error("no-source checkout must not merge");
      },
    }),
    true
  );
  assert.equal(noSourceViews.at(-1).status, "authenticated_ready");
  noSourceController.unmount();

  const ownedViews = [];
  const ownedController = createCheckoutGateController((view) =>
    ownedViews.push(view)
  );
  ownedController.mount();
  let ownedMergeCalls = 0;
  await ownedController.start({
    customerId: "cus_current",
    async restoreCart() {
      return cartState("ready", cart("cart_customer", "cus_current"));
    },
    async mergeAfterAuthentication() {
      ownedMergeCalls += 1;
      return mergedHandoff();
    },
  });
  assert.equal(ownedMergeCalls, 0);
  assert.equal(ownedViews.at(-1).status, "authenticated_ready");
  ownedController.unmount();

  const retryViews = [];
  const retryController = createCheckoutGateController((view) =>
    retryViews.push(view)
  );
  retryController.mount();
  let mergeCalls = 0;
  await retryController.start({
    customerId: "cus_current",
    async restoreCart() {
      return cartState("ready", cart("cart_guest", null));
    },
    async mergeAfterAuthentication() {
      mergeCalls += 1;
      if (mergeCalls === 1) {
        throw new Error("raw merge failure");
      }
      return mergedHandoff();
    },
  });
  assert.equal(retryViews.at(-1).status, "merge_blocked");
  assert.equal(retryViews.at(-1).message.includes("raw merge failure"), false);
  assert.equal(await retryController.retry(), true);
  assert.equal(mergeCalls, 2);
  assert.equal(retryViews.at(-1).status, "authenticated_ready");
  retryController.unmount();

  const foreignViews = [];
  const foreignController = createCheckoutGateController((view) =>
    foreignViews.push(view)
  );
  foreignController.mount();
  let foreignMergeCalls = 0;
  await foreignController.start({
    customerId: "cus_current",
    async restoreCart() {
      return cartState("ready", cart("cart_foreign", "cus_other"));
    },
    async mergeAfterAuthentication() {
      foreignMergeCalls += 1;
      return mergedHandoff();
    },
  });
  assert.equal(foreignMergeCalls, 0);
  assert.equal(foreignViews.at(-1).status, "merge_blocked");
  foreignController.unmount();
}

async function verifyStaleWorkFailsClosed() {
  const views = [];
  const controller = createCheckoutGateController((view) => views.push(view));
  controller.mount();
  const restore = deferred();
  const pending = controller.start({
    customerId: "cus_current",
    restoreCart: () => restore.promise,
    async mergeAfterAuthentication() {
      return mergedHandoff();
    },
  });
  controller.blockForAuth("guest");
  restore.resolve(cartState("empty", null));
  assert.equal(await pending, false);
  assert.equal(views.at(-1).status, "guest");
  assert.equal(views.some((view) => view.status === "authenticated_ready"), false);

  const beforeUnmount = deferred();
  controller.blockForAuth("session_established");
  const stale = controller.start({
    customerId: "cus_current",
    restoreCart: () => beforeUnmount.promise,
    async mergeAfterAuthentication() {
      return mergedHandoff();
    },
  });
  controller.unmount();
  beforeUnmount.resolve(cartState("empty", null));
  assert.equal(await stale, false);
}

function verifyScopedUiBoundary() {
  const appPage = read(path.join(__dirname, "..", "app", "checkout", "page.tsx"));
  const loginPage = read(path.join(__dirname, "..", "app", "login", "page.tsx"));
  const gate = read(
    path.join(__dirname, "..", "components", "checkout-auth-gate.tsx")
  );
  const runner = read(path.join(__dirname, "test-runner.cjs"));

  assert.match(appPage, /<CheckoutAuthGate \/>/);
  assert.equal(loginPage.includes("return_path"), false);
  assert.equal(loginPage.includes("searchParams"), false);
  assert.match(gate, /restoreSession/);
  assert.match(gate, /restoreCart/);
  assert.match(gate, /mergeAfterAuthentication/);
  assert.match(gate, /window\.location\.replace\(prepareCheckoutLogin\(\)\)/);
  assert.match(gate, /Retry cart merge/);
  assert.match(gate, /data-checkout-continuation="ft-006-handoff"/);
  assert.match(gate, /does not replace customer authorization on backend/);
  assert.match(gate, /const \{ state: authState, restoreSession, logout \} = useAuth\(\)/);
  assert.match(gate, /loginNavigationStarted\.current = true;\s+try \{\s+await logout\(\);\s+window\.location\.replace\(CHECKOUT_LOGIN_LOCATION\)/);
  assert.match(gate, /catch \{\s+loginNavigationStarted\.current = false;/);
  assert.match(gate, /await logout\(\)/);
  assert.match(gate, /"Log out"/);
  assert.match(gate, /Sign-out could not be confirmed\. Try again\./);
  assert.match(runner, /"checkout-auth-gate"/);

  for (const forbidden of [
    "localStorage.setItem",
    "sessionStorage.setItem",
    "customer.email",
    "payment_method",
    "delivery_address",
    "createOrder",
    "startPayment",
  ]) {
    assert.equal(gate.includes(forbidden), false, forbidden);
  }
}

function cartState(status, value, error = null, operation = null) {
  return { status, operation, cart: value, error };
}

function cart(id, customerId) {
  return {
    id,
    customer_id: customerId,
    currency_code: "rub",
    region_id: "reg_test",
    sales_channel_id: "sc_test",
    items: [{ id: "item_test", variant_id: "variant_test", quantity: 1 }],
  };
}

function mergedHandoff() {
  const target = cart("cart_target", "cus_current");
  return {
    result: {
      cart: target,
      merge: {
        source_cart_id: "cart_source",
        target_cart_id: "cart_target",
        outcome: "merged",
        replayed: false,
      },
    },
    state: cartState("ready", target),
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
