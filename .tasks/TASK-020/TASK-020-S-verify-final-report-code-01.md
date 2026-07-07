---
task: TASK-020
stage: verify
artifact: final-report
kind: code
status: complete
---
# TASK-020 Verify Final Report

VERDICT: FAIL

## Passing Evidence

- Required packet status/hash: PASS.
- Real Medusa/PostgreSQL lifecycle integration: PASS.
- Transfer, target mutation ordering, source soft-delete, journal completion,
  restore-first compensation, guarded retry, and stock conflict: PASS.
- Backend typecheck: PASS.
- Memory Bank lint and strict doctor: PASS.
- Rollback/recovery note: present.

## Blocking Finding

The runtime applies ownership and target-line changes through direct Cart Module
mutations and copies source price snapshots. Linked SDD and TASK-020 require
Medusa core cart workflows for these changes. Existing tests do not prove target
pricing, totals, tax, promotion refresh, or workflow hooks remain correct.

Bug: `.memory-bank/bugs/TASK-020-core-cart-workflow-bypass.md`.

## Lifecycle

Recommended task status: `failed`. The authoritative status remains `planned`
because `/verify` does not own the manual failure transition.

T3 closure is prohibited until implementation repair, repeated functional PASS,
per-task semantic-pass, `HUMAN_CHECKPOINT: done`, and explicit closure ownership.
