---
description: Design decisions for FT-004 OAuth login and checkout gate.
status: active
---
# FT-004 Decision Log

## 2026-07-16 - Reuse Medusa Auth and Customer Modules

- Decision: Medusa Auth/Customer Modules and PostgreSQL own provider identities,
  customer actors, and durable links.
- Consequence: no Auth.js/NextAuth, parallel user table, or custom identity store.

## 2026-07-16 - Session cookie for storefront authentication

- Decision: establish a signed `HttpOnly`, `SameSite=Lax` Medusa session after the
  backend callback completes.
- Consequence: OAuth and Medusa JWTs are not persisted in browser storage; restart
  may require login again without affecting durable customer/cart data.

## 2026-07-16 - Built-in Google and custom VK ID providers

- Decision: use Medusa's v2.16 Google provider and implement VK ID as one custom
  `AbstractAuthModuleProvider` with Authorization Code, state, and S256 PKCE.
- Consequence: provider behavior stays behind Medusa Auth routes while VK-specific
  token exchange and mapping remain isolated.

## 2026-07-16 - Backend callback completion

- Decision: provider redirect URLs target backend completion routes that validate
  identity, create/retrieve the customer, establish session, and redirect to one
  fixed storefront completion page.
- Consequence: provider codes/tokens are not left in the storefront URL and callback
  redirects cannot become open redirects.

## 2026-07-16 - No automatic email account linking

- Decision: provider plus stable provider subject identifies an auth identity;
  matching email from another provider is rejected rather than auto-linked.
- Consequence: account takeover by email collision is avoided; explicit account
  linking is deferred as a separately designed feature.

## 2026-07-16 - Cart merge before checkout continuation

- Decision: successful session establishment invokes the existing FT-003 merge
  handoff, and checkout continues only after success or when no guest cart exists.
- Consequence: auth can remain valid during a recoverable merge failure, but the
  buyer cannot silently continue with unresolved cart ownership.
