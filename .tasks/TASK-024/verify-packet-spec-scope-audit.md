---
description: Packet, spec, acceptance, and scope audit for TASK-024 /verify.
status: complete
---
# TASK-024 Verify Packet Spec Scope Audit

## Verification Basis

- Task record: `.memory-bank/tasks/TASK-024.task.json`
- Tier: T3
- Required packet: `.memory-bank/packets/TASK-024.packet.json`
- Packet status before verification: `ready`
- Packet hash before verification: matched current task record
- Packet hash after task-record verification evidence update: refreshed and
  matched updated task record
- Dependencies: TASK-021 `done`; TASK-022 `done`
- Execution protocol: `.protocols/TASK-024/context.md`, `plan.md`,
  `progress.md`, `verification.md`, and `handoff.md` present
- Feature: `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- Implementation plan: `.memory-bank/tasks/plans/IMPL-FT-003.md`
- Linked SDD specs:
  - `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
  - `.memory-bank/contracts/cart-api-data-contract.md`
  - `.memory-bank/contracts/cart-access-security.md`
  - `.memory-bank/states/cart-ownership-merge.md`

## Spec Alignment

- Cart API/data contract requires authenticated merge requests to send
  `credentials: include`, an empty body, and no destination/customer IDs.
- Cart access/security requires browser cart ID to remain an opaque reference,
  auth tokens not to enter cart storage/evidence, and replay to rely on the
  authenticated backend journal.
- Cart ownership/merge state requires completed replay not to re-enter mutation
  steps and ordinary Store CRUD not to revive a consumed source.
- FT-003 UX contract requires successful authenticated merge to switch the
  stored reference atomically to the returned target before rendering the merged
  result, while conflicts keep the source reference recoverable.

## Code Audit

- `apps/storefront/lib/cart-merge.ts` creates a narrow merge client for
  `POST /store/carts/{source_cart_id}/merge`, sends `credentials: "include"`,
  sends `{}` as the body, validates `source_cart_id`, `target_cart_id`,
  `outcome`, `replayed`, and `cart.id`, and writes only the validated target
  cart reference after success.
- `apps/storefront/components/cart-provider.tsx` exposes
  `mergeAfterAuthentication()` as a provider-agnostic handoff and restores the
  cart state after backend merge success.
- `apps/storefront/src/cart-merge.test.cjs` covers request shape, no client
  destination/customer choice, successful target adoption, replay target
  adoption, failure source preservation, consumed-source ordinary CRUD stale
  clearing, authenticated replay adoption, no-source no-op, and no OAuth
  provider logic in the provider.
- `apps/storefront/src/test-runner.cjs` registers the `cart-merge` suite.

## Acceptance Mapping

| Task verify item | Result |
|---|---|
| Post-auth handoff sends authenticated credentials and no destination/customer ID. | PASS |
| Successful merged/transferred/already_merged responses atomically switch to the backend-selected target before render. | PASS |
| Conflict, forbidden, in-progress, stale, and server failures retain a recoverable source reference. | PASS |
| A stale consumed-source tab clears ordinary CRUD state and can adopt the target only through authenticated replay. | PASS |
| T3 closure includes /verify PASS, per-task semantic-pass, human checkpoint, and rollback/recovery evidence. | `/verify PASS` recorded; remaining T3 closure gates pending. |

## Scope And Anti-Goals

- Scope compliance: verified against `.protocols/TASK-024/handoff.md`, source
  reads, and the task allowed write scope.
- Forbidden scope touched by TASK-024 implementation: no evidence found.
- No Google OAuth, VK ID, login UI, callback routes, checkout, order, inventory
  reservation, payment, backend merge semantics, or production mutation were
  added by TASK-024.
- No auth tokens, customer identity, item payloads, quantities, or totals are
  written to the browser cart reference by TASK-024.

## T3 Closure State

- Functional `/verify`: PASS.
- Per-task `/red-verify TASK-024`: pending.
- `HUMAN_CHECKPOINT: done`: pending.
- `ROLLBACK_RECOVERY_NOTE: present`: pending.
- Task closure must remain pending until these T3 gates are satisfied by the
  scheduler or an explicit closure owner.

## Doctor Notes

`node scripts/mb-doctor.mjs --strict` passed with no errors. It reported
readiness warnings for TASK-024 and TASK-025; these are not functional failures.
