const { execFileSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const medusaCli = require.resolve("@medusajs/cli/cli");
const suites = {
  catalog: "./src/scripts/smoke-catalog.ts",
  "product-detail": "./src/scripts/smoke-product-detail.ts",
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
    execFileSync(process.execPath, [medusaCli, "exec", suites[name]], {
      cwd: backendRoot,
      env: process.env,
      stdio: "inherit",
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        command: "test:integration",
        status: "ok",
        sourceBoundary: "medusa-query-graph",
        suites: selected,
      },
      null,
      2
    )}\n`
  );
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
