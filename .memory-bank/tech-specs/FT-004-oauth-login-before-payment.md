---
description: Feature-level SDD hub for FT-004 OAuth login and checkout authentication gate.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/features/FT-004-oauth-login-before-payment.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/auth-runtime.md
  - .memory-bank/contracts/auth-session-security.md
  - .memory-bank/states/customer-auth-session.md
---
# FT-004 OAuth Login Before Payment

## Scope

FT-004 owns Google OAuth and VK ID customer login, first-login customer creation,
Medusa session establishment, logout, authenticated customer state, the FT-003
post-auth cart-merge invocation, and the storefront checkout authentication gate.

FT-004 does not own checkout fields, order creation, payment initiation, payment
status, wishlist behavior, provider account management, password login, or a
custom identity database.

## Normative Design Surface

- [.memory-bank/architecture/auth-runtime.md](../architecture/auth-runtime.md):
  components, data flow, provider integration, storage, and runtime decisions.
- [.memory-bank/contracts/auth-session-security.md](../contracts/auth-session-security.md):
  endpoint behavior, trust boundaries, callback validation, sessions, redirects,
  privacy, account collision, and abuse controls.
- [.memory-bank/states/customer-auth-session.md](../states/customer-auth-session.md):
  login, callback, customer, session, merge, checkout-gate, and logout states.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md),
  [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), and
  [.memory-bank/contracts/cart-access-security.md](../contracts/cart-access-security.md):
  global boundaries and the existing post-auth cart handoff.

## Design Area Matrix

| Area | Status | Authoritative source |
|---|---|---|
| Architecture Specification | complete | `architecture/auth-runtime.md` |
| Component Contract | complete | `architecture/auth-runtime.md` |
| API Contract | complete | `contracts/auth-session-security.md` |
| Event Contract | not_applicable | Login and merge are synchronous HTTP/workflow operations; no custom event or queue. |
| Data Contract | complete | `contracts/auth-session-security.md` |
| Data/Persistence Specification | complete | `architecture/auth-runtime.md`; Medusa Auth/Customer PostgreSQL models are reused, with no custom identity table. |
| State Specification | complete | `states/customer-auth-session.md` |
| Security/Access Contract | complete | `contracts/auth-session-security.md` |
| Deployment/Operations | complete | `architecture/auth-runtime.md`; environment secrets and callback registration are explicit, live credentials are a UAT input. |

## Required Outcomes

- A buyer can start and complete Google or VK ID login through Medusa-owned auth
  routes and supported providers.
- First login creates one Medusa customer from validated provider identity data;
  later login with the same provider identity retrieves that customer.
- A signed `HttpOnly` Medusa session cookie is the storefront credential. OAuth
  access/refresh/ID tokens and Medusa callback JWTs are not browser-persisted.
- Existing FT-003 guest cart state is merged after session establishment. Checkout
  stays blocked while merge is unresolved.
- Guests are routed to login before checkout/payment continuation. Backend payment
  endpoints introduced by later features must independently require customer actor
  context; the storefront gate is not an authorization boundary.
- Logout destroys the Medusa session and clears the local active cart reference so
  a shared browser does not expose the prior customer's cart.

## Account Policy

- Provider identity is keyed by provider plus stable provider subject/user ID, not
  by display name or email.
- Email is required to create a Medusa customer. Missing or untrusted email fails
  closed without creating identity/customer linkage.
- A matching customer email from another provider is not sufficient proof for
  linking. Automatic cross-provider linking is forbidden in MVP.
- Explicit account linking, provider unlinking, account deletion, and account
  recovery are outside FT-004 and require a later security design.

## UX Contract

- Login presents Google and VK ID as equal supported choices.
- Provider cancel/failure returns a sanitized recoverable error and preserves the
  guest cart reference.
- Login completion shows a bounded processing state while customer/session setup
  and optional cart merge finish; duplicate callback processing must not create a
  second customer.
- A safe relative return path may be kept in `sessionStorage` under a versioned key.
  Only one-leading-slash internal paths are accepted; schemes and `//` are rejected.
- Provider completion redirects to one configured storefront completion path and
  removes provider query parameters from the browser URL.
- An authenticated customer may retry a failed cart merge. Checkout does not
  continue until the merge succeeds or no guest cart exists.

## Anti-goals

- No Auth.js/NextAuth, parallel user table, custom session store, Redis, identity
  microservice, or direct storefront provider token exchange.
- No JWT, OAuth token, provider secret, customer email, or cart payload in browser
  local storage, callback redirect parameters, logs, or test evidence.
- No automatic account linking by email and no admin/provider login changes beyond
  preserving Medusa Admin `emailpass` access.
- No checkout form, order, inventory, payment, wishlist, or production deployment.

## Verification Targets

- Configuration tests prove only `google` and `vkid` are allowed for customer auth
  while admin users retain `emailpass`.
- Provider contract tests prove Google configuration and VK ID state, PKCE,
  `device_id`, token exchange, user-info mapping, and token non-persistence.
- Backend/PostgreSQL tests prove first login, repeat login, durable customer/auth
  identity linkage, same-email collision rejection, single-use/expired state,
  session establishment/destruction, sanitized failures, and bounded rate limits.
- Browser E2E with local provider doubles proves both provider paths, callback URL
  cleanup, guest cart merge, retry behavior, checkout gate, safe return path, and
  logout cart-reference cleanup.
- T3 closure follows [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md),
  including per-task semantic verification, human checkpoint, and recovery note.

## Open Questions

None blocking implementation. Live Google/VK application credentials and exact
registered local/staging callback URLs are external UAT inputs. Mocked provider
verification is mandatory before any live test; live secrets are never committed.
