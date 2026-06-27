const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "apps", "backend");
const storefrontDir = path.join(rootDir, "apps", "storefront");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npmInvocation(args) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm", ...args],
    };
  }

  return {
    command: "npm",
    args,
  };
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  const lines = readText(filePath).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) values[key] = value;
  }

  return values;
}

function loadLocalEnv() {
  const rootExample = parseEnvFile(path.join(rootDir, ".env.example"));
  const rootLocal = parseEnvFile(path.join(rootDir, ".env"));
  const backendExample = parseEnvFile(path.join(backendDir, ".env.example"));
  const backendLocal = parseEnvFile(path.join(backendDir, ".env"));
  const storefrontExample = parseEnvFile(
    path.join(storefrontDir, ".env.example")
  );
  const storefrontLocal = parseEnvFile(path.join(storefrontDir, ".env"));

  return {
    rootExample,
    rootLocal,
    backendExample,
    backendLocal,
    storefrontExample,
    storefrontLocal,
    values: {
      ...rootExample,
      ...backendExample,
      ...storefrontExample,
      ...rootLocal,
      ...backendLocal,
      ...storefrontLocal,
      ...process.env,
    },
  };
}

function localRuntimeConfig() {
  const env = loadLocalEnv();
  const value = (key, fallback) => env.values[key] || fallback;
  const backendPort = Number(value("BACKEND_PORT", value("PORT", "9000")));
  const storefrontPort = Number(value("STOREFRONT_PORT", "3000"));

  return {
    env,
    backendPort,
    storefrontPort,
    backendUrl: value("LOCAL_BACKEND_URL", `http://localhost:${backendPort}`),
    storefrontUrl: value(
      "LOCAL_STOREFRONT_URL",
      `http://localhost:${storefrontPort}`
    ),
    databaseUrl:
      value(
        "DATABASE_URL",
        "postgres://postgres:postgres@127.0.0.1:5432/eshop"
      ),
  };
}

function childEnv(extra = {}) {
  const config = localRuntimeConfig();
  return {
    ...process.env,
    DATABASE_URL: config.databaseUrl,
    POSTGRES_MAINTENANCE_DATABASE:
      config.env.values.POSTGRES_MAINTENANCE_DATABASE || "postgres",
    BACKEND_PORT: String(config.backendPort),
    STOREFRONT_PORT: String(config.storefrontPort),
    LOCAL_BACKEND_URL: config.backendUrl,
    LOCAL_STOREFRONT_URL: config.storefrontUrl,
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: config.backendUrl,
    NEXT_PUBLIC_STOREFRONT_URL: config.storefrontUrl,
    ...extra,
  };
}

function runSync(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    env: childEnv(options.env),
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

function runNpmSync(args, options = {}) {
  const invocation = npmInvocation(args);
  return spawnSync(invocation.command, invocation.args, {
    cwd: rootDir,
    env: childEnv(options.env),
    encoding: "utf8",
    shell: false,
    ...options,
  });
}

function spawnNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return spawn(invocation.command, invocation.args, {
    cwd: rootDir,
    env: childEnv(options.env),
    stdio: options.stdio || "inherit",
    shell: false,
  });
}

function extractJsonFromOutput(output) {
  if (!output) return null;
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(output.slice(start, end + 1));
  } catch (_error) {
    return null;
  }
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function checkPort(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      resolve({
        host,
        port,
        available: false,
        code: error.code || "UNKNOWN",
      });
    });

    server.once("listening", () => {
      server.close(() => {
        resolve({ host, port, available: true });
      });
    });

    server.listen(port, host);
  });
}

function commandOutputSummary(result) {
  return {
    status: result.status,
    stdout: result.stdout ? result.stdout.trim() : "",
    stderr: result.stderr ? result.stderr.trim() : "",
  };
}

module.exports = {
  backendDir,
  checkPort,
  childEnv,
  commandOutputSummary,
  extractJsonFromOutput,
  fileExists,
  loadLocalEnv,
  localRuntimeConfig,
  npmCommand,
  os,
  printJson,
  readJson,
  rootDir,
  runNpmSync,
  runSync,
  spawnNpm,
  storefrontDir,
};
