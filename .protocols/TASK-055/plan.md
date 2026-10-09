# TASK-055 Plan

## Goal Interpretation

- Purpose: implement shared-lock native Admin lifecycle projection and payment handoff.
- Success outcome: guarded native operations, durable metadata projection, one unpaid system payment collection per pending order, expiry ordering/preservation, and reproducible local evidence.
- Anti-goals: FT-009 provider behavior, FT-010 email, custom lifecycle API, direct inventory/stock writes, Medusa Core changes, production data/secrets.
- Allowed write scope: task record `runtime_context.allowed_write_scope` only.
- Forbidden scope: task record `runtime_context.forbidden_scope` only.
- Stop conditions: task record stop conditions, especially unsupported route wrapping or an unenforceable protected metadata boundary.

## Implementation sequence

1. Add the canonical lock helper and configure/use the installed Locking module without changing Medusa Core.
2. Add the guarded lifecycle workflow and native-event subscriber, using TASK-054's pure projector and authoritative native re-read.
3. Add project middleware for the installed Admin mutation routes and the protected generic order metadata update boundary.
4. Add the native system payment collection to pending-order creation while preserving legacy payment labels.
5. Change FT-007 expiry to the shared lock and write origin/reason/pending cleanup before native cancellation; preserve/retry by markers.
6. Extend smoke/integration coverage and changelog within scope.
7. Run packet gates and record evidence/handoff; leave task status unchanged.

## Boundary Notes

- Linked contracts: `.memory-bank/contracts/order-lifecycle-admin-api.md`, `.memory-bank/contracts/boundary-map.md`.
- Responsibility boundary: native Medusa owns auth and native mutation; FT-008 owns guarded projection; FT-007 owns expiry cleanup.
- Boundary drift risk: route matching must cover exactly installed built-ins; payment/refund totals must come from native records; no caller data may become event proof.

## MB-SYNC handoff

The next owner must run `/verify TASK-055`, `/red-verify TASK-055` (T3), and then make the closure decision and run `/mb-sync` according to tier policy. Feature completion additionally requires `/red-verify --feature FT-008` after all feature tasks.
