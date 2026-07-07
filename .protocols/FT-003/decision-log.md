---
description: Design decisions for FT-003 guest cart persistence and merge.
status: active
---
# FT-003 Decision Log

## 2026-07-03 — Soft-delete consumed source cart

- Decision: after a successful merge into an existing customer cart, call the
  Medusa Cart Module `softDeleteCarts` for the source; compensate with
  `restoreCarts` if a later step fails.
- Consequence: ordinary Store CRUD returns not found for the consumed source,
  while authenticated replay queries the completed journal first and returns
  the recorded target. No-target transfer keeps the source active as the target.

## 2026-07-03 — Split implementation and acceptance slices

- Decision: replace the oversized merge and all-in-one verification tasks with
  separate plan, lifecycle, API, state, UI, post-auth, backend acceptance, and
  browser acceptance tasks.
- Consequence: each task has a narrower write scope and reproducible evidence;
  the queue now spans TASK-017 through TASK-026.

## 2026-07-02 — Reuse Medusa cart ownership

- Decision: Medusa Cart Module owns carts and line items; PostgreSQL is the
  durable source of truth.
- Consequence: no parallel cart tables and no custom cart CRUD facade.

## 2026-07-02 — Browser persistence is reference-only

- Decision: persist a versioned opaque cart ID in browser local storage.
- Consequence: browser data can recover a cart but cannot prove ownership,
  quantity, totals, price, availability, or customer identity.

## 2026-07-02 — One custom authenticated merge endpoint

- Decision: use built-in Store routes for cart CRUD and add
  `POST /store/carts/{cart_id}/merge` only for the missing cross-cart operation.
- Consequence: the endpoint resolves the destination from authenticated customer
  context; the client cannot nominate another customer's cart.

## 2026-07-02 — Durable merge journal

- Decision: store one merge journal record per source cart with a unique
  `source_cart_id` and an immutable quantity plan.
- Consequence: repeated requests converge on the recorded target and absolute
  quantities instead of incrementing twice.

## 2026-07-02 — No event queue

- Decision: merge is a synchronous Medusa workflow guarded by deterministic
  locks; no custom message broker, queue, consumer, retry worker, or DLQ is
  introduced.
- Consequence: HTTP retry uses the merge journal, and success is returned only
  after durable completion.

## 2026-07-02 — Feature boundary with authentication

- Decision: FT-003 defines and implements the authenticated merge boundary but
  does not implement OAuth providers.
- Consequence: FT-004 establishes customer authentication and invokes the FT-003
  handoff; FT-003 tests use authenticated customer context without live Google or
  VK credentials.
