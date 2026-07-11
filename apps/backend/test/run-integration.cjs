const { execFileSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const medusaCli = require.resolve("@medusajs/cli/cli");
const suites = {
  catalog: "./src/scripts/smoke-catalog.ts",
  "product-detail": "./src/scripts/smoke-product-detail.ts",
  "cart-merge-persistence": "./src/scripts/smoke-cart-merge-persistence.ts",
  "cart-merge-plan": "./src/scripts/smoke-cart-merge-plan.ts",
  "cart-merge-lifecycle": "./src/scripts/smoke-cart-merge-lifecycle.ts",
  "cart-merge-api": "./src/scripts/smoke-cart-merge-api.ts",
  "cart-merge-acceptance": "./src/scripts/smoke-cart-merge-acceptance.ts",
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
    if (name === "cart-merge-persistence") {
      runCartMergePersistenceSuite(suites[name]);
      continue;
    }
    runMedusaScript(suites[name]);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        command: "test:integration",
        status: "ok",
        sourceBoundary: selected.some((name) => name.startsWith("cart-merge"))
          ? "medusa-module-postgresql"
          : "medusa-query-graph",
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
