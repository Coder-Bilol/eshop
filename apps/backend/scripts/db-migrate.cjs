const {
  ensureLocalSmokeSchema,
  formatError,
  migrationId,
  migrationsTable,
  printJson,
  smokeTable,
  withBackendDb,
} = require("./local-db.cjs");

async function main() {
  await withBackendDb(async (client, context) => {
    await ensureLocalSmokeSchema(client);
    await client.query(
      `
        insert into ${migrationsTable} (id, name)
        values ($1, $2)
        on conflict (id) do update
          set name = excluded.name,
              applied_at = now()
      `,
      [migrationId, "Create local backend DB smoke tables"]
    );
    printJson({
      command: "db:migrate",
      status: "ok",
      databaseUrl: context.redactedConnectionString,
      migrationId,
      tables: [migrationsTable, smokeTable],
    });
  });
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
