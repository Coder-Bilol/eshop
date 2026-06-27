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

    const seedResult = await client.query(
      `select key, value from ${smokeTable} where key = $1`,
      [seedKey]
    );
    if (seedResult.rowCount !== 1) {
      throw new Error(
        "Local seed row is missing. Run npm --workspace apps/backend run db:seed first."
      );
    }

    const smokeKey = `smoke:${Date.now()}:${process.pid}`;
    const smokeValue = `backend-persistence-${new Date().toISOString()}`;

    await client.query(
      `
        insert into ${smokeTable} (key, value, source)
        values ($1, $2, $3)
      `,
      [smokeKey, smokeValue, "TASK-002-smoke"]
    );

    const readResult = await client.query(
      `select key, value, source from ${smokeTable} where key = $1`,
      [smokeKey]
    );

    const row = readResult.rows[0];
    if (!row || row.value !== smokeValue || row.source !== "TASK-002-smoke") {
      throw new Error("Backend DB smoke write/read verification failed.");
    }

    printJson({
      command: "smoke:db",
      status: "ok",
      databaseUrl: context.redactedConnectionString,
      seedVerified: seedResult.rows[0].key === seedKey,
      writeReadVerified: true,
      smokeKey,
      table: smokeTable,
    });
  });
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
