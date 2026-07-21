import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const backendRoot = path.resolve(__dirname, "..", "..");
const syntheticSigningSecrets = {
  JWT_SECRET: "synthetic-jwt-secret",
  COOKIE_SECRET: "synthetic-cookie-secret",
};
const syntheticEnv = {
  GOOGLE_AUTH_ENABLED: "true",
  GOOGLE_OAUTH_CLIENT_ID: "synthetic-google-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "synthetic-google-client-secret",
  GOOGLE_OAUTH_CALLBACK_URL:
    "http://localhost:9000/auth/customer/google/complete",
  VK_ID_AUTH_ENABLED: "true",
  VK_ID_CLIENT_ID: "synthetic-vk-client-id",
  VK_ID_SERVICE_TOKEN: "synthetic-vk-service-token",
  VK_ID_CALLBACK_URL: "http://localhost:9000/auth/customer/vkid/complete",
  AUTH_SESSION_TTL_MS: "86400000",
  ...syntheticSigningSecrets,
};

Object.assign(process.env, syntheticEnv, { NODE_ENV: "development" });

const configPath = require.resolve("../../medusa-config");
const config = require(configPath) as {
  projectConfig: {
    http: {
      storeCors: string;
      adminCors: string;
      authCors: string;
      authMethodsPerActor: Record<string, string[]>;
    };
    cookieOptions: Record<string, unknown>;
    sessionOptions: Record<string, unknown>;
  };
  modules: Record<string, {
    resolve: string;
    options?: {
      providers?: Array<{
        id: string;
        resolve: string;
        options?: Record<string, unknown>;
      }>;
    };
  }>;
};
const reloadConfig = () => {
  delete require.cache[configPath];
  return require(configPath) as typeof config;
};

const authModule = config.modules.auth;
const providers = authModule?.options?.providers ?? [];

assert.deepEqual(config.projectConfig.http.authMethodsPerActor, {
  user: ["emailpass"],
  customer: ["google", "vkid"],
});
assert.deepEqual(
  providers.map((provider) => provider.id),
  ["emailpass", "google", "vkid"]
);
assert.equal(
  providers.find((provider) => provider.id === "google")?.options?.callbackUrl,
  syntheticEnv.GOOGLE_OAUTH_CALLBACK_URL
);
assert.equal(
  providers.find((provider) => provider.id === "vkid")?.options?.callbackUrl,
  syntheticEnv.VK_ID_CALLBACK_URL
);

assert.deepEqual(config.projectConfig.cookieOptions, {
  httpOnly: true,
  sameSite: "lax",
  secure: false,
  path: "/",
  maxAge: 86_400_000,
});
assert.deepEqual(config.projectConfig.sessionOptions, {
  resave: false,
  saveUninitialized: false,
  ttl: 86_400_000,
});
for (const cors of [
  config.projectConfig.http.storeCors,
  config.projectConfig.http.adminCors,
  config.projectConfig.http.authCors,
]) {
  assert.ok(cors && !cors.includes("*"));
}

const middlewareConfig = require("../api/middlewares").default as {
  routes: Array<{
    matcher: string;
    methods: string[];
    middlewares: Array<(...args: any[]) => unknown>;
  }>;
};
const googleStartGuard = middlewareConfig.routes.find(
  (route) => route.matcher === "/auth/customer/google"
);

assert.deepEqual(googleStartGuard?.methods, ["GET", "POST"]);

for (const method of ["GET", "POST"]) {
  let nextCalled = false;
  assert.throws(
    () =>
      googleStartGuard?.middlewares[0](
        {
          method,
          body: { callback_url: "https://attacker.invalid/callback" },
          query: {},
        },
        {},
        () => {
          nextCalled = true;
        }
      ),
    /OAuth callback URL overrides are not allowed/
  );
  assert.equal(nextCalled, false);
}

assert.throws(
  () =>
    googleStartGuard?.middlewares[0](
      { method: "GET", body: {}, query: { callback_url: "https://attacker.invalid" } },
      {},
      () => undefined
    ),
  /OAuth callback URL overrides are not allowed/
);

let acceptedNextCalled = false;
googleStartGuard?.middlewares[0](
  { method: "POST", body: {}, query: {} },
  {},
  () => {
    acceptedNextCalled = true;
  }
);
assert.equal(acceptedNextCalled, true);

for (const environmentCase of [
  { NODE_ENV: "production", STORE_CORS: "https://shop.example.test" },
  { NODE_ENV: "staging", STORE_CORS: "http://localhost:3000" },
  { NODE_ENV: "development", STORE_CORS: "https://shop.example.test" },
]) {
  Object.assign(process.env, syntheticSigningSecrets, environmentCase, {
    GOOGLE_AUTH_ENABLED: "false",
    VK_ID_AUTH_ENABLED: "false",
  });
  assert.equal(reloadConfig().projectConfig.cookieOptions.secure, true);
}

for (const missingSecret of ["JWT_SECRET", "COOKIE_SECRET"] as const) {
  Object.assign(process.env, syntheticSigningSecrets, {
    GOOGLE_AUTH_ENABLED: "false",
    VK_ID_AUTH_ENABLED: "false",
    NODE_ENV: "production",
    [missingSecret]: "",
  });
  assert.throws(
    () => reloadConfig(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(missingSecret));
      assert.ok(!error.message.includes("local-dev-jwt-secret-change-me"));
      assert.ok(!error.message.includes("local-dev-cookie-secret-change-me"));
      return true;
    }
  );
}

Object.assign(process.env, syntheticEnv, {
  NODE_ENV: "development",
  STORE_CORS: "http://localhost:3000",
});

const missingSecretMarker = "must-not-appear-in-output";
const missingSecretRun = spawnSync(
  process.execPath,
  ["-r", "ts-node/register", "-e", "require('./medusa-config')"],
  {
    cwd: backendRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...syntheticEnv,
      GOOGLE_OAUTH_CLIENT_SECRET: "",
      AUTH_CONFIG_SECRET_MARKER: missingSecretMarker,
    },
  }
);
const failureOutput = `${missingSecretRun.stdout}${missingSecretRun.stderr}`;

assert.notEqual(missingSecretRun.status, 0);
assert.match(
  failureOutput,
  /Missing required backend environment variable GOOGLE_OAUTH_CLIENT_SECRET for enabled Google OAuth provider/
);
assert.ok(!failureOutput.includes(missingSecretMarker));

console.log(
  JSON.stringify({
    status: "pass",
    actors: config.projectConfig.http.authMethodsPerActor,
    providers: providers.map((provider) => provider.id),
    callbackOverrideGuard: ["GET", "POST"],
    cookie: config.projectConfig.cookieOptions,
    sessionTtlMs: config.projectConfig.sessionOptions.ttl,
    cors: "explicit",
    nonLocalCookies: "secure",
    missingProductionSigningSecrets: "sanitized-fail-closed",
    missingEnabledSecret: "sanitized-fail-closed",
  })
);
