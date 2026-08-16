---
description: Execution context for TASK-047 authenticated checkout validation handoff.
status: in_progress
---
# TASK-047 Context

## Task

- Role: Implementer.
- Tier: T3.
- Authoritative task: `.memory-bank/tasks/TASK-047.task.json`.
- Packet context: `.memory-bank/packets/TASK-047.packet.json` (scheduler-owned readiness; not structurally validated or repaired here).
- Feature: FT-006 Checkout Delivery Methods.
- Dependencies: TASK-046 is `done`; TASK-029 is present as the second dependency in the authoritative record.

## Goal Interpretation

- Purpose: create the authenticated backend boundary that normalizes checkout input, validates method/payment selection, resolves the Admin-managed tariff, and returns transient FT-007/FT-009 handoff data.
- Success outcome: synthetic authenticated requests receive deterministic validation and current configured tariff data without order, inventory, payment, or provider mutation.
- Anti-goals: no auth/session implementation, Medusa Core changes, downstream FT-007/FT-009 implementation, external delivery provider, durable snapshot, production data, or secrets.

## Required Boundary

- Customer identity must come from standard Medusa customer actor context.
- The route must be protected by the existing `authenticate("customer", ["session", "bearer"])` middleware boundary before positive-path verification is possible.
- The route may validate `req.auth_context.actor_id`, but a type-only `AuthenticatedMedusaRequest` is not a runtime authentication guard.

## Resolved Preflight Findings

- The owner-approved scope refresh added `apps/backend/src/api/middlewares.ts` to
  the allowed write boundary. The standard customer middleware now protects
  `POST /store/checkout` with `authenticate("customer", ["session", "bearer"])`.
- TASK-046 is scheduler-closed and exposes `resolveCheckoutDeliveryOptions`; the
  checkout workflow consumes that Admin / Shipping Options projection without a
  second tariff source or fallback.
- The packet-required `checkout-delivery` dispatcher entry and smoke script are
  registered inside the approved TASK-047 files.

## Implementation Boundary

- Customer ownership is derived only from the runtime Medusa actor context;
  client identity, tariff, order, and provider payment identity are not accepted
  as authority.
- The workflow resolves current Admin Shipping Options and returns a transient
  FT-007 snapshot plus FT-009 payment ID. It does not create order, inventory,
  payment, or provider state.
- The public response omits the internal actor ID while the workflow snapshot
  retains actor-derived ownership for the downstream FT-007 handoff.

## Evidence Rules

- Evidence is synthetic/local only.
- Do not record customer PII, credentials, tokens, provider payloads, or production values.

## Remediation Boundary

- Middleware adaptation is limited to the checkout route's standard Medusa
  `authenticate("customer", ["session", "bearer"])` result: native unauthenticated
  401 output is converted to the shared sanitized `checkout_auth_required` envelope;
  authentication extraction and actor authorization remain standard and unchanged.
- HTTP evidence uses a local Express route with the configured checkout middleware,
  JSON parser, synthetic session context, and the existing route handler. No new auth
  mechanism, client identity, bearer token, session creation, or external request is
  introduced.
- Fixture cleanup is unconditional and failure-observable: every owned deletion is
  attempted, sanitized failure labels are recorded, and the smoke fails after all
  cleanup attempts if any deletion failed.
