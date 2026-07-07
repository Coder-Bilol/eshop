---
description: Feature-level adversarial semantic verification preflight for FT-003.
status: superseded
---
# FT-003 Red Verification

> Superseded on 2026-07-03 by the completed SDD and repaired TASK-017..TASK-026
> decomposition. This file remains historical pre-decomposition evidence; it is
> not the current feature readiness verdict.

SEMANTIC_VERDICT: semantic-concern

## Preflight Result

Feature-level semantic verification is not ready to run:

- FT-003 has `lifecycle: planned`;
- REQ-006, REQ-007, and REQ-008 remain `planned`;
- `.memory-bank/spec-index.md` has no FT-003 feature SDD spec;
- `.memory-bank/tasks/index.json` has no TASK records for FT-003;
- there is no implementation plan, required packet set, execution protocol,
  `/verify` verdict, runtime diff, or feature evidence to inspect.

This verdict records a readiness blocker, not a negative assessment of an
implemented solution.

## Hostile Risk Model For Future Verification

- Guest-cart persistence must keep only a non-authoritative cart
  reference/session token in the browser; backend/PostgreSQL owns cart state.
- Guest-to-customer merge must enforce ownership and must not allow one
  customer to claim another guest or customer cart.
- Identical Medusa Product Variant IDs must be summed exactly once; retries or
  repeated login callbacks must not duplicate quantities.
- Merge behavior must be atomic or compensatable so partial failure does not
  lose either cart.
- Quantity and stock must be revalidated after merge and again before order
  creation; stale browser availability is not authoritative.
- User-without-cart, empty guest cart, expired cart, unavailable variant, and
  quantity-over-stock paths need explicit behavior and evidence.
- FT-003 must not silently absorb OAuth provider implementation from FT-004 or
  inventory reservation from FT-007.

## False Success / Purpose Fit

No purpose-fit conclusion is possible. There is no implemented task set or
evidence surface against which to test guest cart creation/update, browser
session persistence, authenticated merge, or same-variant quantity summing.
Treating the current feature document as proof would be pure false success.

## Anti-goal And Scope Assessment

The planned boundary is coherent:

- FT-003 owns guest cart persistence, cart updates, and merge semantics.
- FT-004 owns OAuth/login-before-payment.
- FT-007 owns inventory reservation.
- Browser state must remain non-authoritative.

Implementation scope compliance cannot yet be assessed.

## Weak-context Questions

The feature-local SDD must resolve at least:

- which Medusa v2 cart/auth extension points perform ownership transfer/merge;
- merge idempotency key and retry semantics;
- atomicity/rollback behavior on partial merge failure;
- quantity policy when summed quantity exceeds current stock;
- guest cart reference protection, expiry, and session rotation;
- exact boundary between FT-003 merge trigger and FT-004 authentication.

## Cross-boundary, State, And Operational Assessment

- Cross-feature impact is high because FT-003 feeds FT-004 login and later
  checkout/order flows.
- Cart ownership lifecycle is globally defined as `guest-owned`,
  `customer-owned`, and `merged`, but exact transitions are intentionally left
  to feature-local design.
- Operational retry, concurrency, observability, and recovery behavior are
  currently unspecified.
- Maintenance cost cannot be evaluated before a concrete Medusa-native design
  and task slice exist.

## How This Could Still Be Wrong

A superficially working UI could persist full cart truth in browser storage,
replace rather than merge a customer cart, sum by SKU text instead of Medusa
variant identity, duplicate quantities on retry, or silently truncate stock.
These failures require backend integration and browser-session evidence, not
unit-only proof.

## Counterproposal / Escalation

Run `/prd-to-tasks FT-003` to create the feature-local SDD, implementation plan,
schema-backed TASK records, and required packets. Then run strict `/mb-doctor`,
execute and `/verify` the complete task set, and repeat
`/red-verify --feature FT-003`.

## Failure / Blocker

- Status: blocked
- Where: FT-003 feature/task-queue readiness
- Expected: complete feature SDD, indexed implemented task set, tier-required
  packets/protocols, `/verify PASS` evidence, and real implementation surface.
- Observed: planned feature only; none of those artifacts exists.
- Likely category: spec|task|packet|verification
- Recommended next action: `/prd-to-tasks FT-003`
- Requires replan: yes
