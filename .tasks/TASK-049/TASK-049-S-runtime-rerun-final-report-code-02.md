---
description: Scheduler runtime rerun evidence for TASK-049 after orphaned build cleanup.
status: complete
---
# TASK-049 Runtime Rerun Evidence

This report records the two required commands executed by the scheduler after
the stale orphaned `apps/backend` build process was stopped. The commands ran
in a clean local runtime and completed with exit code 0.

## Backend acceptance

Command:

`npm --workspace apps/backend run test:integration -- checkout-delivery-acceptance`

Result: PASS, exit code 0.

Observed evidence:

- real compiled Medusa HTTP/session/workflow/Admin Shipping Options/PostgreSQL boundary;
- guest `401`, bearer `200`, session `200`, client-selected identity rejected;
- stable delivery IDs `pickup`, `city_courier`, `transport_company`;
- tariffs `0`, `500`, `700` RUB and payment IDs `card`, `sbp`, `sberpay`;
- normalization-before-limit, required/conditional fields, sanitized errors;
- unavailable response `422 delivery_method_unavailable`, `substituted: false`;
- orders, payment collections, and reservation items unchanged `0 -> 0`;
- `providerRequest`, `orderMutation`, `inventoryMutation`, and
  `paymentMutation` all `false`;
- parser: standard Medusa parser; malformed JSON normalization deferred;
- production data `false`, unconditional cleanup.

## Browser acceptance

Command:

`npm --workspace apps/storefront run test:e2e -- checkout-delivery`

Result: PASS, exit code 0 with the runtime timeout increased to 420 seconds to
include the known local Medusa/Next build and cleanup duration.

Fresh runtime progress completed:

- compiled Medusa build and health;
- canonical catalog seed;
- synthetic Admin Shipping Options;
- Next storefront and browser launch;
- authenticated checkout through the local Google provider double and real
  Medusa session;
- authenticated-ready checkout, field/payment/delivery assertions and live
  unavailable recovery;
- browser/storefront/backend/fixture cleanup and released ports.

Fresh browser report fields:

- `status: ok`;
- `backendRuntime: compiled-medusa-start`;
- `dataSource: canonical-medusa-postgresql`;
- `authenticatedReadyGate: true`, `realMedusaSession: true`;
- delivery IDs `pickup`, `city_courier`, `transport_company`;
- tariffs `0`, `500`, `700` RUB;
- payment IDs `card`, `sbp`, `sberpay`;
- `unavailableRecovery: 422 delivery_method_unavailable then explicit pickup selection`;
- `noSilentSubstitution: true`;
- `noOrderOrProviderRequests: true`;
- sanitized report/screenshot, no trace or cookies;
- `processCleanup: ports-released`, `productionData: false`.

Artifacts:

- `.tasks/TASK-049/playwright/checkout-browser-report.json`
- `.tasks/TASK-049/playwright/checkout-delivery.png`
- `.tasks/TASK-049/playwright/real-runtime.log`

The later verifier-owned browser rerun was stopped after it remained in the
browser verification phase without progress. Its process tree was separate
from the completed PASS run; no implementation or task lifecycle files were
 changed.
