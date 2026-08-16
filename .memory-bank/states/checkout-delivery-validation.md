---
description: FT-006 checkout validation and unavailable-delivery recovery state specification.
status: active
owner: prd-to-tasks
last_updated: 2026-08-13
source_of_truth:
  - .memory-bank/tech-specs/FT-006-checkout-delivery-methods.md
  - .memory-bank/contracts/checkout-delivery-api.md
  - .memory-bank/states/customer-auth-session.md
  - .memory-bank/states/order-payment-inventory.md
---
# Checkout Delivery Validation State

## Scope

This is transient validation/UI state, not the order or payment lifecycle.
FT-004 owns authentication readiness; FT-007 owns order state after handoff;
FT-009 owns payment state after payment selection is consumed.

## States

- `checkout_blocked`: the buyer is not in `authenticated_ready`.
- `checkout_editing`: authenticated buyer can edit checkout input.
- `checkout_validating`: a validation request is in flight.
- `checkout_validated`: backend returned the validated snapshot and payment ID.
- `checkout_invalid`: backend rejected field or selection validation; input can be
  corrected and retried.
- `delivery_method_unavailable`: selected method is unavailable; backend returned
  `422 delivery_method_unavailable`; buyer can retry or select another method.
- `checkout_failed`: sanitized unexpected failure; buyer can retry without any
  order/payment success claim.

## Allowed Transitions

| From | To | Trigger | Guard/effect |
|---|---|---|---|
| `checkout_blocked` | `checkout_editing` | FT-004 reaches `authenticated_ready`. | Backend authorization remains required. |
| `checkout_editing` | `checkout_validating` | Buyer submits input. | No provider/order call occurs in FT-006. |
| `checkout_validating` | `checkout_validated` | Backend validates all fields and resolves tariff. | Handoff is transient and validated only. |
| `checkout_validating` | `checkout_invalid` | Field/payment/conditional-address validation fails. | Preserve editable input safely; show field details only. |
| `checkout_validating` | `delivery_method_unavailable` | Backend returns the stable 422 code. | Offer retry or another available method. |
| `checkout_validating` | `checkout_failed` | Sanitized unexpected failure. | No order/payment success is implied. |
| `checkout_invalid` | `checkout_validating` | Buyer corrects and resubmits. | Re-run backend validation. |
| `delivery_method_unavailable` | `checkout_validating` | Buyer retries or selects another method. | Resolve current Admin/Shipping Options again. |
| `checkout_failed` | `checkout_validating` | Buyer retries. | Do not reuse stale tariff truth without revalidation. |

## Forbidden Transitions

- `checkout_validated` must not create an order or payment inside FT-006.
- The storefront must not move to `checkout_validated` from local form state
  without a successful backend response.
- `delivery_method_unavailable` must not silently substitute another method.
- Any unauthenticated state must not bypass `checkout_blocked`.
- FT-006 must not transition order, inventory, or payment lifecycle states.

## Verification Targets

- State tests cover every transition and reject local success without backend
  validation.
- Backend integration proves unavailable recovery re-resolves current options.
- Browser E2E proves blocked, editing, invalid, unavailable, retry, and validated
  states with synthetic data and no provider/order mutation.
