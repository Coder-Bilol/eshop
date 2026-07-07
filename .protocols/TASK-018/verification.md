---
description: TASK-018 functional verification.
status: complete
---
# TASK-018 Verification

VERDICT: PASS

## Mode And Ownership

- Mode: manual
- Tier: `T2`
- Closure owner: `GENERAL`
- Verified at: `2026-07-04`

## Packet And Spec Gates

- Required packet: `.memory-bank/packets/TASK-018.packet.json`
- Packet status: `ready`
- `source_task_hash` before verdict write: exact match
- Linked FT-003 SDD architecture, API/data, access/security, persistence, and
  state specs: present and consistent with TASK-018
- `node scripts/mb-doctor.mjs --strict`: PASS with 0 errors

## Acceptance Evidence

1. Installed Store route contract: PASS.
   - Read-only inspection of installed Medusa 2.16 handlers confirmed:
     `POST /store/carts`, `GET /store/carts/{id}`, add/update line `POST`
     routes, and delete-line `DELETE` with `parent` cart response.
   - The client calls those routes directly and sends
     `x-publishable-api-key` on every request.
2. Cart transport and application errors: PASS.
   - Command: `npm --workspace apps/storefront run test -- cart-client`
   - Create, retrieve, add, absolute quantity update, and remove passed.
   - Network, invalid response, validation, and HTTP status cases map to stable,
     sanitized `CartClientError` codes.
3. Reference-only browser persistence: PASS.
   - Storage contains exactly `{"version":1,"cart_id":"..."}`.
   - Malformed, unsupported-version, empty, whitespace-padded,
     payload-bearing, and token-bearing references are rejected and cleared.
   - Tests prove no items, quantities, totals, prices, customer IDs, auth
     tokens, or availability data are persisted.
4. Stale-reference behavior: PASS.
   - Backend `404` clears the opaque reference and returns no cart.
   - Temporary backend failure retains the reference for retry.
   - No cart truth is reconstructed from browser data.
5. Supporting gates: PASS.
   - `npm --workspace apps/storefront run test`
   - `npm --workspace apps/storefront run typecheck`
   - `node scripts/mb-lint.mjs`
   - `node scripts/mb-doctor.mjs --strict`

## Purpose, Outcome, And Scope Audit

- Purpose served: a narrow browser-to-Medusa guest-cart boundary now exists
  before UI orchestration.
- Success outcome observed: storefront code can operate built-in Store cart
  routes and restore a backend cart from a safe versioned opaque reference.
- Implementation files match the recorded allowed write scope.
- No cart UI, authenticated merge, OAuth/login, custom backend cart CRUD,
  checkout, order, or payment behavior was introduced.
- TASK-018 covers only the client/reference slices of REQ-006 and REQ-007; it
  does not claim complete guest-cart UI or browser E2E coverage.

## Closure

Manual T2 closure prerequisites are satisfied. Following explicit user
instruction, `GENERAL` closed TASK-018 as `done`. FT-003, REQ-006, and REQ-007
remain incomplete.
