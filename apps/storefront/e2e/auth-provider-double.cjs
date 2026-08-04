const Module = require("node:module");
const { generateKeyPairSync } = require("node:crypto");
const jwt = require("jsonwebtoken");

if (process.env.ESHOP_E2E_AUTH_PROVIDER_DOUBLE === "true") {
  installProviderDouble();
}

function installProviderDouble() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const originalLoad = Module._load;
  const originalFetch = globalThis.fetch;
  const fixtureSuffix = `${process.pid}${Date.now()}`;
  const vkUserId = `34${process.pid}${String(Date.now()).slice(-6)}`;

  Module._load = function load(request, parent, isMain) {
    if (request === "jwks-rsa") {
      return () => ({
        getSigningKey(_keyId, callback) {
          callback(null, { getPublicKey: () => publicPem });
        },
      });
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);

    if (url.origin === "https://oauth2.googleapis.com" && url.pathname === "/token") {
      if (url.searchParams.get("code")?.includes("failure")) {
        return new Response(null, { status: 502 });
      }
      const idToken = jwt.sign(
        {
          aud: process.env.GOOGLE_OAUTH_CLIENT_ID,
          email: `task034.google.${fixtureSuffix}@example.test`,
          email_verified: true,
          family_name: "Buyer",
          given_name: "Synthetic",
          iss: "https://accounts.google.com",
          sub: `task034-google-${fixtureSuffix}`,
        },
        privateKey,
        { algorithm: "RS256", expiresIn: "10m", keyid: "task034-local" }
      );
      return jsonResponse({ id_token: idToken });
    }

    if (url.origin === "https://id.vk.com" && url.pathname === "/oauth2/auth") {
      const body = new URLSearchParams(String(init.body || ""));
      if (body.get("code")?.includes("failure")) {
        return new Response(null, { status: 502 });
      }
      return jsonResponse({
        access_token: `task034-vk-token-${fixtureSuffix}`,
        state: body.get("state"),
        user_id: vkUserId,
      });
    }

    if (url.origin === "https://id.vk.com" && url.pathname === "/oauth2/user_info") {
      return jsonResponse({
        user: {
          email: `task034.vkid.${fixtureSuffix}@example.test`,
          first_name: "Synthetic",
          last_name: "Buyer",
          user_id: vkUserId,
        },
      });
    }

    return originalFetch(input, init);
  };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
