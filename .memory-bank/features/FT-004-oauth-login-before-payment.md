---
description: Feature FT-004 - OAuth login before payment.
status: draft
lifecycle: verified
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-004-oauth-login-before-payment.md
  - .memory-bank/architecture/auth-runtime.md
  - .memory-bank/contracts/auth-session-security.md
  - .memory-bank/states/customer-auth-session.md
---
# FT-004 OAuth Login Before Payment

## Use Cases

- Buyer logs in through Google OAuth.
- Buyer logs in through VK ID.
- Checkout blocks payment until buyer is authenticated.
- Authenticated buyer sees a trusted identity label in the top-right storefront navigation.

## Acceptance Criteria

- Covers REQ-010, REQ-011, REQ-012, and the planned REQ-031 authenticated identity label.
- Google OAuth login is available.
- VK ID login is available.
- Guest buyer cannot proceed to payment until authenticated.
- When a trusted Telegram username is available, it is shown; otherwise the customer's email is shown.

## Edge Cases & Failure Modes

- OAuth provider error or canceled login.
- Existing user returns during checkout.
- Login succeeds while guest cart exists and must be merged.
- Authenticated customer has no trusted Telegram username, or the username is malformed/unavailable.

## Test Strategy Pointers

- Integration/e2e: OAuth login flows with provider mocks where possible.
- E2E: payment gate requires authenticated user.

## Constraints And Invariants

- Medusa Auth and Customer Modules/PostgreSQL own identity and customer truth.
- Storefront authentication uses a Medusa session cookie; provider or Medusa JWTs
  are never persisted in browser storage.
- Google uses Medusa's built-in provider; VK ID uses one custom Medusa Auth Module
  Provider with `state` and PKCE.
- Provider callbacks create or retrieve one Medusa customer before establishing a
  session. Matching email alone never links two provider identities.
- Successful login invokes the FT-003 merge handoff before checkout continues.
- Provider secrets and tokens never enter storefront bundles, URLs after callback
  completion, logs, task evidence, or cart state.
- The top navigation consumes only a server-returned authenticated customer identity
  projection. It never reads Telegram username or email from query parameters,
  browser storage, or unauthenticated client input.

## Verification Targets

- Mocked provider integration covers Google and VK ID start, callback, cancel,
  invalid state, expired state, missing email, and provider failure.
- PostgreSQL integration proves durable auth identity/customer ownership and safe
  same-email collision behavior.
- Browser E2E proves session-cookie login, post-auth cart merge, checkout gate,
  logout cleanup, and safe return-path handling without live provider secrets.
- Live local/staging provider UAT is a human checkpoint when credentials and
  registered callback URLs are available; their absence does not block mocked
  implementation.
- Browser E2E verifies the authenticated top-right label, Telegram username
  precedence, email fallback, logout clearing, and guest non-disclosure.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## Normative Inputs

- [.memory-bank/constitution.md](../constitution.md)
- [.memory-bank/invariants.md](../invariants.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-004`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: auth boundary, identity ownership, privacy/security, callback/config setup.
- Auth work is high-risk and likely T3 under tier policy.
- Use standalone `/spec-improve FT-004` only for repair/refresh without creating or updating task records.

## Feature Design

- Status: complete.
- Feature hub: [.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md](../tech-specs/FT-004-oauth-login-before-payment.md).
- Runtime: [.memory-bank/architecture/auth-runtime.md](../architecture/auth-runtime.md).
- Security and API contract: [.memory-bank/contracts/auth-session-security.md](../contracts/auth-session-security.md).
- Lifecycle: [.memory-bank/states/customer-auth-session.md](../states/customer-auth-session.md).
- Blocking design questions: none.
- Operational gap: live Google/VK credentials and registered callback URLs are
  required only for human provider UAT, not for implementation with mocks.
- REQ-031 is planned follow-up scope. Telegram authentication/provider support is
  not currently implemented by FT-004 and requires a separate provider design or
  an existing trusted identity source before this requirement can be verified.
