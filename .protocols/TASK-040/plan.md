---
description: Implementation plan for TASK-040 wishlist controls and page.
status: active
---
# TASK-040 Plan

## Task Record

- Tier: `T2`
- Authoritative task: `.memory-bank/tasks/TASK-040.task.json`
- Packet: `.memory-bank/packets/TASK-040.packet.json`
- Mode: scheduler; `/execute` implementation handoff only.

## Planned Changes

1. Add an accessible client `WishlistToggle` using `productId` for mutations,
   `handle` only for navigation context, safe FT-004 login routing for guests, and
   deterministic idle/pending/saved/error labels.
2. Add a client `WishlistView` and `/wishlist` route that consumes provider state,
   handles auth/loading/empty/products/error/remove/session-expired states, and
   renders only the exact product projection with current-handle links.
3. Mount controls on existing catalog cards and product detail without changing
   catalog/detail data or variant/cart behavior. Add only focused wishlist styling
   and navigation affordances.
4. Add focused source/render/state assertions to `wishlist-ui.test.cjs`, register
   the suite, and update the append-only changelog entry.

## Goal Interpretation

- Purpose: buyer-facing wishlist discovery, add/remove, and view flow.
- Success outcome: guest route has no pending favorite; authenticated controls work
  independently of checkout merge; page and controls adopt state-provider truth.
- Anti-goals: backend/auth changes, new state machines, persistence, variants,
  sharing, redesign, recommendations, or unrelated cleanup.
- Allowed write scope: task `touched_files`, protocol files, and TASK-040 evidence.
- Forbidden scope: all task `forbidden_scope`, task JSON/packet, and scheduler state.
- Stop conditions: any required contract must be guessed or a wider boundary is
  needed.

## Boundary Notes

- Authenticated capability is `authState.status === "session_established"` with a
  customer. No `useCart`/`merge_blocked` dependency is introduced.
- `WishlistStateController` owns duplicate-pending suppression, backend response
  truth, 401 clearing, and in-memory-only state. UI only invokes `add`, `remove`,
  and `load`.
- Return path is generated from `window.location.pathname + search`, normalized by
  existing `writeReturnPath`, and navigation is always the fixed `/login` route.

## Local Gates

- `npm --workspace apps/storefront run test -- wishlist-ui`
- `npm --workspace apps/storefront run typecheck`
- `npm --workspace apps/storefront run build`
- `npm --workspace apps/storefront run test` (relevant storefront regression)
- `node scripts/mb-lint.mjs`
- `git diff --check -- <scoped files>`

`/verify`, `/red-verify`, `/mb-sync`, lifecycle changes, and closure remain owned by
the scheduler/next owner and are not part of this implementation run.
