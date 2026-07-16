---
description: FT-004 OAuth callback, session, identity, redirect, privacy, and abuse-control contract.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/tech-specs/FT-004-oauth-login-before-payment.md
  - .memory-bank/architecture/auth-runtime.md
  - .memory-bank/contracts/api-guidelines.md
---
# Authentication And Session Security Contract

## Trust Model

- Google and VK ID prove control of a provider identity; they do not directly own
  Medusa customer/cart/order authorization.
- Medusa Auth validates provider responses and owns provider identity. Medusa
  Customer owns the local customer actor.
- A valid signed Medusa session supplies authenticated customer context. A cart ID,
  provider callback parameter, email, or storefront flag never proves identity.
- Later payment-start APIs must validate customer actor context server-side even
  when the storefront checkout gate has already passed.

## HTTP Contract

| Operation | Method/path | Success | Main failures |
|---|---|---|---|
| Start provider login | `POST /auth/customer/{google|vkid}` | `200 { location }` | `400` invalid input/return path, `429` throttled, sanitized `401/5xx` provider/config failure. |
| Complete provider callback | `GET /auth/customer/{google|vkid}/complete` | Session cookie plus `302` to fixed storefront completion path. | `302` to fixed completion error state; no raw provider details. |
| Current customer | `GET /store/customers/me` | Existing Medusa customer response. | `401` when no valid session. |
| Logout | `DELETE /auth/session` | `200 { success: true }`, expired session cookie. | Sanitized `5xx`; client does not claim logout success until response succeeds. |

The existing Medusa callback/session/customer routes and supported workflows may be
reused internally. Custom JSON errors follow
[.memory-bank/contracts/api-guidelines.md](api-guidelines.md). Provider completion
uses redirects with coarse status only and never reflects raw query/error values.

## Callback And Redirect Rules

- Registered provider callback URLs are exact backend URLs, one per environment and
  provider. Runtime `callback_url` overrides from the browser are rejected/ignored.
- Google callback requires Medusa built-in single-use/expiring state validation.
- VK callback requires single-use/expiring state, S256 PKCE verifier, matching
  returned state, `device_id`, and server-side authorization-code exchange.
- State values contain no return URL, customer data, email, cart ID, or secrets.
- Provider callback query parameters are consumed on the backend and removed by an
  immediate redirect. Completion redirects only to configured storefront origin
  plus `/auth/complete`.
- The storefront return path is local session storage only. Accept strings that
  start with exactly one `/`; reject `//`, schemes, control characters, and
  backslashes. Invalid/missing values fall back to `/`.
- Provider cancellation, invalid/expired/replayed state, missing email, collision,
  and upstream failure produce stable coarse UI codes without provider payloads.

## Session And CSRF Rules

- Storefront uses Medusa cookie-session authentication and `credentials: include`.
- Session cookie is signed, `HttpOnly`, `SameSite=Lax`, path `/`, bounded by the
  configured TTL, and `Secure` for non-local HTTPS environments.
- JWTs and provider tokens are never written to local/session storage, React state
  beyond one completion call, or URLs. The callback completion route establishes
  the session server-side.
- OAuth state plus VK PKCE protect callback integrity. SameSite cookie policy,
  explicit `AUTH_CORS`/`STORE_CORS`, and non-simple mutating methods protect session
  operations. Do not use wildcard authenticated CORS.
- Logout destroys server session before the storefront clears customer state and
  the FT-003 local cart reference.
- Session restart loss is acceptable; it must only require reauthentication and
  must never delete customer, auth identity, or cart data.

## Identity And Account Rules

- Auth identity lookup key is provider ID plus stable provider entity ID.
- Customer creation requires provider-validated email. Optional names are
  normalized and length-bounded before the customer workflow.
- Repeat callback for the same provider identity resolves the existing linked
  customer and does not create a duplicate.
- Existing customer/auth identity with the same email but a different provider is
  a collision, not proof of account ownership. Return `auth_account_link_required`
  and create neither link nor session.
- Automatic email linking, unlinking, account merge/delete/recovery, and provider
  token retention are forbidden in MVP.

## Access Matrix

| Action | Guest | Authenticated customer | Guard |
|---|---|---|---|
| Start Google/VK login | allowed | allowed but may return current-session state | Provider allowlist and rate limit. |
| Complete matching callback | allowed with valid state | allowed with valid state | Provider validation and one identity/customer result. |
| Read current customer | denied | own customer only | Medusa customer actor. |
| Invoke FT-003 merge | denied | allowed | Existing merge ownership contract. |
| Use authenticated wishlist | denied | allowed when current-customer retrieval succeeds | Independent of cart-merge result. |
| Continue checkout/payment UI | denied | allowed after merge success/no-source | Storefront gate plus later backend actor guard. |
| Logout | no-op/allowed | allowed | Current session only. |

Feature capability rule: a successful `/store/customers/me` response proves the
current customer capability used by wishlist and similar authenticated features.
Cart merge is a separate checkout-readiness concern; `merge_blocked` blocks
checkout but does not revoke an otherwise valid customer session or wishlist access.

## Abuse Controls

- Apply a bounded single-process rate limiter to customer auth start and completion
  routes, keyed by provider plus a one-way hash of client IP. Limits and window are
  environment-configurable; map size is bounded and expired keys are removed.
- Return `429` with a stable safe error. Do not reveal whether an email/customer or
  provider identity exists.
- State is single-use and short-lived. Replayed callbacks fail without creating a
  session/customer or re-running cart merge.
- Do not log raw IP, state, code, `device_id`, tokens, provider payloads, session
  IDs, customer email, or full customer/cart objects. Coarse provider, outcome,
  status, and correlation ID are sufficient.
- The limiter is defense in depth for the single-process MVP. Any future
  multi-instance deployment must replace or supplement it at the shared edge; that
  is outside FT-004.

## Secret And Configuration Inventory

- Secret: Google client secret, VK service token/client secret, Medusa JWT secret,
  and cookie secret. Backend environment only; never `NEXT_PUBLIC_*`.
- Public/configurable: provider client IDs, backend/storefront origins, callback
  URLs, auth CORS origins, rate-limit window/count.
- `.env.example` uses placeholders. Missing secrets may disable live provider UAT
  locally but must fail startup when that provider is explicitly enabled.

## Verification Rules

- Automated tests use provider doubles and synthetic identities; no live provider
  mutation, production account, production secret, or production customer data.
- Security tests cover state replay/expiry/mismatch, VK PKCE mismatch, callback
  override/open redirect, same-email collision, missing email, rate limit, cookie
  flags, CORS, logout, sanitized logs/errors, and token non-persistence.
- T3 evidence must include a rollback/recovery note. Recovery is disable provider,
  rotate compromised secret, invalidate sessions by rotating cookie/JWT secret when
  required, and preserve durable customer/cart records for investigation.
