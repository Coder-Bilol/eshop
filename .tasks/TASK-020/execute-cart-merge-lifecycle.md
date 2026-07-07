---
description: Real Medusa and PostgreSQL lifecycle integration evidence for TASK-020.
status: complete
---
# TASK-020 Cart Merge Lifecycle Evidence

- Command:
  `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle`
- Result: PASS
- Boundary: Medusa workflow + Cart Module + Cart Merge Module + PostgreSQL
- Fixtures: synthetic local customers/carts and two seeded sellable variants

Final assertions:

```json
{
  "transferKeepsSourceActive": true,
  "transferRefreshesCustomerPricing": true,
  "targetBeforeSourceDisposition": true,
  "sourceSoftDeletedBeforeJournalCompletion": true,
  "restoreBeforeReverseCompensation": true,
  "newTargetLineCreatedAndCompensated": true,
  "targetPricingIgnoresSourceSnapshot": true,
  "targetDuplicateVariantLinesMerged": true,
  "targetTotalsMatchCoreWorkflow": true,
  "targetTaxesRecalculated": true,
  "targetPromotionsRecalculated": true,
  "stockFailureLeavesBothUsable": true,
  "failedJournalRetryCompletes": true
}
```

The test verifies:

- transfer mode keeps the source active and re-prices through the core
  ownership-transfer refresh;
- an existing target receives exact final quantities through the core
  add-to-cart workflow and an explicit absolute postcondition;
- deliberately poisoned source pricing is not copied to the target;
- final target pricing, totals, positive tax totals, and positive promotion
  discounts match a reference cart built by the standard Medusa workflows;
- duplicate target lines for the same Product Variant ID are accepted as an
  aggregate target quantity, survive compensation, and merge to the exact
  summed quantity;
- target mutations occur before source soft-delete and journal completion;
- injected post-soft-delete failure restores source before reversing the target;
- nested core-workflow compensation restores the existing quantity and removes
  the newly created target line;
- failed immutable plan retry completes on the second attempt;
- real inventory conflict leaves both carts unchanged and usable.
