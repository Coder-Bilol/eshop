const {
  commandOutputSummary,
  printJson,
  runNpmSync,
  runSync,
} = require("./local-runtime.cjs");

function runStep(name, command, args) {
  process.stdout.write(`\n[${name}] ${[command, ...args].join(" ")}\n`);
  const result = runSync(command, args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    name,
    command: [command, ...args].join(" "),
    result: commandOutputSummary(result),
  };
}

function runNpmStep(name, args) {
  process.stdout.write(`\n[${name}] npm ${args.join(" ")}\n`);
  const result = runNpmSync(args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    name,
    command: `npm ${args.join(" ")}`,
    result: commandOutputSummary(result),
  };
}

function main() {
  const steps = [
    runStep("local-env", process.execPath, ["scripts/check-local-env.cjs"]),
    runNpmStep("backend-migrate", [
      "--workspace",
      "apps/backend",
      "run",
      "db:migrate",
    ]),
    runNpmStep("backend-seed", [
      "--workspace",
      "apps/backend",
      "run",
      "db:seed",
    ]),
    runNpmStep("backend-db-smoke", [
      "--workspace",
      "apps/backend",
      "run",
      "smoke:db",
    ]),
    runNpmStep("backend-typecheck", [
      "--workspace",
      "apps/backend",
      "run",
      "typecheck",
    ]),
    runNpmStep("storefront-typecheck", [
      "--workspace",
      "apps/storefront",
      "run",
      "typecheck",
    ]),
  ];

  const failed = steps.filter((step) => step.result.status !== 0);
  printJson({
    command: "smoke:local",
    status: failed.length === 0 ? "ok" : "failed",
    localRuntime: "windows-native",
    dockerRequired: false,
    runbook: ".memory-bank/runbooks/local-development.md",
    evidenceHint: ".tasks/TASK-XXX/",
    services: {
      postgresql: "verified by backend db:check and smoke:db",
      backend: "verified by db smoke and typecheck",
      storefront: "verified by typecheck and local env configuration",
    },
    steps,
    failedSteps: failed.map((step) => step.name),
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
