const {
  localRuntimeConfig,
  printJson,
  runSync,
  spawnNpm,
} = require("./local-runtime.cjs");

const args = new Set(process.argv.slice(2));

function shouldWatch() {
  if (args.has("--watch")) return true;
  if (args.has("--check")) return false;
  if (process.env.LOCAL_DEV_MODE === "check") return false;
  if (process.env.CI) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function runCheck() {
  const result = runSync(process.execPath, ["scripts/check-local-env.cjs"]);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

function runCheckMode() {
  const ok = runCheck();
  printJson({
    command: "dev:local",
    mode: "check",
    status: ok ? "ok" : "failed",
    startup: "bounded-noninteractive-check",
    services: {
      postgresql: "verified by backend db:check",
      backend: "start command available: npm --workspace apps/backend run dev",
      storefront:
        "start command available: npm --workspace apps/storefront run dev",
    },
    interactiveStartCommand: "npm run dev:local:watch",
    dockerRequired: false,
  });
  if (!ok) process.exitCode = 1;
}

function runWatchMode() {
  if (!runCheck()) {
    process.exitCode = 1;
    return;
  }

  const config = localRuntimeConfig();
  const children = [
    spawnNpm(["--workspace", "apps/backend", "run", "dev"], {
      env: { PORT: String(config.backendPort) },
    }),
    spawnNpm(["--workspace", "apps/storefront", "run", "dev"], {
      env: { PORT: String(config.storefrontPort) },
    }),
  ];

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  for (const child of children) {
    child.on("exit", (code) => {
      if (!shuttingDown && code !== 0) {
        shutdown();
        process.exitCode = code || 1;
      }
    });
  }
}

if (shouldWatch()) {
  runWatchMode();
} else {
  runCheckMode();
}
