const {
  ensureLocalSmokeSchema,
  formatError,
  printJson,
  seedKey,
  smokeTable,
  withBackendDb,
} = require("./local-db.cjs");

async function main() {
  await withBackendDb(async (client, context) => {
    await ensureLocalSmokeSchema(client);
    await client.query(
      `
        insert into ${smokeTable} (key, value, source)
        values ($1, $2, $3)
        on conflict (key) do update
          set value = excluded.value,
              source = excluded.source,
              updated_at = now()
      `,
      [
        seedKey,
        "local non-production seed for backend DB smoke verification",
        "TASK-002",
      ]
    );

    printJson({
      command: "db:seed",
      status: "ok",
      databaseUrl: context.redactedConnectionString,
      seedKey,
      table: smokeTable,
      catalogSeedCommand: "npm run seed:medusa:catalog --workspace @eshop/backend",
      productionData: false,
    });
  });
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
