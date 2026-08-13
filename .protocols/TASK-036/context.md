---
description: Execution context for TASK-036 opaque product IDs.
status: complete
---
# TASK-036 Context

## Routing

- Role: GENERAL implementer
- Mode: manual `/execute`; implementation handoff only
- Tier: T2
- Task record: `.memory-bank/tasks/TASK-036.task.json`
- Feature: FT-005
- Dependencies: TASK-014 and TASK-016 (`done`)

## Authoritative Inputs

- `.memory-bank/packets/TASK-036.packet.json` (`PACKET-TASK-036-R2`, `ready`)
- `.memory-bank/tech-specs/FT-005-authenticated-wishlist.md`
- `.memory-bank/contracts/wishlist-api-security.md`
- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/tasks/plans/IMPL-FT-005.md`

## Baseline

- Canonical Medusa product query results already contain opaque product IDs.
- Catalog/detail response projections currently omit product ID while retaining
  handle navigation and variant IDs.
- Existing TASK-034/TASK-035 and FT-005 worktree changes are preserved.

## Scope Decision

- The required `wishlist-product-id` integration command needs registration in the
  shared `apps/backend/test/run-integration.cjs` dispatcher.
- The operator explicitly approved adding that file to TASK-036 touched/allowed scope;
  task and packet were refreshed before implementation.
