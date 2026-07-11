---
description: Packet, spec, acceptance, and scope audit for TASK-023 /verify.
status: complete
---
# TASK-023 Verify Packet Spec Scope Audit

## Verification Basis

- Task record: `.memory-bank/tasks/TASK-023.task.json`
- Tier: T2
- Required packet: `.memory-bank/packets/TASK-023.packet.json`
- Packet status before verification: `ready`
- Packet hash before verification: matched current task record
- Packet hash after task-record verification evidence update: refreshed and
  matched updated task record
- Feature: `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- Implementation plan: `.memory-bank/tasks/plans/IMPL-FT-003.md`
- Linked SDD specs:
  - `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
  - `.memory-bank/architecture/cart-runtime.md`
  - `.memory-bank/contracts/cart-api-data-contract.md`

## Spec Alignment

- FT-003 UX contract requires lazy add-to-cart creation, cart view add/update/remove,
  empty/loading/stale-reference/validation/conflict/backend-failure states, and
  no cached line-item reconstruction after stale/not-found.
- Cart runtime requires browser storage to hold only `{ version, cart_id }` and
  UI state to never override backend cart truth.
- Cart API/data contract allows the storefront cart view to depend only on the
  backend `StoreCart` subset and requires absolute quantities for updates.

## Code Audit

- `apps/storefront/app/layout.tsx` wraps the app in `CartProvider` with
  `restoreOnMount={false}`, letting the cart page render stale-reference recovery.
- `apps/storefront/app/cart/page.tsx` exposes the `/cart` route and renders
  `CartView`.
- `apps/storefront/components/product-detail-selector.tsx` uses `useCart()` and
  calls `addItem({ variantId: payload.selected_variant_id, quantity: payload.quantity })`
  only after `buildCartActionHandoff` returns a valid FT-002 handoff.
- `apps/storefront/components/cart-view.tsx` renders `state.cart` fields, marks
  backend-sourced totals/items, submits absolute quantity values to `updateItem`,
  calls `removeItem`, and displays loading, empty, stale, validation, stock
  conflict, and backend failure states.
- `apps/storefront/lib/cart-state.ts` preserves backend cart responses as state,
  clears stale references on `cart_not_found`, keeps backend failures retryable,
  and normalizes validation/conflict/backend states.
- `apps/storefront/lib/cart.ts` stores only the `eshop.cart.v1` reference envelope
  and uses reused Medusa Store cart routes.

## Acceptance Mapping

| Task verify item | Result |
|---|---|
| Valid Medusa Product Variant ID reaches guest-cart add without weakening selection guards. | PASS |
| Cart page renders backend items/totals and supports absolute quantity update/remove. | PASS |
| Loading, empty, stale, validation, stock conflict, and backend failure states are visible and recoverable. | PASS |
| Reload renders retrieved backend cart rather than cached line data. | PASS |

## Scope And Anti-Goals

- Allowed implementation scope matches prior execute scope evidence.
- No authenticated merge, OAuth, backend cart APIs, checkout, order, inventory
  reservation, or payment behavior was changed for this verification.
- No browser-authoritative cart payload storage was introduced by TASK-023.
- The linked FT-003 feature remains incomplete until TASK-024..TASK-026 and later
  feature-level `/red-verify --feature FT-003` are complete.

## Doctor Notes

`node scripts/mb-doctor.mjs --strict` passed with no TASK-023 findings. The only
warnings were readiness candidates for TASK-024 and TASK-025.
