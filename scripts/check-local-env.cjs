const path = require("node:path");
const {
  checkPort,
  commandOutputSummary,
  extractJsonFromOutput,
  fileExists,
  loadLocalEnv,
  localRuntimeConfig,
  os,
  printJson,
  readJson,
  rootDir,
  runNpmSync,
  runSync,
} = require("./local-runtime.cjs");

const secretKeyPattern = /(SECRET|TOKEN|PASSWORD|CLIENT_SECRET|KEY)$/i;

function requireCondition(failures, condition, message) {
  if (!condition) failures.push(message);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson.scripts && packageJson.scripts[scriptName]);
}

function placeholderSafe(key, value) {
  if (!secretKeyPattern.test(key)) return true;
  if (!value) return false;
  return /placeholder|local|mock|change-me/i.test(value);
}

function inspectEnvPlaceholders(envMaps) {
  const allValues = Object.assign({}, ...envMaps);
  const inspectedKeys = Object.keys(allValues).filter((key) =>
    secretKeyPattern.test(key)
  );
  const unsafe = inspectedKeys.filter(
    (key) => !placeholderSafe(key, allValues[key])
  );
  return { inspectedKeys, unsafe };
}

function inspectGitignore() {
  const content = fileExists(".gitignore")
    ? require("node:fs").readFileSync(path.join(rootDir, ".gitignore"), "utf8")
    : "";
  const requiredPatterns = [
    ".env",
    ".env.*",
    "!.env.example",
    "apps/*/.env",
    "apps/*/.env.*",
    "!apps/*/.env.example",
  ];

  return {
    requiredPatterns,
    presentPatterns: requiredPatterns.filter((pattern) =>
      content.split(/\r?\n/).includes(pattern)
    ),
  };
}

async function main() {
  const failures = [];
  const config = localRuntimeConfig();
  const env = loadLocalEnv();
  const rootPackage = readJson(path.join(rootDir, "package.json"));
  const backendPackage = readJson(
    path.join(rootDir, "apps", "backend", "package.json")
  );
  const storefrontPackage = readJson(
    path.join(rootDir, "apps", "storefront", "package.json")
  );

  const npmVersionResult = runNpmSync(["--version"]);

  const templates = {
    root: fileExists(".env.example"),
    backend: fileExists("apps/backend/.env.example"),
    storefront: fileExists("apps/storefront/.env.example"),
  };
  requireCondition(
    failures,
    templates.root && templates.backend && templates.storefront,
    "Root, backend, and storefront .env.example templates must exist."
  );

  const gitignore = inspectGitignore();
  requireCondition(
    failures,
    gitignore.presentPatterns.length === gitignore.requiredPatterns.length,
    "Real .env files must be ignored while .env.example templates stay trackable."
  );

  const rootScripts = [
    "check:local-env",
    "dev:local",
    "dev:local:watch",
    "smoke:local",
  ];
  const backendScripts = ["db:check", "db:migrate", "db:seed", "smoke:db"];
  const storefrontScripts = ["dev", "typecheck"];

  requireCondition(
    failures,
    rootScripts.every((script) => hasScript(rootPackage, script)),
    "Root package.json must expose local runtime scripts."
  );
  requireCondition(
    failures,
    backendScripts.every((script) => hasScript(backendPackage, script)),
    "Backend package.json must expose DB check/migrate/seed/smoke scripts."
  );
  requireCondition(
    failures,
    storefrontScripts.every((script) => hasScript(storefrontPackage, script)),
    "Storefront package.json must expose dev and typecheck scripts."
  );

  const envPlaceholderInspection = inspectEnvPlaceholders([
    env.rootExample,
    env.backendExample,
    env.storefrontExample,
  ]);
  requireCondition(
    failures,
    envPlaceholderInspection.unsafe.length === 0,
    "Secret-like .env.example values must be obvious local placeholders."
  );

  const dbCheck = runNpmSync(["--workspace", "apps/backend", "run", "db:check"]);
  const dbSummary = extractJsonFromOutput(
    `${dbCheck.stdout || ""}\n${dbCheck.stderr || ""}`
  );
  requireCondition(
    failures,
    dbCheck.status === 0,
    "Local PostgreSQL must be reachable through backend db:check."
  );

  const backendPort = await checkPort("127.0.0.1", config.backendPort);
  const storefrontPort = await checkPort("127.0.0.1", config.storefrontPort);

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  requireCondition(failures, nodeMajor >= 20, "Node.js 20 or newer is required.");
  requireCondition(
    failures,
    npmVersionResult.status === 0,
    "npm must be available on PATH."
  );
  requireCondition(
    failures,
    process.platform === "win32",
    "TASK-003 local runtime target is Windows-native development."
  );

  const payload = {
    command: "check:local-env",
    status: failures.length === 0 ? "ok" : "failed",
    platform: process.platform,
    osRelease: os.release(),
    nodeVersion: process.version,
    npmVersion:
      npmVersionResult.status === 0 ? npmVersionResult.stdout.trim() : null,
    localRuntime: "windows-native",
    dockerRequired: false,
    templates,
    gitignore,
    scripts: {
      root: rootScripts,
      backend: backendScripts,
      storefront: storefrontScripts,
    },
    ports: {
      backend: backendPort,
      storefront: storefrontPort,
    },
    database: {
      command: "npm --workspace apps/backend run db:check",
      result: commandOutputSummary(dbCheck),
      summary: dbSummary,
    },
    envPlaceholders: envPlaceholderInspection,
    failures,
  };

  printJson(payload);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
