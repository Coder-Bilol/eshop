const path = require("node:path");

const suites = {
  catalog: path.join(__dirname, "integration", "catalog.test.cjs"),
  "product-detail": path.join(__dirname, "integration", "product-detail.test.cjs"),
};

async function main() {
  const requested = process.argv.slice(2);
  const selected =
    requested.length === 0 ? Object.keys(suites) : requested.filter((name) => suites[name]);

  if (selected.length === 0) {
    throw new Error(
      `No integration suites matched: ${requested.join(", ") || "(none)"}`
    );
  }

  const results = [];
  for (const name of selected) {
    const suite = require(suites[name]);
    await suite.run();
    results.push(name);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        command: "test:integration",
        status: "ok",
        suites: results,
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  console.error(error && (error.stack || error.message) ? error.stack || error.message : error);
  process.exitCode = 1;
});
