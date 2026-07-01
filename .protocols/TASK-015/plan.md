---
description: TASK-015 implementation plan.
status: active
---
# TASK-015 Plan

1. Add an idempotent Medusa exec seed for local store defaults, categories,
   products, options, variants, prices, inventory, sales channel, and
   publishable key.
2. Replace direct PostgreSQL catalog/product-detail reads with Medusa Query
   adapters and pure response/filter mapping.
3. Update Store routes to pass request scope and publishable-key sales-channel
   context.
4. Adapt integration tests to canonical Medusa graph fixtures and stable
   Medusa variant IDs.
5. Run packet gates and record evidence under `.tasks/TASK-015/`.

## Intended Gates

- `npm --workspace apps/backend run seed:medusa:catalog`
- `npm --workspace apps/backend run test:integration -- catalog product-detail`
- `npm --workspace apps/backend run typecheck`
- `npm --workspace apps/backend run build`
- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`

## Handoff

`/execute` does not close the task. `/verify TASK-015` must re-run the canonical
seed, integration, build, packet/spec, and boundary checks.
