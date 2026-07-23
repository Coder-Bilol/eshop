import {
  ContainerRegistrationKeys,
  defineConfig,
  loadEnv,
  Modules,
} from "@medusajs/framework/utils";
import path from "node:path";

const projectRoot =
  path.basename(__dirname) === "server" &&
  path.basename(path.dirname(__dirname)) === ".medusa"
    ? path.resolve(__dirname, "..", "..")
    : __dirname;

const environment = process.env.NODE_ENV || "development";

loadEnv(environment, projectRoot);

const enabled = (name: string) => process.env[name]?.toLowerCase() === "true";

const requiredProviderEnv = (name: string, provider: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required backend environment variable ${name} for enabled ${provider} provider.`
    );
  }

  return value;
};

const signingSecret = (name: string, localFallback: string) => {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (environment === "production") {
    throw new Error(
      `Missing required backend environment variable ${name} in production.`
    );
  }

  return localFallback;
};

const explicitCors = (name: string, fallback: string) => {
  const value = process.env[name]?.trim() || fallback;
  const origins = value.split(",").map((origin) => origin.trim());

  if (
    origins.some((origin) => {
      try {
        const parsed = new URL(origin);
        return parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol);
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(`${name} must contain only explicit HTTP(S) origins.`);
  }

  return origins.join(",");
};

const sessionTtlMs = Number(process.env.AUTH_SESSION_TTL_MS ?? 86_400_000);

if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0) {
  throw new Error("AUTH_SESSION_TTL_MS must be a positive integer.");
}

const storeCors = explicitCors("STORE_CORS", "http://localhost:3000");
const adminCors = explicitCors("ADMIN_CORS", "http://localhost:9000");
const authCors = explicitCors(
  "AUTH_CORS",
  "http://localhost:3000,http://localhost:9000"
);
const secureCookies =
  environment !== "development" ||
  [storeCors, adminCors, authCors].some((cors) =>
    cors.split(",").some((origin) => {
      const parsed = new URL(origin);
      return (
        parsed.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
      );
    })
  );

const authProviders = [
  {
    resolve: "@medusajs/medusa/auth-emailpass",
    id: "emailpass",
  },
  ...(enabled("GOOGLE_AUTH_ENABLED")
    ? [
        {
          resolve: "@medusajs/medusa/auth-google",
          id: "google",
          options: {
            clientId: requiredProviderEnv(
              "GOOGLE_OAUTH_CLIENT_ID",
              "Google OAuth"
            ),
            clientSecret: requiredProviderEnv(
              "GOOGLE_OAUTH_CLIENT_SECRET",
              "Google OAuth"
            ),
            callbackUrl: requiredProviderEnv(
              "GOOGLE_OAUTH_CALLBACK_URL",
              "Google OAuth"
            ),
          },
        },
      ]
    : []),
  ...(enabled("VK_ID_AUTH_ENABLED")
    ? [
        {
          resolve: "./src/modules/auth-vkid",
          id: "vkid",
          options: {
            clientId: requiredProviderEnv("VK_ID_CLIENT_ID", "VK ID"),
            serviceToken: requiredProviderEnv("VK_ID_SERVICE_TOKEN", "VK ID"),
            callbackUrl: requiredProviderEnv("VK_ID_CALLBACK_URL", "VK ID"),
          },
        },
      ]
    : []),
];

module.exports = defineConfig({
  projectConfig: {
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/eshop",
    databaseDriverOptions: {
      connection: {
        ssl: false,
      },
    },
    http: {
      storeCors,
      adminCors,
      authCors,
      jwtSecret: signingSecret(
        "JWT_SECRET",
        "local-dev-jwt-secret-change-me"
      ),
      cookieSecret: signingSecret(
        "COOKIE_SECRET",
        "local-dev-cookie-secret-change-me"
      ),
      authMethodsPerActor: {
        user: ["emailpass"],
        customer: ["google", "vkid"],
      },
    },
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      maxAge: sessionTtlMs,
    },
    sessionOptions: {
      resave: false,
      saveUninitialized: false,
      ttl: sessionTtlMs,
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: authProviders,
      },
    },
    {
      resolve: "./src/modules/cart-merge",
    },
  ],
});
