const fs = require("node:fs");
const path = require("node:path");
const { Client, escapeIdentifier } = require("@medusajs/framework/pg");

const backendRoot = path.resolve(__dirname, "..");
const defaultDatabaseUrl =
  "postgres://postgres:postgres@127.0.0.1:5432/eshop";
const smokeTable = "eshop_local_smoke_records";
const migrationsTable = "eshop_local_migrations";
const catalogCategoriesTable = "eshop_local_catalog_categories";
const catalogProductsTable = "eshop_local_catalog_products";
const catalogVariantsTable = "eshop_local_catalog_variants";
const seedKey = "seed:local:smoke";
const migrationId = "TASK-002-local-smoke-v1";
const catalogMigrationId = "TASK-005-catalog-seed-v1";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadBackendEnv() {
  loadEnvFile(path.join(backendRoot, ".env"));
}

function getDatabaseUrl() {
  loadBackendEnv();
  return process.env.DATABASE_URL || defaultDatabaseUrl;
}

function redactDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  if (url.password) {
    url.password = "*****";
  }
  return url.toString();
}

function getTargetDatabaseName(connectionString) {
  const url = new URL(connectionString);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!dbName) {
    throw new Error("DATABASE_URL must include a database name");
  }
  return dbName;
}

function getMaintenanceDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  const maintenanceDb = process.env.POSTGRES_MAINTENANCE_DATABASE || "postgres";
  url.pathname = `/${encodeURIComponent(maintenanceDb)}`;
  return url.toString();
}

function createClient(connectionString) {
  return new Client({ connectionString });
}

function getConnectionSummary(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname || "localhost",
    port: url.port || "5432",
    database: getTargetDatabaseName(connectionString),
    user: decodeURIComponent(url.username || ""),
    maintenanceDatabase: process.env.POSTGRES_MAINTENANCE_DATABASE || "postgres",
    redactedConnectionString: redactDatabaseUrl(connectionString),
  };
}

async function ensureDatabaseExists(connectionString = getDatabaseUrl()) {
  const targetDb = getTargetDatabaseName(connectionString);
  const maintenanceUrl = getMaintenanceDatabaseUrl(connectionString);
  const adminClient = createClient(maintenanceUrl);

  await adminClient.connect();
  try {
    const result = await adminClient.query(
      "select 1 from pg_database where datname = $1",
      [targetDb]
    );

    if (result.rowCount === 0) {
      await adminClient.query(`create database ${escapeIdentifier(targetDb)}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function withBackendDb(callback) {
  const connectionString = getDatabaseUrl();
  await ensureDatabaseExists(connectionString);

  const client = createClient(connectionString);
  await client.connect();
  try {
    return await callback(client, {
      connectionString,
      redactedConnectionString: redactDatabaseUrl(connectionString),
    });
  } finally {
    await client.end();
  }
}

async function ensureLocalSmokeSchema(client) {
  await client.query(`
    create table if not exists ${migrationsTable} (
      id text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists ${smokeTable} (
      key text primary key,
      value text not null,
      source text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
}

async function ensureLocalCatalogSchema(client) {
  await client.query(`
    create table if not exists ${catalogCategoriesTable} (
      id text primary key,
      handle text not null unique,
      name text not null,
      parent_id text null references ${catalogCategoriesTable}(id),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists ${catalogProductsTable} (
      id text primary key,
      handle text not null unique,
      title text not null,
      description text not null,
      category_id text not null references ${catalogCategoriesTable}(id),
      product_type text not null,
      color text null,
      material text null,
      size_length text null,
      mounting_method text null,
      price_amount integer not null check (price_amount >= 0),
      currency_code text not null default 'RUB',
      source text not null,
      has_optional_attribute_gap boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists ${catalogVariantsTable} (
      id text primary key,
      product_id text not null references ${catalogProductsTable}(id) on delete cascade,
      sku text not null unique,
      title text not null,
      color text null,
      material text null,
      size_length text null,
      mounting_method text null,
      price_amount integer not null check (price_amount >= 0),
      currency_code text not null default 'RUB',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
}

function printJson(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function formatError(error) {
  const hint =
    error &&
    (error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT")
      ? "\n\nLocal PostgreSQL hint: start the Windows PostgreSQL service or set DATABASE_URL in apps/backend/.env. Docker is not used for local development."
      : "";

  if (error instanceof Error) {
    const nested = Array.isArray(error.errors)
      ? `\nNested errors:\n${error.errors
          .map((nestedError) => formatError(nestedError))
          .join("\n")}`
      : "";
    return `${error.stack || error.message || error.name}${nested}${hint}`;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch (_jsonError) {
    return String(error);
  }
}

module.exports = {
  catalogCategoriesTable,
  catalogMigrationId,
  catalogProductsTable,
  catalogVariantsTable,
  createClient,
  ensureLocalCatalogSchema,
  ensureLocalSmokeSchema,
  formatError,
  getConnectionSummary,
  getDatabaseUrl,
  getMaintenanceDatabaseUrl,
  getTargetDatabaseName,
  migrationId,
  migrationsTable,
  printJson,
  redactDatabaseUrl,
  seedKey,
  smokeTable,
  withBackendDb,
};
