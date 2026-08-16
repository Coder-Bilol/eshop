---
description: Feature-level SDD hub for FT-006 checkout data and delivery methods.
status: active
owner: prd-to-tasks
last_updated: 2026-08-13
source_of_truth:
  - .memory-bank/features/FT-006-checkout-delivery-methods.md
  - .memory-bank/prd.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/architecture/checkout-delivery-runtime.md
  - .memory-bank/contracts/checkout-delivery-api.md
  - .memory-bank/domains/checkout-delivery-data.md
  - .memory-bank/states/checkout-delivery-validation.md
  - .memory-bank/contracts/api-guidelines.md
---
# FT-006 Checkout Delivery Methods

## Scope

FT-006 owns the authenticated checkout continuation for collecting contact,
delivery, and payment-selection input; the three manual delivery options; fixed
tariff presentation/calculation; and validation at the storefront/backend
boundary.

FT-006 does not own OAuth/session establishment, guest-cart merge, pending-order
creation, inventory reservation, order lifecycle, payment-provider integration,
payment confirmation, notifications, or Medusa Admin operations. Those concerns
remain with FT-004 and the later FT-007 through FT-010 feature boundaries.

## Normative Design Surface

- [.memory-bank/features/FT-006-checkout-delivery-methods.md](../features/FT-006-checkout-delivery-methods.md): feature scope and acceptance criteria.
- [.memory-bank/prd.md](../prd.md): FR-014 through FR-018, checkout flow, domain vocabulary, and acceptance criteria.
- [.memory-bank/requirements.md](../requirements.md): REQ-013 through REQ-017 and RTM test ownership.
- [.memory-bank/epics/EP-003-checkout-order-inventory.md](../epics/EP-003-checkout-order-inventory.md): checkout and delivery boundary within EP-003.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md): backend/PostgreSQL ownership, API -> Workflows -> Modules, and no delivery-provider integration.
- [.memory-bank/architecture/checkout-delivery-runtime.md](../architecture/checkout-delivery-runtime.md): FT-006 runtime ownership, Shipping Options source, and downstream boundaries.
- [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md): authenticated mutation, validation errors, status codes, and feature-local endpoint contract ownership.
- [.memory-bank/contracts/checkout-delivery-api.md](../contracts/checkout-delivery-api.md): logical input, validation result, stable errors, and FT-007/FT-009 handoffs.
- [.memory-bank/domains/checkout-delivery-data.md](../domains/checkout-delivery-data.md): field rules, option/tariff values, and transient snapshot semantics.
- [.memory-bank/states/checkout-delivery-validation.md](../states/checkout-delivery-validation.md): validation, unavailable-method, retry, and no-mutation state rules.
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md): storefront, Medusa extension, and forbidden external-delivery boundaries.
- [.memory-bank/states/customer-auth-session.md](../states/customer-auth-session.md): only `authenticated_ready` may render authenticated checkout continuation.
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md): backend ownership of order/payment/inventory state after checkout handoff.
- [.memory-bank/testing/index.md](../testing/index.md): tariff unit and checkout E2E verification expectations.
- [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md): T2 routing for API, domain, state, and cross-module work.

## Evidence-Backed Decisions

- The semantic delivery set is `pickup`, `city_courier`, and
  `transport_company`, in that stable order.
- Medusa Admin / Shipping Options is the tariff source. Initial local tariffs are
  pickup `0 RUB`, city courier `500 RUB`, and transport company `700 RUB`.
- Checkout requires `name`, `email`, `phone`, and `city`; address is required for
  courier and transport company but not pickup; comment is optional.
- The backend owns normalization and safe length limits before validation. Exact
  numeric limits remain an implementation-level assumption because BR-002 did
  not select public field-specific values.
- Payment IDs are `card`, `sbp`, and `sberpay`.
- An unavailable method returns `422 delivery_method_unavailable`; recovery is
  retry or selecting another method.
- FT-006 hands a validated checkout snapshot to FT-007 and the selected payment
  ID to FT-009. It creates no order and has no payment-provider integration.
- The storefront is not an authoritative data store and cannot bypass the
  backend boundary. The authenticated checkout continuation must still be backed
  by backend actor validation; the FT-004 UI gate is not an authorization boundary.
- Fixed-tariff calculation and validation must be deterministic and testable
  without an external delivery provider.
- Order persistence and order-state transitions are downstream concerns. FT-006
  must hand off validated delivery/contact/payment-selection data without owning
  the pending-order or inventory lifecycle.

## Design Area Matrix

| Area | Status | Authoritative source or blocker |
|---|---|---|
| Architecture Specification | complete | Global system architecture plus this feature hub boundary. |
| Component Contract | complete | This hub and `checkout-delivery-validation.md`; field requiredness, stable IDs/order, conditional address, and recovery are concrete. |
| API Contract | complete | `contracts/checkout-delivery-api.md` plus global `api-guidelines.md`; logical request/result/error behavior is concrete. |
| Event Contract | not_applicable | FT-006 introduces no delivery-provider event, queue, or custom event bus. |
| Data Contract | complete | `domains/checkout-delivery-data.md` and `contracts/checkout-delivery-api.md`; values, field rules, stable IDs, and transient handoff are concrete. |
| Data/Persistence Specification | not_applicable | FT-006 has no custom durable checkout snapshot or order persistence; FT-007 owns persistence after handoff. |
| State Specification | complete | `states/checkout-delivery-validation.md`; blocked/editing/validation/error/recovery transitions are concrete and isolated from order/payment states. |
| Security/Access Contract | complete | Existing authenticated checkout gate, backend actor validation, privacy, and sanitized-error rules apply. |
| Deployment/Operations | complete | `architecture/checkout-delivery-runtime.md`; Admin/Shipping Options configuration and local initial values are explicit, with no external provider operation. |

## Acceptance Coverage Boundary

- REQ-013: required name, email, and phone with backend normalization and bounded
  validation are covered by TASK-047, TASK-048, and TASK-049.
- REQ-014: required city, conditional address, optional comment, and delivery
  selection are covered by TASK-047, TASK-048, and TASK-049.
- REQ-015: stable IDs/order, Admin/Shipping Options availability, and unavailable
  recovery are covered by TASK-046, TASK-047, TASK-048, and TASK-049.
- REQ-016: configured initial RUB tariffs and deterministic resolution are covered
  by TASK-046, TASK-047, and TASK-049.
- REQ-017: stable payment IDs and FT-009 handoff without provider integration are
  covered by TASK-047, TASK-048, and TASK-049.

## Assumptions And Non-Blocking Questions

- **FT006-A-001: safe limits.** BR-002 requires server-side normalization and
  safe length limits but does not select numeric values. Implementation chooses
  bounded internal values, covers boundaries in tests, and does not expose them
  as a client-configurable contract.
- **FT006-A-002: Medusa extension point.** The exact Medusa v2.16 Shipping
  Options query/configuration adapter must be confirmed against the installed
  runtime during TASK-046. Execution stops if it requires hardcoded tariffs or
  a parallel source.
- **FT006-A-003: downstream transport.** FT-007 owns the physical transport and
  persistence of the validated checkout snapshot; FT-009 owns the physical
  payment-selection boundary. FT-006 defines semantic fields and IDs only.
- **FT006-A-004: email syntax.** Backend uses its standard safe email validation
  for the required email field; no payment-provider or identity-linking behavior
  is introduced by this feature.
- **FT006-A-005: configured tariff failure.** A missing or invalid configured
  tariff fails closed without fallback. Until a later operator decision adds a
  stable feature-specific code, the sanitized unexpected-failure mapping follows
  the shared API guidelines.

## Verification Targets

- Unit tests cover every configured tariff entry, stable ordering, unknown and
  unavailable methods, normalization/limits, and deterministic failure behavior.
- Backend contract/integration tests prove authenticated actor validation,
  field-level validation, conditional address rules, delivery option/tariff
  resolution, exact unavailable error, and validated downstream handoff.
- Storefront E2E proves authenticated checkout fields, required-field failures,
  delivery selection, tariff display, unavailable-method recovery, and payment
  selection without a live delivery provider or payment mutation.
- Acceptance proves that no order is created and no payment-provider request is
  made by FT-006.
- Evidence must not contain real customer contact data, credentials, payment
  secrets, provider tokens, or production data.
- T2 implementation and verification must follow the full protocol and packet
  requirements in [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md).

## Decomposition Gate

`spec_design_status` is `complete`. The feature-local design surface is routed
through the linked architecture, API, data, and state specs. The implementation
plan, schema-backed task records, and required packets are the next artifacts;
this command does not execute them.
