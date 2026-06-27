import type { ConfigModule } from "@medusajs/framework";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/eshop";

const config: Partial<ConfigModule> = {
  projectConfig: {
    databaseUrl,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:9000",
      authCors: process.env.AUTH_CORS ?? "http://localhost:3000,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET ?? "local-dev-jwt-secret-change-me",
      cookieSecret:
        process.env.COOKIE_SECRET ?? "local-dev-cookie-secret-change-me",
    },
  },
};

export default config;
