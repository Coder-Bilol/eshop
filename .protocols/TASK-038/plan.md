---
description: Implementation plan for TASK-038 authenticated wishlist Store API.
status: complete
---
# TASK-038 Plan

## Scope

1. Add shared wishlist request validation and sanitized public error mapping.
2. Add authenticated `GET /store/wishlist`, `POST /store/wishlist/items`, and `DELETE /store/wishlist/items/:product_id` handlers.
3. Register the three route families with standard customer authentication middleware.
4. Add a local Medusa integration smoke covering middleware, actor ownership, exact response shape, idempotency, guest denial, and non-disclosing failures.
5. Register the `wishlist-api` integration suite and record the implementation in the changelog.

## Intended Gates

- `npm --workspace apps/backend run test:integration -- wishlist-api`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## Non-Goals

- No changes to wishlist service/workflows/module, auth providers, session creation, storefront, or product/customer core data.

## Handoff

- `/verify` and `/red-verify` remain required for this T3 task.
- Closure owner must record `HUMAN_CHECKPOINT: done` and `ROLLBACK_RECOVERY_NOTE: present` only after independent verification and recovery review.
