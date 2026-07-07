# TASK-017 PostgreSQL Persistence Evidence

Command:

```text
npm --workspace apps/backend run test:integration -- cart-merge-persistence
```

Result: PASS.

The integration runner launched two independent `medusa exec` processes against
the configured PostgreSQL database.

## Write Process

```json
{
  "status": "ok",
  "phase": "write",
  "sourceBoundary": "medusa-module-postgresql",
  "sourceCartId": "cart_task017_13808_1783145408850",
  "journalId": "cmerge_01KWNVZW63KJR3BSC9VFGD882J",
  "uniqueSourceConstraint": "rejected-duplicate"
}
```

## Fresh Read Process

```json
{
  "status": "ok",
  "phase": "read",
  "sourceBoundary": "medusa-module-postgresql",
  "sourceCartId": "cart_task017_13808_1783145408850",
  "journalId": "cmerge_01KWNVZW63KJR3BSC9VFGD882J",
  "persistedAcrossExecProcesses": true
}
```

The fresh process resolved the custom module and read the same journal ID. A
second journal for the same `source_cart_id` was rejected by the database-backed
unique constraint.
