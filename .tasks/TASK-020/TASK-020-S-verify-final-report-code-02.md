---
description: Independent verification report for TASK-020 after core-workflow remediation.
status: complete
---
# TASK-020 Verify Final Report 02

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
| `node scripts/mb-lint.mjs` | PASS, 105 files |
| `node scripts/mb-doctor.mjs --strict` | PASS, 0 errors, 2 warnings |

Note: the first lifecycle gate attempt was run concurrently with typecheck and
timed out. It was rerun alone and passed with exit code 0.

## Code Findings

- `merge-customer-cart.ts` imports and composes Medusa core cart workflows:
  `transferCartCustomerWorkflow`, `addToCartWorkflow`, and
  `refreshCartItemsWorkflow`.
- Target line mutation uses `addToCartWorkflow.runAsStep` with source
  quantities under the existing sorted source/target locks.
- Target state is force-refreshed through `refreshCartItemsWorkflow.runAsStep`.
- Direct Cart Module mutation in the runtime workflow is limited to source
  `softDeleteCarts` and restore-first `restoreCarts`.
- Search found no runtime `cartModule.updateCarts`,
  `cartModule.updateLineItems`, `cartModule.addLineItems`, source hard-delete,
  or source line clearing in `merge-customer-cart.ts`.

## Functional Evidence

The lifecycle integration asserts:

- no-target transfer keeps the source active and transfers ownership;
- existing-target merge applies exact final quantities;
- target mutation happens before source soft-delete and journal completion;
- post-soft-delete failure restores the source before target compensation;
- newly created target line is removed during compensation;
- failed immutable plan retry completes without double-counting;
- stock conflict leaves both carts active and unchanged;
- poisoned source pricing is not copied to the target;
- final target totals match a reference cart built through Medusa workflows;
- target tax totals and promotion discounts are recalculated.

## Previous Bug Disposition

`.memory-bank/bugs/TASK-020-core-cart-workflow-bypass.md` is resolved by the
remediation and this verification pass.

## Remaining T3 Closure Gates

HUMAN_CHECKPOINT: pending

ROLLBACK_RECOVERY_NOTE: present

- Per-task `/red-verify TASK-020`: pending.
- Do not mark TASK-020 `done` until semantic-pass and the exact human checkpoint
  marker are present under an explicit closure owner.
