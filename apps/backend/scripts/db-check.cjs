const {
  createClient,
  formatError,
  getConnectionSummary,
  getDatabaseUrl,
  getMaintenanceDatabaseUrl,
  printJson,
} = require("./local-db.cjs");

async function main() {
  const databaseUrl = getDatabaseUrl();
  const summary = getConnectionSummary(databaseUrl);
  const maintenanceUrl = getMaintenanceDatabaseUrl(databaseUrl);
  const client = createClient(maintenanceUrl);

  await client.connect();
  try {
    const versionResult = await client.query("select version() as version");
    const databaseResult = await client.query(
      "select 1 from pg_database where datname = $1",
      [summary.database]
    );

    printJson({
      command: "db:check",
      status: "ok",
      databaseUrl: summary.redactedConnectionString,
      host: summary.host,
      port: summary.port,
      database: summary.database,
      maintenanceDatabase: summary.maintenanceDatabase,
      targetDatabaseExists: databaseResult.rowCount === 1,
      serverVersion: versionResult.rows[0].version,
      localRuntime: "windows-native-postgresql",
      dockerRequired: false,
    });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
