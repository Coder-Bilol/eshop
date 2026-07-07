---
description: TASK-020 functional verification.
status: complete
---
# TASK-020 Verification

VERDICT: PASS

## Mode And Ownership

- Mode: manual
- Tier: `T3`
- Verified at: `2026-07-07`
- Recommended status before closure sync: eligible for manual T3 closure after
  repeated per-task `/red-verify TASK-020` semantic-pass and exact human
  checkpoint marker.

## Packet And Spec Gates

- Required packet: `.memory-bank/packets/TASK-020.packet.json`
- Packet status: `ready`
- `source_task_hash` before verdict write: exact match
- Linked FT-003 SDD architecture, persistence, state, and recovery specs:
  present
- Linked architecture requires Medusa core cart workflows for immutable-plan
  application and allows direct Cart Module calls for source soft-delete/restore.
- Current implementation satisfies that boundary:
  `transferCartCustomerWorkflow` handles ownership transfer,
  `addToCartWorkflow` handles target line mutations, and
  `refreshCartItemsWorkflow` force-refreshes target pricing, tax, promotion,
  payment/cart totals.
- Direct Cart Module mutation in the runtime workflow is limited to
  `softDeleteCarts` and restore-first `restoreCarts`.
- Duplicate target same-variant lines are handled by aggregate target quantity
  validation plus planned anchor-line presence, matching TASK-019 planning and
  the linked SDD same-variant summing contract.

## Packet-Sourced Gates

| Command | Result |
|---|---|
| `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle` | PASS, includes `targetDuplicateVariantLinesMerged: true` |
| `npm --workspace apps/backend run typecheck` | PASS |
| `node scripts/mb-lint.mjs` | PASS, 106 files |
| `node scripts/mb-doctor.mjs --strict` | PASS, 0 errors, 2 warnings |

## Passing Functional Evidence

- Transfer mode assigns the authenticated customer and keeps the source cart
  active with its quantity unchanged.
- Existing-target mode updates an existing line and creates a previously absent
  variant line through Medusa core cart workflows before soft-deleting the
  source.
- Operation trace proves all target mutations precede `source_soft_deleted`,
  which precedes `journal_completed`.
- Injected failure after source soft-delete restores the source first, restores
  the previous target quantity, deletes the newly created target line, and
  records a failed journal.
- Retrying the same immutable failed plan increments `attempt_count`, completes,
  preserves exact quantities, and leaves the source unavailable.
- A combined quantity above real inventory returns failure before mutation;
  source and target remain active and unchanged, and the journal is failed
  rather than completed.
- Source hard-delete or line clearing is absent from runtime workflow code.
- Smoke assertions prove poisoned source pricing is not copied to the target.
- Final target pricing/totals match a reference cart created through standard
  Medusa workflows.
- Positive tax totals and promotion discounts are recalculated on the target.
- The previous core-workflow bypass bug is resolved:
  `.memory-bank/bugs/TASK-020-core-cart-workflow-bypass.md`.
- Duplicate target lines for the same Product Variant ID are accepted as an
  aggregate target quantity, survive compensation, and merge to the exact
  summed quantity. This functionally addresses
  `.memory-bank/bugs/TASK-020-duplicate-target-variant-lines.md`.

## Evidence

- `.tasks/TASK-020/execute-cart-merge-lifecycle.md`
- `.tasks/TASK-020/execute-typecheck.md`
- `.tasks/TASK-020/execute-cart-merge-regression.md`
- `.tasks/TASK-020/execute-mb-lint.md`
- `.tasks/TASK-020/execute-scope-audit.md`
- `.tasks/TASK-020/rollback-recovery.md`
- `.tasks/TASK-020/TASK-020-S-verify-final-report-code-01.md`
- `.tasks/TASK-020/TASK-020-S-verify-final-report-code-02.md`
- `.tasks/TASK-020/TASK-020-S-verify-final-report-code-03.md`

## T3 Closure State

HUMAN_CHECKPOINT: done

ROLLBACK_RECOVERY_NOTE: present

- Independent `/verify TASK-020`: PASS.
- Per-task `/red-verify TASK-020`: `SEMANTIC_VERDICT: semantic-pass`.
- Manual closure owner: `GENERAL`.
- Closure decision: explicit user instruction on 2026-07-07.

TASK-020 is eligible for `done` and was closed through manual `/mb-sync`.
