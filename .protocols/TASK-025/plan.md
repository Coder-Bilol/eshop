---
description: TASK-025 execution plan.
status: active
---
# TASK-025 Plan

## Goal Interpretation
- Purpose: Provide independent server-side acceptance evidence for the complete data and security boundary.
- Success outcome: REQ-008 server behavior is reproducibly proven against real Medusa/PostgreSQL, including consumed-source and recovery semantics.
- Anti-goals: Do not change production merge behavior to make tests pass; do not use live providers or production data; do not add browser UI coverage.
- Allowed write scope: `apps/backend/package.json`, `apps/backend/src/scripts/smoke-cart-merge-acceptance.ts`, `apps/backend/test/run-integration.cjs`, `.memory-bank/changelog.md`.
- Forbidden scope: production merge behavior, live OAuth providers or credentials, production data, storefront behavior.
- Stop conditions: Tests cannot exercise real Medusa/PostgreSQL; ownership or replay cannot be proven independently of browser UI; failure injection cannot prove source and target restoration.

## Boundary Notes
- Linked boundary/contracts: FT-003 tech spec, cart runtime architecture, cart API/data contract, cart access/security contract, cart merge data spec, cart ownership/merge state spec, testing strategy.
- Responsibility boundary: Add an acceptance smoke suite over existing backend APIs/workflows/modules; do not modify route/workflow/module production behavior.
- Boundary drift risk: Acceptance code must not bypass Medusa/PostgreSQL with browser mocks, must not use live OAuth/production data, and must not invent new cart semantics outside existing TASK-017..TASK-021 behavior.

## Implementation Plan
1. Inspect existing cart-merge persistence, plan, lifecycle, and API smoke scripts.
2. Add `smoke-cart-merge-acceptance.ts` that composes real Medusa/PostgreSQL fixture setup and existing backend merge behavior.
3. Cover transfer, existing-target merge, same-variant summing, foreign ownership, incompatible carts, stock conflict, replay, concurrency/in-progress, consumed-source Store not-found, and injected post-soft-delete recovery.
4. Register `cart-merge-acceptance` in `test/run-integration.cjs` and add a package script if consistent with existing suite scripts.
5. Record focused gate evidence under `.tasks/TASK-025/`.

## Intended Local Gates
- `npm --workspace apps/backend run test:integration -- cart-merge-acceptance`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff
- `/execute` will not close the task, run `/verify`, run `/red-verify`, run `/mb-sync`, or promote dependents.
- Scheduler or explicit standalone owner must run `/verify TASK-025`, per-task `/red-verify TASK-025`, record T3 human/recovery markers, and sync/close if appropriate.
