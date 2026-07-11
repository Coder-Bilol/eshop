---
description: Packet, spec, acceptance, and scope audit for TASK-025 /verify.
status: complete
---
# TASK-025 Verify Packet Spec Scope Audit

## Verification Basis

- Task record: `.memory-bank/tasks/TASK-025.task.json`
- Tier: T3
- Required packet: `.memory-bank/packets/TASK-025.packet.json`
- Packet status before verification: `ready`
- Packet hash before verification: matched current task record
- Packet hash after task-record verification evidence update: refreshed and
  matched updated task record
- Dependency: TASK-021 `done`
- Execution protocol: `.protocols/TASK-025/context.md`, `plan.md`,
  `progress.md`, `verification.md`, and `handoff.md` present
- Feature: `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- Implementation plan: `.memory-bank/tasks/plans/IMPL-FT-003.md`
- Linked SDD specs:
  - `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
  - `.memory-bank/architecture/cart-runtime.md`
  - `.memory-bank/contracts/cart-api-data-contract.md`
  - `.memory-bank/contracts/cart-access-security.md`
  - `.memory-bank/domains/cart-merge-data.md`
  - `.memory-bank/states/cart-ownership-merge.md`
  - `.memory-bank/testing/index.md`

## Spec Alignment

- FT-003 requires authenticated merge to sum by Medusa Product Variant ID,
  select the destination from authenticated customer context, soft-delete the
  source only after target mutations, and support journal-first replay.
- Cart API/data contract requires no client-supplied destination/customer ID,
  stable error semantics, consumed-source Store not-found behavior, and replay
  without duplicate quantity.
- Cart access/security requires foreign-owned source denial, no disclosure of
  another customer's cart data, no secrets in evidence, and synthetic local
  fixtures for integration proof.
- Cart merge data and state specs require immutable plans, absolute target
  quantities, source restore during compensation, and no hard-delete or line
  clearing of the source.
- Testing strategy requires integration evidence for cart persistence and merge,
  and forbids marking cart merge done without same-SKU/same-variant summing
  evidence.

## Code Audit

- `apps/backend/package.json` exposes `test:integration` and
  `smoke:cart-merge-acceptance` for the backend suite.
- `apps/backend/test/run-integration.cjs` registers `cart-merge-acceptance` and
  runs it through the Medusa CLI script boundary.
- `apps/backend/src/scripts/smoke-cart-merge-acceptance.ts` exercises the Store
  merge route, merge workflow, Cart Merge Module, Medusa Cart Module, synthetic
  customers/carts/variants, and PostgreSQL-backed runtime.
- The suite reports a `medusa-route-workflow-module-postgresql` source boundary
  and true assertions for transfer, deterministic target selection, exact
  summing, ownership denial, stock conflict no-mutation, replay, concurrency,
  consumed-source not-found, and injected restore.

## Acceptance Mapping

| Task verify item | Result |
|---|---|
| Real Medusa/PostgreSQL covers transfer, deterministic existing-target merge, and same-variant summing. | PASS |
| Authenticated evidence covers foreign ownership, incompatible carts, stock conflict, replay, and concurrency. | PASS |
| Existing-target success soft-deletes the source, ordinary Store CRUD returns not found, and journal-first replay returns the target. | PASS |
| Injected post-soft-delete failure restores source and target pre-merge state. | PASS |
| T3 closure includes `/verify PASS`, per-task semantic-pass, human checkpoint, and rollback/recovery evidence. | `/verify PASS` recorded; remaining T3 closure gates pending. |

## Scope And Anti-Goals

- Scope compliance: verified against `.protocols/TASK-025/handoff.md`, source
  reads, and the task allowed write scope.
- Forbidden scope touched by TASK-025 implementation: no evidence found.
- No production merge behavior, live OAuth providers or credentials, production
  data, storefront behavior, checkout, order, inventory reservation, payment, or
  browser UI coverage were added by TASK-025.
- Evidence contains synthetic local customers/carts/variants and no full session
  cookies, bearer tokens, secrets, customer email/contact data, or live
  production cart payloads.

## T3 Closure State

- Functional `/verify`: PASS.
- Per-task `/red-verify TASK-025`: pending.
- `HUMAN_CHECKPOINT: done`: pending.
- `ROLLBACK_RECOVERY_NOTE: present`: pending.
- Task closure must remain pending until these T3 gates are satisfied by the
  scheduler or an explicit closure owner.

## Doctor Notes

`node scripts/mb-doctor.mjs --strict` passed after this verification entry and
packet hash refresh with 0 errors, 1 warning, and 2 info messages. The TASK-025
readiness warning is not a functional failure.
