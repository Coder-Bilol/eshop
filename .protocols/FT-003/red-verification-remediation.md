---
description: FT-003 feature red-verification retry after source-runtime fixture remediation.
status: complete
---
# FT-003 Feature Red-Verification Retry

SEMANTIC_VERDICT: semantic-pass

## Basis

- The historical semantic concern was limited to non-reproducible source-runtime
  canonical fixture evidence.
- The canonical seed now links existing canonical products to the selected
  default sales channel, so source `medusa exec` and compiled browser runtime
  resolve the same canonical products.
- Fresh seed -> product-detail smoke -> backend acceptance ran in order without
  manual repair.

## Substance Assessment

- Browser persistence remains reference-only and backend/PostgreSQL-owned.
- Actual provider handoff adopts only the backend-selected merge target.
- Backend acceptance independently proves deterministic selection, exact
  same-variant summing, foreign ownership denial, stock no-mutation, source
  soft-delete, journal-first replay, in-progress response, and recovery.
- The seed repair adds missing product-to-sales-channel associations only; it
  does not alter merge route, workflow, journal, ownership, OAuth, checkout,
  order, inventory reservation, or payment behavior.

## Residual Operational Note

- `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID` remains public runtime configuration and
  must match the publishable key's selected channel in each deployment. The
  local template and E2E seed context document that requirement.

## Recommendation

- Feature semantic completion is eligible after this semantic-pass evidence.
- Feature lifecycle/requirements remain unchanged until an explicit closure/sync
  owner records that decision.
