---
description: TASK-017 and TASK-019 regression evidence for TASK-020.
status: complete
---
# TASK-020 Cart Merge Regression Evidence

- Command:
  `npm --workspace apps/backend run test:integration -- cart-merge-persistence cart-merge-plan`
- Result: PASS

Covered regressions:

- TASK-017 journal survives independent Medusa exec processes and rejects a
  duplicate active source;
- TASK-019 still selects the deterministic actor-scoped target, aggregates by
  Product Variant ID, produces immutable absolute quantities, and performs no
  mutations.
