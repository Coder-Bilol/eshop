---
description: FT-003 feature-level red-verification retry after canonical fixture remediation.
status: complete
---
# FT-003 Feature Red Verification Retry

SEMANTIC_VERDICT: semantic-pass

## Result

The historical `semantic-concern` is resolved. Fresh source-runtime backend
acceptance is reproducible after canonical seed, and it agrees with the real
browser acceptance surface.

## Root Cause And Resolution

- Cause: canonical products already present in PostgreSQL remained linked only
  to a previous sales channel. The idempotent seed created/selected `Default
  Sales Channel` but did not associate those existing products with it.
- Resolution: `seed-catalog.ts` now idempotently calls the supported
  `linkProductsToSalesChannelWorkflow` for existing canonical products missing
  the selected default sales channel.
- The repair does not replace Medusa Core, mock the acceptance boundary, or
  weaken merge behavior.

## Fresh Evidence

- Source seed -> product-detail smoke -> cart-merge acceptance: PASS.
- Backend acceptance: PASS over Medusa route/workflow/module/PostgreSQL.
- Real browser cart E2E: PASS through actual provider handoff, persistence,
  backend-selected target adoption, consumed-source 404, and replay.
- Windows-native local smoke, workspace typecheck, Memory Bank lint, and strict
  doctor: PASS.

## Semantic Assessment

- No false-success route remains: browser handoff and independent backend
  acceptance both execute their required boundaries.
- Browser storage remains reference-only; backend owns cart, ownership, merge
  planning, journal, and recovery truth.
- No live OAuth, production data, checkout, order, inventory reservation,
  payment, queue, or Medusa Core scope was introduced.

## Residual Note

- Deployment configuration must keep public
  `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID` aligned with its publishable API key.
  This is configured in the storefront env template and injected from the local
  canonical seed for E2E.

## Recommendation

- FT-003 is semantically eligible for feature completion.
- This retry does not independently change feature lifecycle, requirement
  lifecycle, or task statuses; that remains the explicit closure/sync owner's
  responsibility.
