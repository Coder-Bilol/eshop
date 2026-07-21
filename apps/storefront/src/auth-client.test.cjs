const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = compileTypeScript;

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

const {
  AUTH_RETURN_PATH_KEY,
  AuthClientError,
  consumeReturnPath,
  createStoreAuthClient,
  normalizeReturnPath,
  writeReturnPath,
} = require("../lib/auth.ts");

async function run() {
  await verifyCredentialsIncludedSessionClient();
  await verifyStableFailuresAndProviderAllowlist();
  verifyStrictConsumedReturnPath();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "auth-client",
        status: "ok",
        assertions: [
          "Google/VK start, current-customer, and logout use credentials include",
          "current-customer 401 maps to auth_required without backend detail leakage",
          "only exact Google/VK HTTPS authorization paths are accepted",
          "malformed queries, encoded controls, callback/return abuse, and duplicate parameters fail closed",
          "the versioned sessionStorage return path accepts exactly one leading slash and is consumed",
          "no JWT, provider token, authorization header, or customer payload is persisted",
        ],
      },
      null,
      2
    )}\n`
  );
}

async function verifyCredentialsIncludedSessionClient() {
  const calls = [];
  const responses = [
    jsonResponse({
      location:
        "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=http%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete",
    }),
    jsonResponse({
      location:
        "https://id.vk.com/authorize?redirect_uri=http%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fvkid%2Fcomplete",
    }),
    jsonResponse({ customer: { id: "cus_test", first_name: "Test" } }),
    jsonResponse({ success: true }),
  ];
  const client = createStoreAuthClient({
    baseUrl: "http://backend.test/",
    publishableApiKey: "pk_test_auth",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), init });
      return responses.shift();
    },
  });

  assert.equal(
    await client.startProviderLogin("google"),
    "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=http%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"
  );
  assert.equal(
    await client.startProviderLogin("vkid"),
    "https://id.vk.com/authorize?redirect_uri=http%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fvkid%2Fcomplete"
  );
  assert.equal((await client.retrieveCurrentCustomer()).id, "cus_test");
  assert.equal(await client.logout(), undefined);

  assert.deepEqual(
    calls.map((call) => [call.init.method, new URL(call.url).pathname]),
    [
      ["POST", "/auth/customer/google"],
      ["POST", "/auth/customer/vkid"],
      ["GET", "/store/customers/me"],
      ["DELETE", "/auth/session"],
    ]
  );
  for (const call of calls) {
    assert.equal(call.init.credentials, "include");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.headers["x-publishable-api-key"], "pk_test_auth");
    assert.equal("authorization" in call.init.headers, false);
    assert.equal("body" in call.init, false);
  }
}

async function verifyStableFailuresAndProviderAllowlist() {
  let called = false;
  const client = createStoreAuthClient({
    publishableApiKey: "pk_test_auth",
    fetchImplementation: async () => {
      called = true;
      return jsonResponse({ location: "https://unexpected.test" });
    },
  });
  await assert.rejects(
    () => client.startProviderLogin("github"),
    (error) =>
      error instanceof AuthClientError &&
      error.code === "auth_invalid_provider" &&
      error.status === 400
  );
  assert.equal(called, false);

  const expiredClient = createStoreAuthClient({
    publishableApiKey: "pk_test_auth",
    fetchImplementation: async () =>
      jsonResponse({ message: "native session detail" }, 401),
  });
  await assert.rejects(
    () => expiredClient.retrieveCurrentCustomer(),
    (error) =>
      error instanceof AuthClientError &&
      error.code === "auth_required" &&
      error.status === 401 &&
      !error.message.includes("native session detail")
  );

  const approvedLocations = [
    ["google", "https://accounts.google.com/o/oauth2/v2/auth"],
    [
      "google",
      "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=google-client&redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete&scope=openid+email&state=google-state&prompt=consent&access_type=offline",
    ],
    [
      "google",
      "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=google-client&redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete&scope=openid&state=google-state",
    ],
    ["vkid", "https://id.vk.com/authorize"],
    [
      "vkid",
      "https://id.vk.com/authorize?response_type=code&client_id=vk-client&redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fvkid%2Fcomplete&scope=email&state=vk-state&code_challenge=challenge&code_challenge_method=S256",
    ],
    [
      "google",
      `https://accounts.google.com/o/oauth2/v2/auth?state=${"a".repeat(4090)}`,
    ],
    [
      "vkid",
      `https://id.vk.com/authorize?${Array.from(
        { length: 32 },
        (_, index) => `p${index}=x`
      ).join("&")}`,
    ],
  ];
  for (const [provider, location] of approvedLocations) {
    assert.equal(await startLocation(provider, location), location);
  }

  const hostileLocations = [
    ["google", "https://attacker.example/o/oauth2/v2/auth"],
    ["google", "//accounts.google.com/o/oauth2/v2/auth"],
    ["google", "http://accounts.google.com/o/oauth2/v2/auth"],
    ["vkid", "http://id.vk.com/authorize"],
    ["google", "https://accounts.google.com.attacker.example/o/oauth2/v2/auth"],
    ["google", "https://accounts.google.com@attacker.example/o/oauth2/v2/auth"],
    ["google", "https://user:password@accounts.google.com/o/oauth2/v2/auth"],
    ["google", "https://accounts.google.com:443/o/oauth2/v2/auth"],
    ["vkid", "https://id.vk.com:443/authorize"],
    ["google", "https://accounts.google.com:8443/o/oauth2/v2/auth"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth#"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=x#"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth#return_url=https://attacker.example"],
    ["vkid", "https://id.vk.com/authorize#"],
    ["vkid", "https://id.vk.com/authorize#fragment"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth/"],
    ["google", "https://accounts.google.com/o/oauth2/auth"],
    ["google", "https://accounts.google.com/other/../o/oauth2/v2/auth"],
    ["google", "HTTPS://accounts.google.com/o/oauth2/v2/auth"],
    ["vkid", "https://id.vk.com/authorize/"],
    ["vkid", "https://id.vk.com/oauth2/authorize"],
    ["google", "https://id.vk.com/authorize"],
    ["vkid", "https://accounts.google.com/o/oauth2/v2/auth"],
    ["google", "https://backend.test/auth/customer/google/complete"],
    ["google", "/auth/customer/google/complete"],
    ["google", "javascript:alert(1)"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=value\n"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=x&&client_id=y"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?&state=x"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=x&"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%25"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%252"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%2520%25"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%2525"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%252525"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?%ZZ=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%E0%A4"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%00"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%2500"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?state=%C2%80"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri%00=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callback_url%25=x"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?%20=x"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?+=x"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?%3D=x"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect%255Furi=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callback%255Furl=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?return%255Furl=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callback%25255Furl=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callback%2525255Furl=value"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Farbitrary"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fvkid%2Fcomplete"],
    ["vkid", "https://id.vk.com/authorize?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete%3Freturn_url%3Dhttps%253A%252F%252Fattacker.example"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete%23fragment"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%3A443%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fuser%3Apassword%40backend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fattacker.example%2Fcallback"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri="],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callback_url=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callback=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?callbackUrl=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirectUri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?return_url=%2Fcheckout"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?returnUrl=%2Fcheckout"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?return-path=%2Fcheckout"],
    ["vkid", "https://id.vk.com/authorize?return_path=%2Fcheckout"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete&redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete&REDIRECT_URI=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["google", "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete&redirect%5Furi=https%3A%2F%2Fbackend.test%2Fauth%2Fcustomer%2Fgoogle%2Fcomplete"],
    ["vkid", "https://id.vk.com/authorize?state=one&state=two"],
    ["vkid", "https://id.vk.com/authorize?state=one&%2573tate=two"],
    [
      "google",
      `https://accounts.google.com/o/oauth2/v2/auth?state=${"a".repeat(4091)}`,
    ],
    [
      "google",
      `https://accounts.google.com/o/oauth2/v2/auth?state=${"a".repeat(1024 * 1024)}`,
    ],
    [
      "vkid",
      `https://id.vk.com/authorize?${Array.from(
        { length: 33 },
        (_, index) => `p${index}=x`
      ).join("&")}`,
    ],
    [
      "vkid",
      `https://id.vk.com/authorize?${Array.from(
        { length: 10000 },
        (_, index) => `p${index}=x`
      ).join("&")}`,
    ],
  ];
  for (const [provider, location] of hostileLocations) {
    await assert.rejects(
      () => startLocation(provider, location),
      (error) =>
        error instanceof AuthClientError && error.code === "auth_invalid_response",
      location
    );
  }
}

function startLocation(provider, location) {
  return createStoreAuthClient({
    baseUrl: "https://backend.test",
    publishableApiKey: "pk_test_auth",
    fetchImplementation: async () => jsonResponse({ location }),
  }).startProviderLogin(provider);
}

function verifyStrictConsumedReturnPath() {
  const storage = new MemoryStorage();
  for (const path of ["/", "/checkout", "/checkout?step=delivery#address"]) {
    assert.equal(normalizeReturnPath(path), path);
    assert.equal(writeReturnPath(path, storage), path);
    const raw = storage.getItem(AUTH_RETURN_PATH_KEY);
    assert.deepEqual(JSON.parse(raw), { version: 1, path });
    assert.equal(raw.toLowerCase().includes("token"), false);
    assert.equal(consumeReturnPath(storage), path);
    assert.equal(storage.getItem(AUTH_RETURN_PATH_KEY), null);
  }

  for (const path of [
    "",
    "checkout",
    "//external.test/path",
    "https://external.test",
    "/\\external.test",
    "/checkout\nnext",
  ]) {
    assert.equal(normalizeReturnPath(path), "/");
    assert.equal(writeReturnPath(path, storage), "/");
    assert.equal(consumeReturnPath(storage), "/");
  }

  for (const malformed of [
    "{not-json",
    JSON.stringify({ version: 2, path: "/checkout" }),
    JSON.stringify({ version: 1, path: "//external.test" }),
    JSON.stringify({ version: 1, path: "/checkout", access_token: "forbidden" }),
  ]) {
    storage.setItem(AUTH_RETURN_PATH_KEY, malformed);
    assert.equal(consumeReturnPath(storage), "/");
    assert.equal(storage.getItem(AUTH_RETURN_PATH_KEY), null);
  }

  const removalFailure = new RemoveFailureStorage();
  writeReturnPath("/checkout", removalFailure);
  assert.equal(consumeReturnPath(removalFailure), "/");
  assert.equal(consumeReturnPath(removalFailure), "/");

  const readFailure = new ReadFailureStorage();
  writeReturnPath("/checkout", readFailure);
  assert.equal(consumeReturnPath(readFailure), "/");
  assert.deepEqual(JSON.parse(readFailure.getItem(AUTH_RETURN_PATH_KEY)), {
    version: 1,
    path: "/checkout",
  });
  assert.equal(consumeReturnPath(readFailure), "/");
  assert.equal(readFailure.getItem(AUTH_RETURN_PATH_KEY), null);
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

class RemoveFailureStorage extends MemoryStorage {
  removeItem() {
    throw new Error("storage removal unavailable");
  }
}

class ReadFailureStorage extends MemoryStorage {
  constructor() {
    super();
    this.failNextRead = true;
  }
  getItem(key) {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error("storage read unavailable");
    }
    return super.getItem(key);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

module.exports = { run };
