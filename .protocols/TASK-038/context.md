---
description: Execution context for TASK-038 authenticated wishlist Store API.
status: complete
---
# TASK-038 Context

## Authoritative Inputs

- Task: `.memory-bank/tasks/TASK-038.task.json` (`T3`, status `ready`).
- Packet: `.memory-bank/packets/TASK-038.packet.json` (`ready`).
- Feature plan: `.memory-bank/tasks/plans/IMPL-FT-005.md`.
- Contracts: `.memory-bank/contracts/wishlist-api-security.md`, `.memory-bank/contracts/auth-session-security.md`, and `.memory-bank/contracts/api-guidelines.md`.
- Domain/service inputs: `.memory-bank/domains/wishlist-data.md`, `.memory-bank/tech-specs/FT-005-authenticated-wishlist.md`, and `.memory-bank/spec-backbone.md`.

## Goal Interpretation

- Purpose: expose authenticated list/add/remove wishlist operations at the Store boundary.
- Success outcome: customer actor can access only its own visible favorites; guests and cross-customer attempts do not disclose state.
- Anti-goals: no auth provider/session creation, production bearer mechanism, customer ID input, storefront, or wishlist workflow/module redesign.
- Allowed write scope: the route, validator, middleware, API smoke, backend package script, and changelog paths listed by the task.
- Forbidden scope: auth provider/session creation, wishlist module/workflow semantics, storefront, core customer/product tables, and production data.
- Stop conditions: missing standard actor context, client-selected ownership, inability to preserve exact projection/unified hidden 404, or production bearer behavior.

## Boundary Notes

- Routes own HTTP validation, authentication guard, actor/sales-channel extraction, status codes, and sanitized error mapping.
- Workflows/service own wishlist mutation, product visibility, ownership filtering, and projection semantics.
- Production storefront credential remains the Medusa session cookie; bearer is accepted only by the existing standard middleware for local harness transport.

## Dependencies

- `TASK-029`: done; customer session capability is available.
- `TASK-037`: done; wishlist workflows and exact product projection are available.

## Packet Context

- Required packet: `.memory-bank/packets/TASK-038.packet.json`.
- Packet status: `ready` as read; structural freshness is owned by the doctor/scheduler gate, not `/execute`.

## Approved Scope Clarification

- The required packet gate `test:integration -- wishlist-api` needs one suite entry
  in the shared `apps/backend/test/run-integration.cjs` dispatcher, which was absent
  from the generated task scope. The operator explicitly approved this bounded
  expansion on 2026-08-08; no other out-of-scope file was changed.
