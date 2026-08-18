const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const medusaCli = require.resolve("@medusajs/cli/cli");
const authAcceptanceRunFilePattern =
  /^(task033[a-z0-9]{1,33})-auth-(owner|state)\.json$/;
const maxAuthAcceptanceRuns = 20;
const maxAuthAcceptanceRunAgeMs = 2 * 60 * 60 * 1000;
const suites = {
  catalog: "./src/scripts/smoke-catalog.ts",
  "product-detail": "./src/scripts/smoke-product-detail.ts",
  "cart-merge-persistence": "./src/scripts/smoke-cart-merge-persistence.ts",
  "cart-merge-plan": "./src/scripts/smoke-cart-merge-plan.ts",
  "cart-merge-lifecycle": "./src/scripts/smoke-cart-merge-lifecycle.ts",
  "cart-merge-api": "./src/scripts/smoke-cart-merge-api.ts",
  "cart-merge-acceptance": "./src/scripts/smoke-cart-merge-acceptance.ts",
  "wishlist-product-id": [
    "./src/scripts/smoke-catalog.ts",
    "./src/scripts/smoke-product-detail.ts",
  ],
  "wishlist-persistence": "./src/scripts/smoke-wishlist-persistence.ts",
  "wishlist-workflows": "./src/scripts/smoke-wishlist-workflows.ts",
  "wishlist-api": "./src/scripts/smoke-wishlist-api.ts",
  "wishlist-acceptance": "./src/scripts/smoke-wishlist-acceptance.ts",
  "auth-vkid": "./src/scripts/smoke-auth-vkid.ts",
  "auth-completion": "./src/scripts/smoke-auth-completion.ts",
  "auth-acceptance": "./src/scripts/smoke-auth-acceptance.ts",
  "checkout-delivery-options":
    "./src/scripts/smoke-checkout-delivery-options.ts",
  "checkout-delivery": "./src/scripts/smoke-checkout-delivery.ts",
  "checkout-delivery-acceptance":
    "./src/scripts/smoke-checkout-delivery-acceptance.ts",
  "pending-order": "./src/scripts/smoke-pending-order.ts",
  "pending-order-expiry": "./src/scripts/smoke-pending-order-expiry.ts",
};

function main() {
  const requested = process.argv.slice(2);
  const selected =
    requested.length === 0
      ? Object.keys(suites)
      : requested.filter((name) => suites[name]);
  if (selected.length === 0) {
    throw new Error(
      `No integration suites matched: ${requested.join(", ") || "(none)"}`
    );
  }

  for (const name of selected) {
    if (name === "wishlist-product-id") {
      for (const script of suites[name]) {
        runMedusaScript(script);
      }
      continue;
    }
    if (name === "cart-merge-persistence") {
      runCartMergePersistenceSuite(suites[name]);
      continue;
    }
    if (name === "auth-acceptance") {
      runAuthAcceptanceSuite(suites[name]);
      continue;
    }
    if (name === "wishlist-persistence") {
      runWishlistPersistenceSuite(suites[name]);
      continue;
    }
    if (name === "wishlist-acceptance") {
      runWishlistAcceptanceSuite(suites[name]);
      continue;
    }
    if (name.startsWith("auth-")) {
      runAuthContractSuite(name, suites[name]);
      continue;
    }
    runMedusaScript(suites[name]);
  }

  let sourceBoundary = "medusa-query-graph";
  if (selected.some((name) => name.startsWith("cart-merge"))) {
    sourceBoundary = "medusa-module-postgresql";
  }
  if (selected.some((name) => name.startsWith("auth-"))) {
    sourceBoundary = "synthetic-auth-contract";
  }
  if (selected.includes("auth-acceptance")) {
    sourceBoundary = "medusa-auth-customer-postgresql";
  }
  if (selected.includes("wishlist-persistence")) {
    sourceBoundary = "medusa-module-postgresql";
  }
  if (selected.includes("wishlist-workflows")) {
    sourceBoundary = "wishlist-module-query-graph";
  }
  if (selected.includes("wishlist-api")) {
    sourceBoundary = "medusa-route-workflow-module-postgresql";
  }
  if (selected.includes("wishlist-acceptance")) {
    sourceBoundary = "medusa-store-routes-workflows-module-postgresql";
  }
  if (selected.includes("checkout-delivery-options")) {
    sourceBoundary = "medusa-admin-shipping-options-pricing-link";
  }
  if (selected.includes("checkout-delivery")) {
    sourceBoundary =
      "medusa-http-route-middleware-session-workflow-admin-shipping-options";
  }
  if (selected.includes("checkout-delivery-acceptance")) {
    sourceBoundary =
      "real-compiled-medusa-http-session-workflow-admin-postgresql";
  }
  if (selected.includes("pending-order")) {
    sourceBoundary = "real-medusa-postgresql-route-workflow-order-inventory";
  }
  if (selected.includes("pending-order-expiry")) {
    sourceBoundary = "real-medusa-postgresql-job-workflow-order-inventory";
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        command: "test:integration",
        status: "ok",
        sourceBoundary,
        suites: selected,
      },
      null,
      2
    )}\n`
  );
}

function runCartMergePersistenceSuite(script) {
  const sourceCartId = `cart_task017_${process.pid}_${Date.now()}`;
  for (const phase of ["write", "read"]) {
    runMedusaScript(script, {
      CART_MERGE_PERSISTENCE_PHASE: phase,
      CART_MERGE_PERSISTENCE_SOURCE_CART_ID: sourceCartId,
    });
  }
}

function runWishlistPersistenceSuite(script) {
  const runId = `task035${process.pid.toString(36)}${Date.now().toString(36)}`;
  const phaseEnv = { WISHLIST_PERSISTENCE_RUN_ID: runId };

  try {
    for (const phase of ["write", "read", "delete"]) {
      runMedusaScript(script, {
        ...phaseEnv,
        WISHLIST_PERSISTENCE_PHASE: phase,
      });
    }
  } finally {
    runMedusaScript(script, {
      ...phaseEnv,
      WISHLIST_PERSISTENCE_PHASE: "cleanup",
    });
  }
}

function runWishlistAcceptanceSuite(script) {
  const runId = `task041${process.pid.toString(36)}${Date.now().toString(36)}`;
  const stateFile = path.join(
    os.tmpdir(),
    `${runId}-wishlist-acceptance-state.json`
  );
  const phaseEnv = {
    WISHLIST_ACCEPTANCE_RUN_ID: runId,
    WISHLIST_ACCEPTANCE_STATE_FILE: stateFile,
  };

  try {
    runMedusaScript(script, {
      ...phaseEnv,
      WISHLIST_ACCEPTANCE_PHASE: "write",
    });
    runMedusaScript(script, {
      ...phaseEnv,
      WISHLIST_ACCEPTANCE_PHASE: "read",
    });
  } finally {
    runMedusaScript(script, {
      ...phaseEnv,
      WISHLIST_ACCEPTANCE_PHASE: "cleanup",
    });
    fs.rmSync(stateFile, { force: true });
  }
}

function runAuthAcceptanceSuite(script) {
  const previouslyRecovered = recoverAuthAcceptanceRuns(script);
  const simulatedRecovered = simulateInterruptedAuthAcceptanceRun(script);
  if (simulatedRecovered !== 1) {
    throw new Error("Interrupted auth acceptance recovery was not deterministic.");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "auth-acceptance",
        phase: "interruption-recovery",
        status: "ok",
        previouslyRecovered,
        simulatedRecovered,
        evidencePrivacy: "coarse-assertions-only",
      },
      null,
      2
    )}\n`
  );

  const runId = createAuthAcceptanceRunId("normal");
  const { ownerFile, stateFile } = authAcceptanceRunFiles(runId);
  const phaseEnv = {
    AUTH_ACCEPTANCE_RUN_ID: runId,
    AUTH_ACCEPTANCE_STATE_FILE: stateFile,
  };

  writeAuthAcceptanceOwner(ownerFile, process.pid, "wx");
  try {
    runMedusaScript(script, {
      ...phaseEnv,
      AUTH_ACCEPTANCE_PHASE: "write",
    });
    execFileSync(
      process.execPath,
      [path.resolve(__dirname, "auth-provider-double.cjs"), stateFile],
      {
        cwd: backendRoot,
        env: process.env,
        stdio: "inherit",
      }
    );
    runMedusaScript(script, {
      ...phaseEnv,
      AUTH_ACCEPTANCE_PHASE: "read",
    });
  } finally {
    runMedusaScript(script, {
      ...phaseEnv,
      AUTH_ACCEPTANCE_PHASE: "cleanup",
    });
    fs.rmSync(stateFile, { force: true });
    fs.rmSync(ownerFile, { force: true });
  }
}

function simulateInterruptedAuthAcceptanceRun(script) {
  const runId = createAuthAcceptanceRunId("recovery");
  const { ownerFile, stateFile } = authAcceptanceRunFiles(runId);
  const phaseEnv = {
    AUTH_ACCEPTANCE_RUN_ID: runId,
    AUTH_ACCEPTANCE_STATE_FILE: stateFile,
  };

  writeAuthAcceptanceOwner(ownerFile, process.pid, "wx");
  runMedusaScript(script, {
    ...phaseEnv,
    AUTH_ACCEPTANCE_PHASE: "write",
  });

  // A dead owner after successful writes models termination before finally.
  writeAuthAcceptanceOwner(ownerFile, 2_147_483_647);
  return recoverAuthAcceptanceRuns(script);
}

function recoverAuthAcceptanceRuns(script) {
  const runs = discoverAuthAcceptanceRuns();
  let recovered = 0;

  for (const run of runs) {
    if (run.ownerFile && authAcceptanceOwnerIsAlive(run.ownerFile)) {
      continue;
    }

    const { ownerFile, stateFile } = authAcceptanceRunFiles(run.runId);
    runMedusaScript(script, {
      AUTH_ACCEPTANCE_RUN_ID: run.runId,
      AUTH_ACCEPTANCE_STATE_FILE: stateFile,
      AUTH_ACCEPTANCE_PHASE: "cleanup",
    });
    fs.rmSync(stateFile, { force: true });
    fs.rmSync(ownerFile, { force: true });
    recovered += 1;
  }

  return recovered;
}

function discoverAuthAcceptanceRuns() {
  const tempDir = os.tmpdir();
  const runs = new Map();

  for (const entry of fs.readdirSync(tempDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = authAcceptanceRunFilePattern.exec(entry.name);
    if (!match) continue;

    const runId = match[1];
    const run = runs.get(runId) || { runId };
    run[match[2] === "owner" ? "ownerFile" : "stateFile"] = path.join(
      tempDir,
      entry.name
    );
    runs.set(runId, run);
  }

  if (runs.size > maxAuthAcceptanceRuns) {
    throw new Error("Too many TASK-033 temp runs require recovery.");
  }

  return [...runs.values()].sort((left, right) =>
    left.runId.localeCompare(right.runId)
  );
}

function authAcceptanceOwnerIsAlive(ownerFile) {
  let ownerPid;
  let startedAt;
  try {
    const marker = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
    ownerPid = marker.ownerPid;
    startedAt = marker.startedAt;
  } catch {
    return false;
  }

  if (
    !Number.isSafeInteger(ownerPid) ||
    ownerPid <= 0 ||
    !Number.isSafeInteger(startedAt) ||
    startedAt > Date.now() ||
    Date.now() - startedAt > maxAuthAcceptanceRunAgeMs
  ) {
    return false;
  }
  try {
    process.kill(ownerPid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function writeAuthAcceptanceOwner(ownerFile, ownerPid, flag) {
  fs.writeFileSync(ownerFile, JSON.stringify({ ownerPid, startedAt: Date.now() }), {
    encoding: "utf8",
    mode: 0o600,
    ...(flag ? { flag } : {}),
  });
}

function createAuthAcceptanceRunId(suffix) {
  return `task033${process.pid.toString(36)}${Date.now().toString(36)}${suffix}`;
}

function authAcceptanceRunFiles(runId) {
  return {
    ownerFile: path.join(os.tmpdir(), `${runId}-auth-owner.json`),
    stateFile: path.join(os.tmpdir(), `${runId}-auth-state.json`),
  };
}

function runAuthContractSuite(name, script) {
  const args = ["-r", "ts-node/register", script, name];
  execFileSync(process.execPath, args, {
    cwd: backendRoot,
    env: process.env,
    stdio: "inherit",
  });
}

function runMedusaScript(script, extraEnv = {}) {
  execFileSync(process.execPath, [medusaCli, "exec", script], {
    cwd: backendRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
  });
}

try {
  main();
} catch (error) {
  console.error(
    error && (error.stack || error.message)
      ? error.stack || error.message
      : error
  );
  process.exitCode = 1;
}
