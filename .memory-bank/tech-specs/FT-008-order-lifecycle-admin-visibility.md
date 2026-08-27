---
description: Feature-level SDD hub for FT-008 order lifecycle and Medusa Admin visibility.
status: active
owner: spec-improve
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/features/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/architecture/order-lifecycle-admin-runtime.md
  - .memory-bank/contracts/order-lifecycle-admin-api.md
  - .memory-bank/domains/order-lifecycle-admin-data.md
  - .memory-bank/states/order-lifecycle-admin.md
---
# FT-008 Order Lifecycle And Admin Visibility

## Scope

FT-008 turns the existing FT-007 pending order into a complete, durable logical
order lifecycle for the current personal/offline-payment MVP and keeps that
lifecycle visible through the native Medusa Admin order surface.

It owns the logical state projection, transition guards, the internal lifecycle
transition workflow, native Medusa Admin event projection, and operator
acceptance evidence. It does not own online provider calls, webhook
authentication, webhook replay storage, email delivery, or a custom Admin
application.

## Normative Design Surface

- [.memory-bank/architecture/order-lifecycle-admin-runtime.md](../architecture/order-lifecycle-admin-runtime.md)
- [.memory-bank/contracts/order-lifecycle-admin-api.md](../contracts/order-lifecycle-admin-api.md)
- [.memory-bank/domains/order-lifecycle-admin-data.md](../domains/order-lifecycle-admin-data.md)
- [.memory-bank/states/order-lifecycle-admin.md](../states/order-lifecycle-admin.md)
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md)
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md)

## Design Area Matrix

| Area | Status | Authoritative source |
|---|---|---|
| Architecture | complete | `architecture/order-lifecycle-admin-runtime.md` |
| Internal transition contract | complete | `contracts/order-lifecycle-admin-api.md` |
| Native order/payment/fulfillment data | complete | `domains/order-lifecycle-admin-data.md` |
| Lifecycle state machine | complete | `states/order-lifecycle-admin.md` |
| Storefront API | not_applicable | FT-008 adds no buyer-facing lifecycle mutation or custom order route. |
| Custom Admin UI | not_applicable | Medusa Admin remains the MVP operator surface. |
| External provider event authenticity | not_applicable | No external provider is used in the current MVP; FT-009 is a deferred optional profile. |
| Email side effects | not_applicable | FT-010 consumes committed state. |
| Persistence/migration | complete | Native Medusa order/payment/fulfillment records and existing metadata; no new table or migration. |
| Testing/operations | complete | Linked testing index, runtime smoke, and Admin/browser acceptance tasks. |

## Lifecycle Contract

The current product lifecycle is:

```text
pending_payment -> paid -> processing -> completed
pending_payment -> canceled
paid|processing|completed -> refunded      (native Admin refund path, when needed)
```

`pending_payment` is represented by the FT-007 native `pending` order plus
`checkout_state: pending_payment` and one native unpaid payment collection using
the Medusa system payment provider (`pp_system_default`). `paid` is written only
after the authenticated native Admin `Mark as paid` action. `processing` is
projected from a native Admin fulfillment-start action, `completed` from the
native Admin completion action, and `canceled` from the native Admin cancel
action on an unpaid order. A post-payment cancel is rejected; a confirmed native
Admin refund may project `refunded`.

## Admin Visibility Contract

The existing Medusa Admin order detail is the only operator surface. The native
order record must retain:

- contact data in the native email/shipping-address fields;
- products and quantities in native order line items;
- delivery address and selected method in the native shipping fields/method data;
- total amount in native order totals;
- payment method in the existing `checkout_payment_method` metadata and the
  native system payment collection/session;
- payment status from the native payment model;
- native order status plus logical `checkout_state` for the product lifecycle.

The supported v2.16 Admin mechanism is the existing Order Detail page: its
`DEFAULT_FIELDS` requests `metadata` and native payment/fulfillment relations,
`showMetadata` and `showJSON` render `checkout_state`, and the built-in
`/orders/:id/metadata/edit` route exposes the metadata section. The same page
uses `sdk.admin.paymentCollection.markAsPaid(paymentCollectionId, { order_id })`
for manual payment confirmation and `sdk.admin.order.cancel(orderId)` for an
unpaid cancellation. No custom Admin replacement or direct database access is
part of the feature.

## Verification Targets

- Transition guards reject illegal or contradictory changes and make repeated
  already-applied Admin/native events safe no-ops.
- Admin mark-as-paid does not delete the reservation; native fulfillment consumes
  the reservation and performs the inventory adjustment.
- An unpaid Admin cancellation remains `canceled` in PostgreSQL, releases the
  reservation through the existing native/FT-007 path, and never returns the
  order to the customer's active cart.
- A canceled order cannot become paid/processing, and a paid/processing/
  completed order cannot become canceled through the FT-008 lifecycle path.
- Admin acceptance observes the exact required order fields and logical metadata
  in the built-in UI and native order payload using synthetic contacts and data.
- Source-binding acceptance rejects forged source/actor/order pairs and any
  Store-originated lifecycle mutation.

## Explicit Non-Goals

- No YooKassa client, provider credentials, webhook endpoint, or replay ledger in
  the current MVP; those remain deferred FT-009 scope.
- No email provider, notification queue, custom event bus, or delivery provider.
- No custom order database, inventory ledger, Admin replacement, or Medusa Core edit.
- No automatic stock restoration on refund.
