const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const rootDir = path.resolve(__dirname, "..", "..", "..");
const runners = [
  {
    file: "apps/backend/test/run-integration.cjs",
    known: "order-lifecycle-state",
    unknown: "order-lifecycle-acceptance",
    error: /Unknown integration suites:/,
  },
  {
    file: "apps/storefront/e2e/run-real-medusa-e2e.cjs",
    known: "catalog",
    unknown: "order-lifecycle-admin",
    error: /Unknown E2E suites:/,
  },
];

let assertions = 0;
for (const runner of runners) {
  const { selectSuites } = loadRunner(runner, [], false).exports;
  const defaults = Array.from(selectSuites([]));
  assert.ok(defaults.includes(runner.known));
  if (runner.known === "catalog") assert.deepEqual(defaults, ["catalog", "product-detail"]);
  assert.deepEqual(Array.from(selectSuites([runner.known, runner.known])), [runner.known]);
  for (const unknown of [runner.unknown, "typographical-error", "toString"]) {
    assert.throws(() => selectSuites([unknown]), runner.error);
    assert.throws(() => selectSuites([runner.known, unknown]), runner.error);
    // CLI mode executes the actual entrypoint with every write/process/network
    // operation forbidden. Unknown names must fail before reaching any of them.
    for (const args of [[unknown], [runner.known, unknown]]) {
      const result = loadRunner(runner, args, true);
      assert.match(result.errorOutput, runner.error);
      assert.ok(result.errorOutput.includes(unknown));
      assert.equal(result.sideEffects, 0);
      assert.equal(result.exitCode, 1);
      assertions += 4;
    }
    assertions += 2;
  }
  assertions += 2;
}
console.log(JSON.stringify({ suite: "runner-suite-selection", status: "ok", assertions, servicesStarted: false }));

function loadRunner(runner, args, cli) {
  const filename = path.join(rootDir, runner.file);
  const localRequire = createRequire(filename);
  const result = { exports: {}, errorOutput: "", sideEffects: 0, exitCode: 0 };
  const module = { exports: {} };
  const forbid = () => {
    result.sideEffects++;
    throw new Error("Forbidden runner side effect before suite validation.");
  };
  const forbiddenFs = new Set(["mkdirSync", "writeFileSync", "appendFileSync", "rmSync", "renameSync"]);
  const requireStub = (name) => {
    if (name === "node:child_process") return { execFileSync: forbid, spawn: forbid };
    if (name === "playwright") return { chromium: { launch: forbid } };
    const actual = localRequire(name);
    if (name === "node:fs") {
      return new Proxy(actual, { get(target, key) { return forbiddenFs.has(key) ? forbid : target[key]; } });
    }
    if (name === "node:http") return { ...actual, createServer: forbid };
    if (name.endsWith("local-runtime.cjs")) {
      return { checkPort: forbid, childEnv: forbid, extractJsonFromOutput: forbid, runNpmSync: forbid };
    }
    return actual;
  };
  requireStub.resolve = localRequire.resolve;
  requireStub.main = cli ? module : {};
  const fakeProcess = {
    argv: [process.execPath, filename, ...args], env: {}, execPath: process.execPath,
    stdout: { write: forbid }, exit(code) { result.exitCode = code; },
    get exitCode() { return result.exitCode; }, set exitCode(code) { result.exitCode = code; },
  };
  try {
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
      require: requireStub, module, exports: module.exports,
      __dirname: path.dirname(filename), __filename: filename,
      process: fakeProcess,
      console: { error(value) { result.errorOutput += String(value); } },
      Buffer, setTimeout: forbid,
    }, { filename, timeout: 5000 });
  } catch (error) {
    result.errorOutput += String(error);
    result.exitCode = 1;
  }
  result.exports = module.exports;
  return result;
}
