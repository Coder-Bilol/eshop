---
description: FT-005 authenticated wishlist Store API, ownership, idempotency, and privacy contract.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/tech-specs/FT-005-authenticated-wishlist.md
  - .memory-bank/domains/wishlist-data.md
  - .memory-bank/contracts/api-guidelines.md
  - .memory-bank/contracts/auth-session-security.md
---
# Wishlist API And Security Contract

## Credential And Ownership Rules

- Every wishlist route requires authenticated Medusa `customer` actor context.
- Session cookie is the only FT-005 production storefront credential. FT-005 adds
  no production bearer mechanism, token storage, or bearer configuration.
- A synthetic bearer may be used only by the existing local integration/E2E harness
  through standard Medusa customer middleware; it is test transport, not a new
  production authentication path.
- `x-publishable-api-key` scopes product visibility/sales channel but is not
  customer identity.
- Customer ID is always `req.auth_context.actor_id`; request body, path, query, and
  headers cannot select another customer.
- Product ID is untrusted input and never grants record access by itself.

## HTTP Contract

### WishlistProductProjection

List and add use this exact product shape; it is intentionally smaller than
`CatalogProduct` and `ProductDetail`:

```json
{
  "id": "prod_opaque",
  "handle": "current-handle",
  "title": "Synthetic product name",
  "thumbnail": null,
  "category": {
    "handle": "active-category",
    "name": "Active category"
  },
  "price": {
    "amount": 159900,
    "currency_code": "RUB"
  },
  "is_available": false
}
```

- `id`, `handle`, `title`, `category.handle`, `category.name`, and
  `is_available` are required and non-null.
- `thumbnail` is `string|null`: first current non-empty product image URL, otherwise
  `null`.
- `price` is `{ amount: integer >= 0, currency_code: uppercase string }|null`: the
  lowest valid current variant price under existing catalog pricing rules, or
  `null` when no valid price exists.
- `is_available` is `true` when at least one current variant is sellable under the
  existing FT-002 availability pre-check; otherwise `false`. A false value does not
  hide an otherwise visible product.
- Product ID is durable wishlist identity. Handle is current navigation only.

### List

`GET /store/wishlist`

Success `200`:

```json
{
  "items": [
    {
      "id": "witem_opaque",
      "product_id": "prod_opaque",
      "created_at": "ISO-8601",
      "product": {
        "id": "prod_opaque",
        "handle": "current-handle",
        "title": "Synthetic product name",
        "thumbnail": null,
        "category": {
          "handle": "active-category",
          "name": "Active category"
        },
        "price": null,
        "is_available": false
      }
    }
  ],
  "count": 1
}
```

Each array element is the canonical `WishlistItem` response shape. Hidden products
and their record IDs are omitted. Pagination is not required for MVP.

### Add

`POST /store/wishlist/items`

Request:

```json
{"product_id":"prod_opaque"}
```

- First add: `201 { item, created: true }`.
- Existing/concurrent duplicate: `200 { item, created: false }`.
- `item` has exactly the same `WishlistItem` shape as an element of list `items`,
  including the exact `WishlistProductProjection` above.
- Product must exist, be `published`, be visible in the current sales channel, and
  have an active category. Out-of-stock remains addable/visible with
  `is_available: false`.

### Remove

`DELETE /store/wishlist/items/{product_id}`

- Existing actor-owned record: `200 { product_id, removed: true }`.
- Missing actor-owned record: `200 { product_id, removed: false }`.
- Response never reveals whether another customer has the product saved.

## Errors

Use the global error envelope and these stable codes:

| HTTP | Code | Meaning |
|---|---|---|
| `400` | `wishlist_invalid_request` | Missing/malformed product ID. |
| `401` | `wishlist_auth_required` | No valid customer actor. |
| `404` | `wishlist_product_not_found` | Product is missing, unpublished, current-sales-channel-invisible, or has no active category. |
| `500` | `wishlist_operation_failed` | Sanitized unexpected failure. |

Do not return customer IDs, other customers' record existence, raw database errors,
query internals, session data, or full provider/customer payloads.

Authentication is evaluated before wishlist behavior. For an authenticated request,
all four hidden-product cases collapse to the same `404 wishlist_product_not_found`;
the API never reveals which catalog record or visibility guard failed. Remove does
not revalidate product visibility and remains idempotent by actor-derived customer
ID plus product ID.

## Access Matrix

| Action | Guest | Authenticated customer | Guard |
|---|---|---|---|
| List wishlist | denied `401` | own visible items only | Actor-derived customer filter. |
| Add visible product, including out-of-stock | denied `401` | idempotent allowed | Actor plus published/sales-channel/active-category validation. |
| Remove own product | denied `401` | idempotent allowed | Actor plus product ID lookup. |
| Read/remove another customer's record | denied | denied/non-observable | Customer filter is mandatory. |
| Persist in browser | forbidden | forbidden | Backend/PostgreSQL is sole durable source. |

## Concurrency And Idempotency

- Composite database uniqueness is authoritative for duplicate/concurrent add.
- Add handles unique conflict by reading the actor-owned current row; it does not
  return `500` or create a second record.
- Remove is safe to retry and never deletes by product ID without customer filter.
- No idempotency-key header, queue, distributed lock, or event is needed.

## Logging And Privacy

- Logs/evidence may include operation, status, created/removed boolean, correlation
  ID, and redacted identifier suffixes when necessary.
- Production logs must not contain wishlist contents, full customer IDs, customer
  PII, cookies, bearer values, OAuth tokens, session IDs, secrets, or production
  product/customer payloads.
- Acceptance screenshots/traces/reports may contain synthetic product names/IDs and
  synthetic wishlist contents when needed to prove visible behavior. They must not
  contain real PII, production data, cookies, bearer values, OAuth tokens, session
  IDs, or secrets.
- Automated tests use synthetic customers/products and local PostgreSQL.

## Verification Rules

- Integration tests use two customers and prove isolation for list/add/remove.
- Negative tests cover guest, malformed product ID, missing/unpublished/channel-
  invisible/inactive-category product with identical `404`, duplicate/concurrent
  add, repeated remove, and backend failure. Out-of-stock stays visible/unavailable.
- Browser tests prove no wishlist key/data is added to local/session storage.
- Auth/ownership API work is T3; local data/projection/UI work may be T2 when it
  does not change authentication or authorization semantics.
