---
description: FT-004 authentication runtime architecture and provider integration boundaries.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/tech-specs/FT-004-oauth-login-before-payment.md
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/contracts/auth-session-security.md
---
# Authentication Runtime Architecture

## Runtime Components

| Component | Responsibility | Constraint |
|---|---|---|
| Next.js auth UI/state | Login choices, safe return path, customer/session status, completion UI, logout, checkout gate. | No provider secrets or browser-persisted tokens. |
| Medusa Auth HTTP routes | Start Google/VK authentication and expose the configured providers. | Customer providers are allowlisted; admin `emailpass` remains available. |
| Google provider | Medusa v2.16 built-in `@medusajs/medusa/auth-google`. | Callback URL and credentials come from backend environment only. |
| VK ID provider | One custom provider extending `AbstractAuthModuleProvider` and registered with `ModuleProvider(Modules.AUTH, ...)`. | Authorization Code + PKCE, `state`, `device_id`, server-side exchange, minimal scopes. |
| Provider completion route | Validate callback, create/retrieve customer, establish session, redirect to fixed storefront completion path. | No open redirect, raw token response, or email-based auto-link. |
| Medusa Auth/Customer Modules | Durable auth identity and customer ownership. | PostgreSQL-backed; no parallel identity/customer tables. |
| Medusa session middleware | Signed `HttpOnly` storefront session cookie. | Session is ephemeral; restart may require login again and must not affect customer/cart data. |
| FT-003 merge handoff | Merge the active guest reference after authentication. | Backend chooses target; checkout waits for success/no-source. |

## Configuration

- Override the Medusa Auth Module providers with existing `emailpass`, built-in
  `google`, and custom `vkid` provider entries.
- Set `authMethodsPerActor.user` to `emailpass` and
  `authMethodsPerActor.customer` to `google,vkid`. Do not expose customer
  `emailpass` in MVP.
- Use backend-only environment values for Google client ID/secret/callback URL and
  VK client ID/service token/callback URL. `.env.example` contains placeholders.
- Use `cookieOptions.httpOnly: true`, `sameSite: "lax"`, a bounded TTL, and
  `secure: true` outside local HTTP development. Keep CORS origins explicit.
- Use the existing single-process Medusa session store for MVP. Session loss on
  restart logs the customer out; Auth/Customer/cart records remain durable in
  PostgreSQL. Redis is not introduced by FT-004.

## Provider Flow

1. Storefront stores a validated internal return path in session storage and calls
   `/auth/customer/{google|vkid}` with credentials included.
2. Medusa/provider creates opaque, expiring server-side state and returns an
   allowlisted provider location.
3. VK also creates a per-attempt PKCE verifier in server-side state and sends only
   its S256 challenge to VK ID. Google uses the built-in provider state handling.
4. Provider redirects to the backend completion route for that provider.
5. Completion validates state and provider response. VK requires `code`, `state`,
   and `device_id`, exchanges server-side, verifies returned state, and retrieves
   minimum customer identity data.
6. Medusa Auth identity is created/retrieved by provider subject. If it has no
   customer actor, the supported customer-account workflow creates one from the
   validated email and links it to the auth identity.
7. The route writes customer actor context to the Medusa session and redirects to
   the fixed storefront `/auth/complete` path with only provider and coarse status.
8. Storefront retrieves `/store/customers/me`, invokes FT-003 merge when a guest
   reference exists, then consumes the safe return path.

## VK Provider Mapping

- Provider ID: `vkid`.
- Entity ID: stable VK ID `user_id`; never email, display name, or access token.
- Requested data: minimum profile plus email needed for Medusa customer creation.
- Stored user metadata: normalized email and optional first/last name only.
- Access, refresh, and ID tokens exist only during callback processing and are
  discarded after identity validation. They are never written to Auth metadata,
  customer metadata, logs, evidence, browser state, or URLs.
- Provider/network errors map to sanitized auth errors; raw payloads are not
  returned to storefront or logged.

## Persistence And Data Ownership

- Medusa Auth Module PostgreSQL records own auth identity/provider identity.
- Medusa Customer Module PostgreSQL records own the customer actor and email.
- The existing Medusa account workflow owns the durable auth-to-customer link.
- Express session state is authentication cache, not durable customer truth.
- Browser state owns only a versioned safe return path and the FT-003 opaque cart
  reference. Neither proves identity.
- No custom migration is required for FT-004. Backend acceptance must still prove
  read/write and restart-safe Auth/Customer linkage through PostgreSQL.

## Runtime And Failure Boundaries

- Provider credentials are optional for ordinary local startup but required when a
  real provider is enabled/tested. Missing enabled-provider configuration fails
  startup with a sanitized message.
- Provider doubles are the default automated test boundary. Live provider tests
  are manual/staging-only and never use production accounts or secrets.
- Completion is retry-safe at the account level: an existing provider identity
  resolves its linked customer instead of creating another one.
- A same-email identity from another provider fails closed. No partial link or
  session remains.
- Login can succeed while cart merge fails; the session remains valid, source cart
  remains recoverable, and checkout stays blocked until retry/no-source.

## Not Applicable

- Custom event bus, queue, webhook, worker, cache, custom auth database, and custom
  token refresh persistence are not applicable to FT-004.
