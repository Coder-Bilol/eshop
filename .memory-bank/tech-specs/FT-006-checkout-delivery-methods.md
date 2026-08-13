---
description: Feature-level SDD hub for FT-006 checkout data and delivery methods.
status: active
owner: prd-to-tasks
last_updated: 2026-08-12
source_of_truth:
  - .memory-bank/features/FT-006-checkout-delivery-methods.md
  - .memory-bank/prd.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/system-architecture.md
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
- [.memory-bank/prd.md](../prd.md): FR-013 through FR-017, checkout flow, domain vocabulary, and acceptance criteria.
- [.memory-bank/requirements.md](../requirements.md): REQ-013 through REQ-017 and RTM test ownership.
- [.memory-bank/epics/EP-003-checkout-order-inventory.md](../epics/EP-003-checkout-order-inventory.md): checkout and delivery boundary within EP-003.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md): backend/PostgreSQL ownership, API -> Workflows -> Modules, and no delivery-provider integration.
- [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md): authenticated mutation, validation errors, status codes, and feature-local endpoint contract ownership.
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md): storefront, Medusa extension, and forbidden external-delivery boundaries.
- [.memory-bank/states/customer-auth-session.md](../states/customer-auth-session.md): only `authenticated_ready` may render authenticated checkout continuation.
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md): backend ownership of order/payment/inventory state after checkout handoff.
- [.memory-bank/testing/index.md](../testing/index.md): tariff unit and checkout E2E verification expectations.
- [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md): T2 routing for API, domain, state, and cross-module work.

## Evidence-Backed Decisions

- The semantic delivery set is pickup, city courier, and transport-company delivery.
- Delivery uses fixed tariffs in backend logic and has no external carrier
  calculation, tracking, or provider integration.
- Checkout input includes name, email, required phone, city, address, comment,
  selected delivery method, and selected payment method.
- The only explicitly evidenced field rules are that phone is required and the
  checkout comment is optional. The PRD does not define the remaining requiredness,
  normalization, length, or format rules.
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
| Component Contract | blocked | Exact field requiredness, input rules, option identifiers, labels, ordering, and method-specific UI behavior are missing. |
| API Contract | blocked | Endpoint/request/response shape, stable delivery option IDs, tariff representation, and validation error details are missing. |
| Event Contract | not_applicable | FT-006 introduces no delivery-provider event, queue, or custom event bus. |
| Data Contract | blocked | Tariff values, currency/precision, field normalization, and validated handoff snapshot are unspecified. |
| Data/Persistence Specification | blocked | Ownership and exact snapshot boundary between FT-006 checkout input and FT-007 pending-order creation are not specified. |
| State Specification | blocked | Unavailable methods and tariff-calculation failure behavior are named as edge cases but their transitions and user-visible outcomes are not defined. |
| Security/Access Contract | complete | Existing authenticated checkout gate, backend actor validation, privacy, and sanitized-error rules apply. |
| Deployment/Operations | not_applicable | No provider, deployment, migration, or new runtime operation is introduced by the evidence-backed FT-006 scope. |

## Acceptance Coverage Boundary

- REQ-013: collection of name, email, and required phone is covered in scope;
  detailed validation remains blocked.
- REQ-014: collection of city, address, comment, and delivery method is covered
  in scope; requiredness and method-specific applicability remain blocked.
- REQ-015: the three manual methods are fixed in the semantic scope; stable
  public identifiers and availability behavior remain blocked.
- REQ-016: fixed tariff calculation is in scope; numeric tariffs and money rules
  remain blocked.
- REQ-017: selected payment method is collected in scope; its cross-feature
  contract with FT-009 remains to be fixed before implementation tasks.

## Open Questions And Blockers

The following gaps are feature-relevant and prevent truthful T2 task generation:

1. **FT006-OQ-001: tariff table.** What exact fixed amount applies to pickup,
   city courier, and transport-company delivery? Which currency, minor-unit
   precision, rounding rule, and configuration source are authoritative?
2. **FT006-OQ-002: delivery option contract.** What stable machine identifiers,
   display labels, ordering, and availability representation are public for the
   three semantic methods?
3. **FT006-OQ-003: field validation.** Which of name, email, city, address, and
   comment are required, and what format, normalization, length, and safe-error
   rules apply? Existing evidence only establishes required phone and optional
   comment.
4. **FT006-OQ-004: method-specific fields.** Are city and address required,
   optional, or disallowed for pickup? Are there distinct rules for city courier
   and transport-company delivery?
5. **FT006-OQ-005: unavailable/tariff failure behavior.** What stable backend
   error, HTTP status, and UI recovery behavior apply when a method is unavailable
   or its fixed tariff cannot be calculated?
6. **FT006-OQ-006: downstream handoff.** What exact validated delivery/contact
   snapshot is handed from FT-006 to FT-007, and which backend boundary owns its
   persistence on pending-order creation?
7. **FT006-OQ-007: payment-selection handoff.** Which stable selected-payment
   identifiers does FT-006 submit to the later FT-009 payment contract? The PRD
   names cards, SBP, and SberPay for payment integration, but does not define the
   checkout selection schema.

Required resolution: operator/product owner input for OQ-001 through OQ-005,
plus an explicit FT-006/FT-007/FT-009 contract handoff for OQ-006 and OQ-007.

## Verification Targets After Unblocking

- Unit tests cover every fixed tariff entry, unknown/unavailable method, money
  representation, and deterministic failure behavior.
- Backend contract/integration tests prove authenticated actor validation,
  field-level validation errors, exact delivery option/tariff response shape,
  and validated handoff into the downstream order boundary.
- Storefront E2E proves the authenticated checkout fields, required-phone failure,
  delivery selection, tariff display, unavailable-method recovery, and payment
  selection without a live delivery provider or payment mutation.
- Evidence must not contain real customer contact data, credentials, payment
  secrets, provider tokens, or production data.
- T2 implementation and verification must follow the full protocol and packet
  requirements in [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md).

## Decomposition Gate

`spec_design_status` is `blocked`. Do not create or update an implementation
plan, task records, task index links, or execution packets until the listed
contract and tariff blockers are resolved and this hub can become complete.
