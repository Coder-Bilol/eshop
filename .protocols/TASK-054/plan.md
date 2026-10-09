---
task: TASK-054
tier: T2
status: in_progress
---
# TASK-054 Plan

1. Add shared lifecycle state/event/native-evidence types.
2. Add runtime event allow-list, exact server-owned event parsing, transition matrix, and FT-007 expiry compatibility guard.
3. Add deterministic projection for payment, fulfillment, completion, cancellation, and refund notifications.
4. Add cumulative full-refund calculation from persisted/raw amounts with native currency precision; do not infer a capture/refund status field.
5. Add pure smoke coverage and integration-runner/package wiring.
6. Run task gates and leave evidence for `/verify` / scheduler.

## Packet verification commands

- `npm --workspace apps/backend run test:integration -- order-lifecycle-state`
- `npm --workspace apps/backend run typecheck`
- `npm run build`
- `node scripts/mb-lint.mjs`

The packet is treated as derivative context; no packet repair or status transition is performed by `/execute`.

