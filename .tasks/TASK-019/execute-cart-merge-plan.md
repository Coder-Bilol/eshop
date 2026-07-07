# TASK-019 Cart Merge Plan Integration Evidence

## Task Gate

Command:

```text
npm --workspace apps/backend run test:integration -- cart-merge-plan
```

Result: PASS.

Observed:

```json
{
  "suite": "cart-merge-plan",
  "status": "ok",
  "sourceBoundary": "medusa-cart-module-postgresql",
  "sourceCartId": "cart_01KWP2DFX73YXXEPPYT01FPR2M",
  "selectedTargetId": "cart_01KWP2DG1V2M5D4C5K0M87ACEY",
  "actorCandidateCount": 3,
  "assertions": {
    "deterministicTarget": true,
    "actorScoped": true,
    "compatibilityRejected": true,
    "aggregatedByVariantId": true,
    "immutableAbsolutePlan": true,
    "noMutation": true
  }
}
```

The suite uses the real Medusa container, Cart Module, and local PostgreSQL.
It snapshots every synthetic cart and line before and after planning and proves
that the planning slice does not mutate them.

Pure assertions additionally cover:

- equal-timestamp target tie-breaking by cart ID ascending;
- guest ownership transfer when no compatible target exists;
- region, currency, sales-channel, and completed-target rejection;
- foreign source and foreign destination rejection;
- completed-source rejection;
- missing Product Variant ID and unsafe aggregated quantity rejection;
- same-variant aggregation by Product Variant ID rather than SKU text.

## Regression

The combined command also ran TASK-017 persistence:

```text
npm --workspace apps/backend run test:integration -- cart-merge-persistence cart-merge-plan
```

The persistence write and fresh-read processes passed. The first combined run
then failed only in a newly added overflow test because that fixture used
ownership-transfer mode, which intentionally has an empty item plan. The fixture
was corrected to use merge mode; the exact TASK-019 gate above passed.
