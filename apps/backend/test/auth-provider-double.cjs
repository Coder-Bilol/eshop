const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { generateJwtToken } = require("@medusajs/framework/utils");

const backendRoot = path.resolve(__dirname, "..");
const compiledBackendRoot = path.join(backendRoot, ".medusa", "server");
const medusaCli = require.resolve("@medusajs/cli/cli");
const backendPort = Number(process.env.AUTH_ACCEPTANCE_HTTP_PORT || "9133");
const backendUrl = `http://127.0.0.1:${backendPort}`;
const storefrontOrigin = "http://127.0.0.1:3133";
const jwtSecret = "task033-local-jwt-secret";
const cookieSecret = "task033-local-cookie-secret";
const suites = [
  {
    name: "auth-vkid",
    script: "./src/scripts/smoke-auth-vkid.ts",
    args: ["auth-vkid"],
  },
  {
    name: "auth-completion",
    script: "./src/scripts/smoke-auth-completion.ts",
    args: ["auth-completion"],
  },
];
const forbiddenEvidence = [
  /synthetic-(?:access|refresh|id|provider)-token-must-not-(?:persist|survive)/i,
  /synthetic-(?:google-client|vk-service|jwt|cookie)-secret/i,
  /buyer@example\.com/i,
  /(?:127\.0\.0\.1|192\.0\.2\.\d+)/,
];

async function main() {
  const stateFile = process.argv[2];
  if (!stateFile || !path.isAbsolute(stateFile)) {
    throw new Error("A local auth acceptance state file is required.");
  }
  const runtimeState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.match(runtimeState.authIdentityId, /^authusr_/);
  assert.match(runtimeState.customerId, /^cus_/);
  assert.match(runtimeState.publishableApiKey, /^pk_/);
  assert.equal(runtimeState.provider, "google");

  for (const suite of suites) {
    runSyntheticSuite(suite);
  }
  await runHttpSessionAcceptance(runtimeState);

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "auth-provider-double",
        status: "ok",
        suites: suites.map((suite) => suite.name),
        callbacks: "invalid-replay-expiry-and-vkid-pkce-covered",
        sessionHttp:
          "set-cookie-current-customer-logout-and-restart-rejection-covered",
        rateLimit: "bounded-hashed-keys",
        evidencePrivacy: "no-token-secret-session-id-raw-ip-or-customer-email",
        liveProviders: false,
      },
      null,
      2
    )}\n`
  );
}

function runSyntheticSuite(suite) {
  const result = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", suite.script, ...suite.args],
    {
      cwd: backendRoot,
      encoding: "utf8",
      env: process.env,
      timeout: 300_000,
    }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;

  if (result.error || result.status !== 0) {
    throw new Error(`Synthetic ${suite.name} provider boundary failed.`);
  }
  for (const forbidden of forbiddenEvidence) {
    if (forbidden.test(output)) {
      throw new Error(`Synthetic ${suite.name} evidence privacy check failed.`);
    }
  }
}

async function runHttpSessionAcceptance(runtimeState) {
  assert.equal(await portAvailable(backendPort), true);
  const serverEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(backendPort),
    JWT_SECRET: jwtSecret,
    COOKIE_SECRET: cookieSecret,
    AUTH_CORS: storefrontOrigin,
    STORE_CORS: storefrontOrigin,
    GOOGLE_AUTH_ENABLED: "false",
    VK_ID_AUTH_ENABLED: "false",
  };
  const build = spawnSync(process.execPath, [medusaCli, "build"], {
    cwd: backendRoot,
    encoding: "utf8",
    env: serverEnv,
    timeout: 300_000,
  });
  if (build.error || build.status !== 0) {
    throw new Error("Real Medusa auth acceptance build failed.");
  }

  const bearer = generateJwtToken(
    {
      actor_id: runtimeState.customerId,
      actor_type: "customer",
      auth_identity_id: runtimeState.authIdentityId,
      auth_provider: runtimeState.provider,
      app_metadata: { customer_id: runtimeState.customerId },
      user_metadata: {},
    },
    { secret: jwtSecret, expiresIn: "15m" }
  );

  let backend = startBackend(serverEnv);
  try {
    await waitForHealth();
    const firstCookie = await createSessionCookie(bearer);
    await assertCurrentCustomer(
      firstCookie,
      runtimeState.customerId,
      runtimeState.publishableApiKey,
      200
    );
    const clearCookie = await logout(firstCookie);
    assert.match(clearCookie, /^connect\.sid=;/i);
    await assertCurrentCustomer(
      firstCookie,
      runtimeState.customerId,
      runtimeState.publishableApiKey,
      401
    );

    const restartCookie = await createSessionCookie(bearer);
    await assertCurrentCustomer(
      restartCookie,
      runtimeState.customerId,
      runtimeState.publishableApiKey,
      200
    );
    await stopBackend(backend);
    backend = null;
    assert.equal(await waitForPortState(true), true);

    backend = startBackend(serverEnv);
    await waitForHealth();
    await assertCurrentCustomer(
      restartCookie,
      runtimeState.customerId,
      runtimeState.publishableApiKey,
      401
    );
  } finally {
    await stopBackend(backend);
    assert.equal(await waitForPortState(true), true);
  }
}

function startBackend(env) {
  const child = spawn(process.execPath, [medusaCli, "start"], {
    cwd: compiledBackendRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.resume();
  child.stderr.resume();
  return child;
}

async function createSessionCookie(bearer) {
  const response = await fetch(`${backendUrl}/auth/session`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearer}`,
      origin: storefrontOrigin,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), storefrontOrigin);
  const setCookie = readSetCookie(response);
  assert.match(setCookie, /^connect\.sid=/i);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  return setCookie.split(";", 1)[0];
}

async function assertCurrentCustomer(
  cookie,
  customerId,
  publishableApiKey,
  expectedStatus
) {
  const response = await fetch(`${backendUrl}/store/customers/me`, {
    headers: {
      cookie,
      origin: storefrontOrigin,
      "x-publishable-api-key": publishableApiKey,
    },
  });
  assert.equal(response.status, expectedStatus);
  if (expectedStatus === 200) {
    const body = await response.json();
    assert.equal(body.customer?.id, customerId);
  }
}

async function logout(cookie) {
  const response = await fetch(`${backendUrl}/auth/session`, {
    method: "DELETE",
    headers: {
      cookie,
      origin: storefrontOrigin,
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  return readSetCookie(response);
}

function readSetCookie(response) {
  const values = response.headers.getSetCookie?.() || [];
  const value = values[0] || response.headers.get("set-cookie") || "";
  assert.ok(value);
  return value;
}

async function waitForHealth() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) return;
    } catch {
      // Backend startup is still in progress.
    }
    await delay(500);
  }
  throw new Error("Real Medusa auth acceptance startup timed out.");
}

async function stopBackend(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5_000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2_000),
    ]);
  }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () =>
      server.close(() => resolve(true))
    );
  });
}

async function waitForPortState(available) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await portAvailable(backendPort)) === available) return true;
    await delay(250);
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Auth acceptance failed.");
  process.exitCode = 1;
});
