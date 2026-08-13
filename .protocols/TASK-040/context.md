---
description: Execution context for TASK-040 wishlist controls and page.
status: active
---
# TASK-040 Context

## Authoritative Inputs

- Task: `.memory-bank/tasks/TASK-040.task.json` (`T2`, `in_progress`).
- Packet: `.memory-bank/packets/TASK-040.packet.json` (`ready`; derivative context only).
- Feature/storefront contract: `.memory-bank/tech-specs/FT-005-authenticated-wishlist.md`.
- API/security contract: `.memory-bank/contracts/wishlist-api-security.md`.
- Catalog/detail contracts: `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
  and `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`.
- Implementation plan: `.memory-bank/tasks/plans/IMPL-FT-005.md`.
- Global routing: `.memory-bank/spec-backbone.md`, `.memory-bank/spec-index.md`,
  `.memory-bank/workflows/tier-policy.md`.

## Goal Interpretation

- Purpose: expose product-level wishlist controls on existing catalog/detail
  surfaces and a focused authenticated `/wishlist` page.
- Success outcome: guests are routed to login with only a safe current return path;
  a valid customer can add/remove product IDs with truthful idle/pending/saved/error
  UI even while checkout is `merge_blocked`; the page renders the exact minimal
  product projection, current handles, and session/error states.
- Anti-goals: no backend, auth implementation, catalog/detail redesign, variant
  favorites, sharing, recommendations, guest favorite intent, or browser wishlist
  persistence.
- Allowed write scope: the eight task-scoped storefront/changelog files plus this
  full T2 protocol and `.tasks/TASK-040/` evidence/report artifacts.
- Forbidden scope: backend/auth implementation, `WishlistProvider`/client state
  boundary changes, cart merge semantics, browser wishlist storage, and task,
  packet, scheduler, or lifecycle state.
- Stop conditions: product ID is unavailable, login routing requires pending intent,
  projection needs fields outside the contract, or merge-blocked checkout state
  would disable wishlist capability.

## Boundary Notes

- `WishlistProvider` from TASK-039 owns session-cookie API access and transient
  backend-truth state. UI consumes `useWishlist`; it does not call the API directly.
- `AuthProvider` supplies current-customer capability. UI treats only
  `session_established` with a customer as authenticated and does not inspect or
  gate on cart merge readiness.
- `writeReturnPath` from FT-004 owns safe internal return-path storage. Wishlist
  does not store product IDs or pending favorite intent.
- Catalog/detail use opaque `product.id` for mutation and `handle` only for links.
- `/wishlist` renders fields from `WishlistProduct` only: id, handle, title,
  thumbnail, category, price, and availability. Wishlist record metadata is not
  copied into UI projection.

## Dependency Evidence

- TASK-039 implementation/verification handoff proves session-aware in-memory
  load/add/remove, `merge_blocked` independence, backend truth, 401 clearing, and
  no wishlist browser storage: `.tasks/TASK-039/TASK-039-S-IMPL-final-report-code-01.md`,
  `.protocols/TASK-039/handoff.md`, and the indexed TASK-039 record.
- TASK-031 handoff proves existing login return-path behavior and that auth/cart
  merge semantics remain owned by FT-004/FT-003: `.protocols/TASK-031/handoff.md`
  and `.tasks/TASK-031/TASK-031-S-IMPL-final-report-code-03.md`.
- TASK-036 evidence is represented by the current `id` fields in
  `apps/storefront/lib/catalog.ts` and `apps/storefront/lib/product-detail.ts`.

## Preflight

- Existing unrelated dirty changes are preserved. `apps/storefront/app/layout.tsx`,
  `apps/storefront/src/test-runner.cjs`, and `.memory-bank/changelog.md` already
  contain TASK-039/workflow changes; edits remain append-only or additive.
- No TASK-040 protocol or UI/page source existed before this run.
- Task JSON, packet, scheduler state, and lifecycle status are outside this run.
