COMMAND: npm --workspace apps/backend run test:integration -- cart-merge-acceptance
EXIT_CODE: 0


> @eshop/backend@0.1.0 test:integration
> node test/run-integration.cjs cart-merge-acceptance

[32minfo[39m:    redisUrl not found. A fake redis instance will be used.
[32minfo[39m:    Executing script at ./src/scripts/smoke-cart-merge-acceptance.ts...
[32minfo[39m:    redisUrl not found. A fake redis instance will be used.
[32minfo[39m:    No link to load from D:\projects\eshop\apps\backend\src\links. skipped.
[32minfo[39m:    No link to load from D:\projects\eshop\node_modules\@medusajs\draft-order\.medusa\server\src\links. skipped.
[33mwarn[39m:    Local Event Bus installed. This is not recommended for production.
[32minfo[39m:    Locking module: Using "in-memory" as default.
[32minfo[39m:    No workflow to load from D:\projects\eshop\node_modules\@medusajs\draft-order\.medusa\server\src\workflows. skipped.
[32minfo[39m:    No subscriber to load from D:\projects\eshop\node_modules\@medusajs\draft-order\.medusa\server\src\subscribers. skipped.
[32minfo[39m:    No subscriber to load from D:\projects\eshop\apps\backend\src\subscribers. skipped.
{
  "suite": "cart-merge-acceptance",
  "status": "ok",
  "sourceBoundary": "medusa-route-workflow-module-postgresql",
  "assertions": {
    "transferWithOnlyIncompatibleTarget": true,
    "deterministicExistingTarget": true,
    "sameVariantSummed": true,
    "foreignOwnershipDenied": true,
    "stockConflictNoMutation": true,
    "replayReturnedTarget": true,
    "replayNoDuplicateQuantity": true,
    "replayDeniedForOtherCustomer": true,
    "pendingJournalConcurrencyResponse": true,
    "consumedSourceNotFound": true,
    "injectedFailureRestoredSource": true,
    "injectedFailureRestoredTarget": true
  }
}
[32minfo[39m:    Finished executing script.
{
  "command": "test:integration",
  "status": "ok",
  "sourceBoundary": "medusa-module-postgresql",
  "suites": [
    "cart-merge-acceptance"
  ]
}
