---
description: FT-004 customer OAuth, session, cart handoff, checkout gate, and logout lifecycle.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/tech-specs/FT-004-oauth-login-before-payment.md
  - .memory-bank/contracts/auth-session-security.md
  - .memory-bank/states/cart-ownership-merge.md
---
# Customer Authentication And Session State

## States

- `guest`: no valid customer session.
- `auth_starting`: provider start request is in progress.
- `provider_pending`: browser is at Google/VK ID with server-side state pending.
- `callback_validating`: backend validates provider response and identity.
- `customer_resolving`: existing linked customer is loaded or a new customer is
  created through the supported account workflow.
- `session_established`: signed customer session exists.
- `cart_merge_pending`: a guest cart reference exists and FT-003 merge is running.
- `authenticated_ready`: current customer is retrievable and cart merge succeeded
  or no guest reference exists.
- `merge_blocked`: session is valid but recoverable cart merge failed; checkout is
  blocked.
- `auth_failed`: no new valid session was established.
- `logging_out`: session destruction is in progress.

## Allowed Transitions

| From | To | Trigger | Guard/effect |
|---|---|---|---|
| `guest` | `auth_starting` | Buyer chooses Google or VK ID. | Provider is allowlisted; safe return path validated. |
| `auth_starting` | `provider_pending` | Backend returns provider location. | State exists; VK also stores PKCE verifier. |
| `provider_pending` | `callback_validating` | Provider callback arrives. | Exact callback route; required query values present. |
| `callback_validating` | `customer_resolving` | Provider identity validates. | State is valid/single-use; VK PKCE and returned state match. |
| `customer_resolving` | `session_established` | Existing/new customer is linked. | One provider identity, one customer; no email auto-link. |
| `session_established` | `cart_merge_pending` | Guest cart reference exists. | Invoke FT-003 authenticated handoff. |
| `session_established` | `authenticated_ready` | No guest cart reference exists. | Current customer retrieval succeeds. |
| `cart_merge_pending` | `authenticated_ready` | Merge succeeds/replays. | Active reference atomically adopts backend target. |
| `cart_merge_pending` | `merge_blocked` | Recoverable merge failure. | Preserve source reference and session; show retry. |
| `merge_blocked` | `cart_merge_pending` | Buyer retries. | Same authenticated customer and source reference. |
| Any pre-session state | `auth_failed` | Cancel, invalid state, missing email, collision, provider/network failure. | Preserve guest cart; sanitize error; no partial session. |
| `authenticated_ready` or `merge_blocked` | `logging_out` | Buyer confirms logout. | Send session DELETE first. |
| `logging_out` | `guest` | Session deletion succeeds. | Clear customer state, safe return path, and local cart reference. |

## Checkout Gate

- `guest`, `auth_starting`, `provider_pending`, `callback_validating`,
  `customer_resolving`, `session_established`, `cart_merge_pending`, `merge_blocked`,
  `auth_failed`, and `logging_out` cannot continue to checkout/payment content.
- Only `authenticated_ready` may render the authenticated checkout continuation.
- The gate redirects `guest` to login with a validated internal return path.
- The gate never substitutes for backend customer actor validation on checkout,
  order, or payment-start endpoints.

## Authenticated Feature Capability

- Do not add another lifecycle state for wishlist. Its capability rule is simply a
  successful current-customer retrieval from the backend using the valid session.
- Cart merge state is orthogonal to that capability. `cart_merge_pending` and
  `merge_blocked` continue to block checkout, but a successful current-customer
  response permits wishlist reads/mutations.
- Guest/session-expired/current-customer `401` denies wishlist access and clears
  in-memory wishlist state.

## Failure And Retry Rules

- Provider cancel/failure and invalid/replayed callback return to `auth_failed`, not
  a partially authenticated state.
- Duplicate callback cannot create a second customer. Consumed state fails closed;
  repeat login through the same provider identity resolves the existing customer.
- Same-email cross-provider collision fails before session establishment and
  requires a future explicit account-linking flow.
- Cart merge failure does not roll back authentication and does not discard the
  guest cart reference. Checkout remains blocked while retry is offered.
- Session expiry/restart moves the UI to `guest` after current-customer retrieval
  returns `401`; durable customer and cart records remain unchanged.
- Logout failure keeps local authenticated/cart state until a retry or a confirmed
  session-invalid response prevents false logout success.

## Cross-Feature Handoffs

- FT-003 owns cart merge semantics, ownership, idempotency, reference switch, and
  source recovery.
- FT-006 may render checkout fields only after `authenticated_ready`.
- FT-009 must enforce customer actor context on payment start regardless of UI
  state.

## Verification Targets

- State tests exercise every allowed transition and reject checkout continuation
  from every state except `authenticated_ready`.
- Integration tests prove no customer/session/link remains after pre-session
  failure, collision, replay, or invalid VK PKCE.
- Browser E2E proves cancel preserves guest cart, merge failure blocks checkout and
  retries, successful login consumes safe return path, and logout clears session
  plus local cart reference.
