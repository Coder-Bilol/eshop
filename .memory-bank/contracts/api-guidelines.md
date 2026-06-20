---
description: Global HTTP API guidelines for storefront/backend boundaries.
status: active
owner: spec-design
last_updated: 2026-06-19
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/invariants.md
---
# API Guidelines

## Scope

These guidelines apply to custom storefront/backend HTTP APIs and integration-facing backend endpoints created for the MVP. Existing Medusa APIs and provider payloads keep their native contracts; do not rename Medusa Core fields or provider webhook payloads just to match storefront conventions.

## Source Of Truth

- Backend schemas and Medusa extension code become the executable source after implementation.
- Feature-local specs own endpoint-level request/response details when needed.
- Generated OpenAPI can document implemented backend schemas, but OpenAPI is not the whole-system source of truth.
- This file owns shared API rules: naming, auth, errors, status codes, idempotency, CORS, uploads, pagination, and compatibility.

## Naming And Shape

- Custom storefront-facing JSON should use stable TypeScript-friendly field names.
- Do not expose provider secrets, raw OAuth tokens, payment credentials, or internal-only identifiers.
- Custom IDs returned to the storefront must be opaque; client code must not infer business meaning from ID format.
- Storefront APIs should return enough state for the UI to render waiting/result/error states without allowing the UI to become authoritative for payment/order success.

## Auth And Ownership

- Mutating cart, wishlist, checkout, order, and payment-start endpoints must validate customer/session ownership.
- Payment start requires an authenticated customer.
- Guest cart endpoints may use a guest cart reference/session token, but that reference is not customer identity.
- Admin/operator actions stay in Medusa Admin or backend admin boundaries; do not add a custom admin replacement for MVP.

## Errors

Custom APIs should use a stable JSON error envelope:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

- `message` is safe for logs/UI and must not include secrets or sensitive provider payloads.
- `details` is optional and should be structured when validation errors need field-level context.
- Payment, auth, and webhook errors should include stable codes for tests and retry decisions.

## Status Codes

- `200` or `201`: successful read/create/update when the request has completed.
- `202`: accepted asynchronous/waiting state, such as payment confirmation still pending.
- `400`: malformed request.
- `401`: unauthenticated.
- `403`: authenticated but forbidden for this resource.
- `404`: resource not found or not visible to the requester.
- `409`: conflict with current state, such as invalid order transition or unavailable stock.
- `422`: syntactically valid request rejected by domain validation.
- `500`: unexpected server failure with sanitized response body.

Webhook endpoints should return success only after the event is authenticated and accepted or recognized as an idempotent duplicate.

## Idempotency And Retries

- YooKassa webhook processing must be idempotent by durable provider/payment/event identifiers.
- Retried payment attempts must not create duplicate orders.
- Repeated webhook events must not duplicate inventory transitions, status transitions, or email sends.
- Checkout/order mutation endpoints that can be retried should define their idempotency key or state-conflict behavior in feature-local specs.

## CORS And Origins

- Local development may allow configured local storefront origins.
- Production origins are not designed in this pass and must be explicitly configured before production deployment.
- Do not use unrestricted CORS for authenticated, payment, order, or customer-data endpoints.

## Uploads

Custom storefront uploads are not part of the MVP backbone. Product media/admin uploads should stay in Medusa-supported admin/storage flows unless a later explicit spec adds a custom upload boundary.

## Pagination, Filters, And Search

- Catalog list endpoints should support moderate MVP filters from the PRD: category, price, color, material, size/length, product type, and mounting method.
- Keep search/filter implementation simple until product volume proves a separate search engine is needed.
- Use explicit query parameters for filters and pagination; avoid ad hoc encoded blobs as the primary contract.

## Compatibility

- Avoid breaking existing storefront/backend contracts without updating feature specs, task records, tests, and Memory Bank links.
- Contract changes that affect frontend/backend behavior are at least T2.
- Auth, payment, webhook, order lifecycle, inventory, or production-facing contract changes are T3 unless explicitly justified otherwise.
