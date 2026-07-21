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

const { AuthClientError } = require("../lib/auth.ts");
const { createAuthStateController } = require("../lib/auth-state.ts");

async function run() {
  await verifySessionResolutionAndExpiry();
  await verifyLoginLifecycleAndSafePathHandoff();
  await verifyConfirmedLogoutOrdering();
  await verifyExpiredSessionLogoutCompletesCleanup();
  await verifyLogoutFailurePreservesConfirmedState();
  await verifyLogoutFailureDuringRestorePreservesLastConfirmedCustomer();
  await verifyLateCustomerResponseCannotUndoLogout();
  await verifyRestoreDuringLogoutCannotResurrectCustomer();
  await verifyConcurrentLogoutSharesOneBackendSuccess();
  await verifyCartCleanupFailureDoesNotReportGuest();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "auth-state",
        status: "ok",
        assertions: [
          "current-customer success is the only transition to session_established",
          "current-customer 401 and session expiry transition to guest",
          "provider start follows auth_starting to provider_pending with a safe path",
          "logout clears return path, cart reference, and customer only after session deletion",
          "logout 401 confirms session absence and completes shared-browser cleanup",
          "logout failure reports a recoverable error with the last confirmed customer/cart state",
          "failed logout overlapping restore suppresses the stale response without losing confirmed identity",
          "a late current-customer response cannot restore identity after confirmed logout",
          "restore during logout cannot start a stale current-customer response",
          "concurrent logout shares one backend DELETE and resolves to guest",
          "post-DELETE cart cleanup failure remains incomplete and retries without another DELETE",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifySessionResolutionAndExpiry() {
  let expired = false;
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        if (expired) {
          throw new AuthClientError("auth_required", "Authentication required.", 401);
        }
        return { id: "cus_session" };
      },
      async logout() {
        throw new Error("logout should not be called");
      },
    },
    clearLocalCartReference() {
      throw new Error("cart cleanup should not run on session expiry");
    },
  });
  const transitions = [];
  controller.subscribe((state) => transitions.push(state.status));

  let state = await controller.restoreSession();
  assert.equal(state.status, "session_established");
  assert.equal(state.customer.id, "cus_session");
  assert.deepEqual(transitions, ["customer_resolving", "session_established"]);

  expired = true;
  state = await controller.restoreSession();
  assert.deepEqual(state, { status: "guest", customer: null, error: null });
}

async function verifyLoginLifecycleAndSafePathHandoff() {
  const events = [];
  const controller = createAuthStateController({
    client: {
      async startProviderLogin(provider) {
        events.push(`request:${provider}`);
        return "https://provider.test/authorize";
      },
      async retrieveCurrentCustomer() {
        throw new Error("restore should not be called");
      },
      async logout() {
        throw new Error("logout should not be called");
      },
    },
    clearLocalCartReference() {},
    writeSafeReturnPath(path) {
      events.push(`path:${path}`);
      return path;
    },
  });
  controller.subscribe((state) => events.push(`state:${state.status}`));

  const location = await controller.startLogin("vkid", "/checkout");
  assert.equal(location, "https://provider.test/authorize");
  assert.deepEqual(events, [
    "path:/checkout",
    "state:auth_starting",
    "request:vkid",
    "state:provider_pending",
  ]);
}

async function verifyConfirmedLogoutOrdering() {
  const events = [];
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        return { id: "cus_logout" };
      },
      async logout() {
        events.push("session:deleted");
      },
    },
    clearSafeReturnPath() {
      events.push("return-path:cleared");
    },
    clearLocalCartReference() {
      events.push("cart-reference:cleared");
    },
  });
  await controller.restoreSession();
  controller.subscribe((state) => events.push(`state:${state.status}`));

  const state = await controller.logout();
  assert.deepEqual(events, [
    "state:logging_out",
    "session:deleted",
    "state:logging_out",
    "return-path:cleared",
    "cart-reference:cleared",
    "state:guest",
  ]);
  assert.deepEqual(state, { status: "guest", customer: null, error: null });
}

async function verifyExpiredSessionLogoutCompletesCleanup() {
  const deletion = deferred();
  const events = [];
  let deleteCalls = 0;
  let retrieveCalls = 0;
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        retrieveCalls += 1;
        return { id: "cus_expired" };
      },
      async logout() {
        deleteCalls += 1;
        await deletion.promise;
        throw new AuthClientError("auth_required", "Authentication required.", 401);
      },
    },
    clearSafeReturnPath() {
      events.push("return-path:cleared");
    },
    clearLocalCartReference() {
      events.push("cart-reference:cleared");
    },
  });
  await controller.restoreSession();
  controller.subscribe((state) => events.push(`state:${state.status}`));

  const firstLogout = controller.logout();
  const secondLogout = controller.logout();
  const restore = controller.restoreSession();
  deletion.resolve();

  const guestState = { status: "guest", customer: null, error: null };
  assert.deepEqual(await firstLogout, guestState);
  assert.deepEqual(await secondLogout, guestState);
  assert.deepEqual(await restore, guestState);
  assert.deepEqual(controller.getState(), guestState);
  assert.equal(deleteCalls, 1);
  assert.equal(retrieveCalls, 1);
  assert.deepEqual(events, [
    "state:logging_out",
    "state:logging_out",
    "return-path:cleared",
    "cart-reference:cleared",
    "state:guest",
  ]);
}

async function verifyLogoutFailurePreservesConfirmedState() {
  let cleanupCalls = 0;
  const failure = new AuthClientError(
    "auth_backend_unavailable",
    "Logout is unavailable.",
    503
  );
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        return { id: "cus_retry" };
      },
      async logout() {
        throw failure;
      },
    },
    clearSafeReturnPath() {
      cleanupCalls += 1;
    },
    clearLocalCartReference() {
      cleanupCalls += 1;
    },
  });
  await controller.restoreSession();

  await assert.rejects(() => controller.logout(), failure);
  assert.equal(cleanupCalls, 0);
  assert.deepEqual(controller.getState(), {
    status: "session_established",
    customer: { id: "cus_retry" },
    error: {
      code: "auth_backend_unavailable",
      message: "Logout is unavailable.",
      httpStatus: 503,
      recoverable: true,
    },
  });
}

async function verifyLogoutFailureDuringRestorePreservesLastConfirmedCustomer() {
  const customerResponse = deferred();
  const deletion = deferred();
  const failure = new AuthClientError(
    "auth_backend_unavailable",
    "Logout is unavailable.",
    503
  );
  let retrieveCalls = 0;
  let cleanupCalls = 0;
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        retrieveCalls += 1;
        return retrieveCalls === 1
          ? { id: "cus_confirmed" }
          : customerResponse.promise;
      },
      async logout() {
        await deletion.promise;
        throw failure;
      },
    },
    clearLocalCartReference() {
      cleanupCalls += 1;
    },
  });
  await controller.restoreSession();

  const restore = controller.restoreSession();
  const logout = controller.logout();
  deletion.resolve();

  await assert.rejects(logout, failure);
  const failedState = {
    status: "session_established",
    customer: { id: "cus_confirmed" },
    error: {
      code: "auth_backend_unavailable",
      message: "Logout is unavailable.",
      httpStatus: 503,
      recoverable: true,
    },
  };
  assert.deepEqual(controller.getState(), failedState);
  assert.equal(cleanupCalls, 0);

  customerResponse.resolve({ id: "cus_stale" });
  assert.deepEqual(await restore, failedState);
  assert.deepEqual(controller.getState(), failedState);
}

async function verifyLateCustomerResponseCannotUndoLogout() {
  const customerResponse = deferred();
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        return customerResponse.promise;
      },
      async logout() {},
    },
    clearLocalCartReference() {},
  });

  const restore = controller.restoreSession();
  await controller.logout();
  customerResponse.resolve({ id: "cus_stale" });
  await restore;

  assert.deepEqual(controller.getState(), {
    status: "guest",
    customer: null,
    error: null,
  });
}

async function verifyRestoreDuringLogoutCannotResurrectCustomer() {
  const deletion = deferred();
  let retrieveCalls = 0;
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        retrieveCalls += 1;
        return { id: "cus_before_logout" };
      },
      async logout() {
        await deletion.promise;
      },
    },
    clearLocalCartReference() {},
  });
  await controller.restoreSession();

  const logout = controller.logout();
  const restore = controller.restoreSession();
  deletion.resolve();

  assert.deepEqual(await logout, { status: "guest", customer: null, error: null });
  assert.deepEqual(await restore, { status: "guest", customer: null, error: null });
  assert.equal(retrieveCalls, 1);
}

async function verifyConcurrentLogoutSharesOneBackendSuccess() {
  const deletion = deferred();
  let deleteCalls = 0;
  let cleanupCalls = 0;
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        return { id: "cus_concurrent" };
      },
      async logout() {
        deleteCalls += 1;
        await deletion.promise;
      },
    },
    clearLocalCartReference() {
      cleanupCalls += 1;
    },
  });
  await controller.restoreSession();

  const first = controller.logout();
  const second = controller.logout();
  deletion.resolve();

  assert.deepEqual(await first, { status: "guest", customer: null, error: null });
  assert.deepEqual(await second, { status: "guest", customer: null, error: null });
  assert.equal(deleteCalls, 1);
  assert.equal(cleanupCalls, 1);
  assert.equal(controller.getState().status, "guest");
}

async function verifyCartCleanupFailureDoesNotReportGuest() {
  let deleteCalls = 0;
  let cleanupCalls = 0;
  let cartReferencePresent = true;
  const cleanupFailure = new Error("cart storage unavailable");
  const controller = createAuthStateController({
    client: {
      async startProviderLogin() {
        throw new Error("start should not be called");
      },
      async retrieveCurrentCustomer() {
        return { id: "cus_cleanup" };
      },
      async logout() {
        deleteCalls += 1;
      },
    },
    clearLocalCartReference() {
      cleanupCalls += 1;
      if (cleanupCalls === 1) {
        throw cleanupFailure;
      }
      cartReferencePresent = false;
    },
  });
  await controller.restoreSession();

  await assert.rejects(() => controller.logout(), cleanupFailure);
  assert.deepEqual(controller.getState(), {
    status: "logging_out",
    customer: null,
    error: null,
  });
  assert.equal(cartReferencePresent, true);
  assert.equal(deleteCalls, 1);

  assert.deepEqual(await controller.logout(), {
    status: "guest",
    customer: null,
    error: null,
  });
  assert.equal(cartReferencePresent, false);
  assert.equal(deleteCalls, 1);
  assert.equal(cleanupCalls, 2);
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
