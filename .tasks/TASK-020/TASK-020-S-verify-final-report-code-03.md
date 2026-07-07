---
description: Independent verification report for TASK-020 after duplicate target-line remediation.
status: complete
---
# TASK-020 Verify Final Report 03

VERDICT: PASS

## Scope

- Task: `TASK-020`
- Tier: `T3`
- Mode: manual `/verify`
- Verified at: `2026-07-07`
- Status change: none; `/verify` does not close this T3 task.

## Normative Basis

- `.memory-bank/tasks/TASK-020.task.json`
- `.memory-bank/packets/TASK-020.packet.json`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/workflows/tier-policy.md`

## Commands

| Command | Result |
|---|---|
| `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle` | PASS |
| `npm --workspace apps/backend run typecheck` | PASS |
| `node scripts/mb-lint.mjs` | PASS, 106 files |
| `node scripts/mb-doctor.mjs --strict` | PASS, 0 errors, 2 warnings |

## Code Findings

- `merge-customer-cart.ts` validates source and target state by aggregate
  Product Variant ID quantities.
- Duplicate target lines are no longer rejected solely because more than one
  line exists for the planned variant.
- The planned target anchor line must still be present, preserving immutable
  plan identity.
- Target mutation still uses Medusa `addToCartWorkflow` plus forced
  `refreshCartItemsWorkflow`.
- Direct Cart Module mutation remains limited to source `softDeleteCarts` and
  restore-first `restoreCarts`.
- No Store merge route, OAuth, checkout, order, reservation, payment, source
  hard-delete, source line clearing, Medusa Core modification, or production
  data path was introduced.

## Functional Evidence

The lifecycle integration asserts:

- no-target transfer keeps the source active and transfers ownership;
- existing-target merge applies exact final quantities;
- duplicate target lines for the same Product Variant ID are accepted as an
  aggregate quantity;
- duplicate target-line state compensates back to the pre-merge aggregate;
- final merged duplicate-line target reaches the exact summed quantity;
- poisoned source pricing is not copied to the target;
- final target totals match a reference cart built through Medusa workflows;
- target tax totals and promotion discounts are recalculated;
- target mutation happens before source soft-delete and journal completion;
- post-soft-delete failure restores the source before target compensation;
- stock conflict leaves both carts active and unchanged.

## Bug Disposition

`.memory-bank/bugs/TASK-020-duplicate-target-variant-lines.md` is functionally
addressed by this verification pass, but remains active until repeated
per-task `/red-verify TASK-020` returns `SEMANTIC_VERDICT: semantic-pass`.

## Remaining T3 Closure Gates

HUMAN_CHECKPOINT: pending

ROLLBACK_RECOVERY_NOTE: present

- Per-task `/red-verify TASK-020`: previous result is semantic-fail; repeat is
  required after this repair.
- Do not mark TASK-020 `done` until semantic-pass and the exact human checkpoint
  marker are present under an explicit closure owner.
