---
description: FT-003 REST API and cross-boundary payload contract for guest carts and authenticated merge.
status: active
owner: spec-improve
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/contracts/api-guidelines.md
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
---
# Cart API And Data Contract

## Protocol

- Style: REST/JSON over the existing Medusa Store API.
- gRPC: not applicable.
- GraphQL: not applicable.
- Every Store request sends `x-publishable-api-key`.
- Authenticated merge also sends the Medusa customer session cookie or bearer
  token; the storefront uses `credentials: include` for cookie sessions.

## Reused Medusa Store Routes

FT-003 reuses rather than wraps:

| Operation | Route | Input | Success |
|---|---|---|---|
| Create cart | `POST /store/carts` | Medusa create-cart body with region/sales-channel context. | `200 { "cart": StoreCart }` |
| Retrieve cart | `GET /store/carts/{cart_id}` | Path cart ID. | `200 { "cart": StoreCart }` |
| Add line | `POST /store/carts/{cart_id}/line-items` | `{ "variant_id": string, "quantity": positive integer }` | `200 { "cart": StoreCart }` |
| Set line quantity | `POST /store/carts/{cart_id}/line-items/{line_id}` | `{ "quantity": positive integer }` | `200 { "cart": StoreCart }` |
| Remove line | `DELETE /store/carts/{cart_id}/line-items/{line_id}` | Path IDs. | `200 { "id", "object", "deleted", "parent": StoreCart }` |

The implementation must use the installed Medusa 2.16 contracts and core
workflows. It must not reimplement pricing, product/variant lookup, or inventory
validation in a parallel application API.

## Custom Merge Route

### Request

```http
POST /store/carts/{source_cart_id}/merge
x-publishable-api-key: <public-store-key>
Cookie: <authenticated-customer-session>
Content-Type: application/json

{}
```

- Body is empty; unknown fields are rejected.
- Destination cart ID and customer ID are never accepted from the client.
- `source_cart_id` must resolve to a non-completed guest cart or a cart already
  owned by the authenticated customer.

### Success

```json
{
  "cart": {
    "id": "cart_target",
    "customer_id": "cus_actor",
    "items": [
      {
        "id": "cali_target",
        "variant_id": "variant_123",
        "quantity": 3
      }
    ]
  },
  "merge": {
    "source_cart_id": "cart_guest",
    "target_cart_id": "cart_target",
    "outcome": "merged",
    "replayed": false
  }
}
```

`outcome` is one of:

- `transferred`: no compatible customer cart existed; source became customer-owned.
- `merged`: source quantities were merged into an existing customer cart.
- `already_merged`: a completed journal result was replayed.

On replay, `replayed` is `true`, `target_cart_id` is unchanged, and no quantity
is incremented.

### Consumed source behavior

For `outcome: merged`:

- target mutations complete first;
- the source cart is soft-deleted through the Medusa Cart Module before the
  journal becomes `completed`;
- ordinary `GET`, add-line, set-quantity, and remove-line Store calls using the
  consumed source ID return not found;
- the source cart and its line data are not hard-deleted or cleared;
- authenticated replay of `POST /store/carts/{source_cart_id}/merge` resolves
  the completed journal before source retrieval and returns the recorded target
  with `outcome: already_merged`.

For `outcome: transferred`, source and target are the same cart. The cart stays
active and is not soft-deleted.

## Stable Error Envelope

```json
{
  "error": {
    "code": "cart_merge_stock_conflict",
    "message": "Cart quantities cannot be merged.",
    "details": {
      "variant_ids": ["variant_123"]
    }
  }
}
```

| HTTP | Code | Meaning / required behavior |
|---|---|---|
| 400 | `cart_merge_invalid_request` | Invalid path/body; no mutation. |
| 401 | `cart_merge_auth_required` | No authenticated customer context. |
| 403 | `cart_merge_source_forbidden` | Source belongs to another customer. |
| 404 | `cart_not_found` | Unmerged source or recorded target missing; storefront clears a stale active reference. A completed merge with an available recorded target is replayed before source lookup. |
| 409 | `cart_merge_incompatible` | Source/target region, currency, or sales channel is incompatible. |
| 409 | `cart_merge_stock_conflict` | Planned quantity is not sellable; no silent cap or partial merge. |
| 409 | `cart_merge_in_progress` | Same source is currently locked/in progress; client retries with bounded backoff. |
| 500 | `cart_merge_failed` | Workflow failed and compensation/recovery status is recorded; source reference is retained. |

Error messages must not reveal another customer's cart ID, customer ID, email,
items, or existence beyond the generic forbidden result.

## Boundary Data Contract

### Browser reference envelope

Key: `eshop.cart.v1`

```json
{
  "version": 1,
  "cart_id": "cart_opaque"
}
```

No items, quantities, product data, totals, prices, customer IDs, tokens, or
availability flags are stored in the envelope.

### Storefront cart view

The storefront may depend only on this required subset of Medusa `StoreCart`:

- `id`, `customer_id`, `currency_code`, `region_id`, `sales_channel_id`;
- `items[].id`, `items[].variant_id`, `items[].quantity`;
- display fields already present on Medusa line items;
- totals returned by Medusa.

Unknown Medusa response fields are ignored. Client code must not infer ownership
from local storage or reconstruct totals.

### Internal merge plan

```json
{
  "source_cart_id": "cart_guest",
  "target_cart_id": "cart_target",
  "customer_id": "cus_actor",
  "items": [
    {
      "variant_id": "variant_123",
      "source_quantity": 1,
      "target_quantity_before": 2,
      "target_quantity_after": 3,
      "target_line_item_id": "cali_target"
    }
  ]
}
```

- `items` is sorted by `variant_id`.
- `target_quantity_after` is immutable after the journal is created.
- Missing target line uses `target_line_item_id: null` and
  `target_quantity_before: 0`.
- SKU text is display-only and cannot be the merge key.

## Retry And Idempotency

- Idempotency scope is `(source_cart_id, authenticated customer)`.
- A unique durable record for `source_cart_id` prevents duplicate plans.
- Repeated completed requests query the journal before the source cart and
  return the recorded target and refreshed cart.
- A request with the same source under another customer returns `403`.
- Network timeout after commit is safe to retry.
- Client retry is bounded; `409 cart_merge_in_progress` may be retried with
  backoff, while validation/ownership/stock conflicts require user action.
