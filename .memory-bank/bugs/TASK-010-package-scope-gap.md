---
description: Resolved verification blocker for TASK-010 package script scope gap.
status: archived
owner: verify
last_updated: 2026-06-25
source_of_truth:
  - .memory-bank/tasks/TASK-010.task.json
  - .memory-bank/packets/TASK-010.packet.json
  - .protocols/TASK-010/handoff.md
  - .tasks/TASK-010/verify-smoke-product-detail.txt
  - .tasks/TASK-010/verify-mb-doctor-strict-final.txt
---
# TASK-010 Package Scope Gap

## Summary

`/verify TASK-010` functionally passed the required seed and product-detail smoke gates, but cannot close with `VERDICT: PASS` because the implementation changed `apps/backend/package.json` to expose the required `smoke:product-detail` npm script while TASK-010 `runtime_context.allowed_write_scope` and the execution packet omit `apps/backend/package.json`.

After the verification verdict was recorded in the task record, strict `mb-doctor` also reports the TASK-010 packet as stale because its `source_task_hash` no longer matches the task record.

## Impact

Resolved. TASK-010 scope now includes `apps/backend/package.json`, the packet was refreshed, and `/verify TASK-010` passed after rerun.

## Evidence

- `.tasks/TASK-010/verify-db-seed.txt`: `db:seed` passed with 5 products, 8 variants, and `productionData:false`.
- `.tasks/TASK-010/verify-smoke-product-detail.txt`: `smoke:product-detail` passed and proved multi-option variants, unavailable variant, default SKU product, option dimensions, SKU, price, and availability through backend/PostgreSQL.
- `.tasks/TASK-010/verify-mb-lint.txt`: Memory Bank lint passed.
- `.tasks/TASK-010/verify-mb-doctor-strict.txt`: strict doctor passed before the verification verdict was written.
- `.tasks/TASK-010/verify-mb-doctor-strict-final.txt`: strict doctor failed after verdict write because TASK-010 packet `source_task_hash` is stale.

## Required Resolution

Choose one before closure:

- Update TASK-010 task record and packet scope to include `apps/backend/package.json`, because the task's required npm gate needs a package script.
- Or remove the package script change and revise the verification path so TASK-010 can run within the original allowed scope.

Then refresh the TASK-010 packet and rerun verification. Do not mark TASK-010 `done` until this scope gap is reconciled and packet freshness is restored.

## Resolution

Completed on 2026-06-25.

- Updated `.memory-bank/tasks/TASK-010.task.json` to include `apps/backend/package.json` in `touched_files` and `runtime_context.allowed_write_scope`.
- Updated `.memory-bank/packets/TASK-010.packet.json` to include `apps/backend/package.json` in packet scope.
- Refreshed the packet source task hash before reverify.
- Reran `db:seed`, `smoke:product-detail`, and `mb-lint`; all passed.
- Recorded final PASS evidence in `.tasks/TASK-010/TASK-010-S-verify-final-report-code-02.md`.
