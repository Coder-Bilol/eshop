# TASK-030 Independent Functional Verification Code 04

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Run: operator-approved recovery 1/1 beyond retry 2/2
- Packet: `PACKET-TASK-030-R8` (`ready`), with matching task SHA-256

VERDICT: FAIL

## Findings

- HIGH: callback destination validation is origin-only rather than exact and
  provider-bound. `hasUnsafeNavigationParameter()` in
  `apps/storefront/lib/auth.ts:339-369` accepts a Google authorization location with
  `redirect_uri=https://backend.test/arbitrary`, with the VK completion route, or
  with an added callback query. The linked security contract requires exact
  backend callback URLs per provider, and the recovery decision requires callback
  abuse to fail closed. The focused test checks external and nested callbacks but
  omits arbitrary same-backend and cross-provider callback paths.
- MEDIUM: explicit default provider ports are accepted. `new URL()` normalizes
  `https://accounts.google.com:443` and `https://id.vk.com:443` before the
  `location.origin` comparison at `apps/storefront/lib/auth.ts:317-323`, so both
  inputs pass and are returned without the port. This does not satisfy the explicit
  recovery criterion to reject port-bearing provider destinations; the focused
  suite checks neither default nor non-default ports.
- MEDIUM: return-path-like fragment data bypasses the navigation-parameter guard.
  `https://accounts.google.com/o/oauth2/v2/auth#return_url=https://attacker.example`
  is accepted because only `location.searchParams` is inspected. Real provider
  starts have no fragment, so accepting this value is unnecessary and contradicts
  the requested fail-closed callback/return-path policy.

## Functional Results

- PASS: the actual installed Medusa Google provider generated
  `https://accounts.google.com/o/oauth2/v2/auth` with the configured Google
  `/complete` callback, and `startProviderLogin("google")` accepted it.
- PASS: the actual project VK provider generated `https://id.vk.com/authorize` with
  the configured VK `/complete` callback, and `startProviderLogin("vkid")`
  accepted it. The VK provider smoke also passed.
- PASS: unrelated origins, lookalike subdomains, non-default ports, URL userinfo,
  provider HTTP downgrade, protocol-relative locations, external callbacks,
  nested callback/return query parameters, and query return-path parameters were
  rejected by independent probes.
- FAIL: the exact destination policy is incomplete for default ports, exact
  callback path/provider binding, callback query variants, and return-like
  fragments. Arbitrary provider paths without an unsafe navigation parameter stay
  on an operator-approved HTTPS origin and were not independently treated as an
  origin escape; arbitrary callback paths are the proven unsafe path case.
- PASS: all previously corrected state behavior remains green: successful logout
  dominates stale current-customer responses, restore during logout joins the
  terminal result, concurrent logout is single-flight, failed logout preserves the
  last confirmed customer, and `401` resolves to `guest`.
- PASS: return-path consume is one-shot across read/removal failures. Confirmed
  DELETE precedes cleanup; cart cleanup failure remains `logging_out`, and retry
  performs cleanup without another DELETE before reporting `guest`.
- PASS: every auth request uses `credentials: "include"`; no Authorization header,
  JWT/provider token, customer payload, or auth `localStorage` persistence was
  found. No-token/no-session behavior remains sanitized and deterministic.

## Context And Scope Gates

- The authoritative task exists, remains `in_progress`, and has `tier: T3`.
  Scheduler owns lifecycle and dependent promotion.
- R8 source hash matches the authoritative task exactly:
  `sha256:1c0c3a09cf1a43ef61b7e339cb20cb913e11801ad3ede69cf37be9e42bea934f`.
- Task, packet R8, operator decision/bug, linked FT-004 architecture/security/state
  specs, code-04 implementation diff/evidence, and every earlier functional and
  semantic finding were checked.
- Recovery code scope is limited to the auth client and focused test. No backend
  provider/callback edit, page/checkout design, cart merge semantic, payment/order,
  token storage, lifecycle, or sync change is attributed to code-04.

## Commands And Evidence

- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test -- auth-state`.
- PASS: `npm --workspace apps/storefront run test`, all eight storefront suites.
- PASS: `npm --workspace apps/storefront run typecheck`.
- PASS: `npm --workspace apps/storefront run build`.
- PASS: `npm --workspace apps/backend run smoke:auth-vkid`.
- PASS: `node scripts/mb-lint.mjs`, 118 files.
- PASS: `node scripts/mb-doctor.mjs --strict`, zero errors/warnings.
- PASS: `git diff --check`, with existing line-ending warnings only.
- PASS: independent installed-provider start probe for Google and VK.
- FAIL: independent hostile destination matrix reproduced accepted default ports,
  arbitrary/cross-provider backend callbacks, callback query variants, and a
  return-like fragment.

## Failure / Recommendation

- Status: failed
- Where: `apps/storefront/lib/auth.ts:309-369` and
  `apps/storefront/src/auth-client.test.cjs:133-170`.
- Expected: configured backend origin plus only the exact approved HTTPS Google/VK
  authorization destinations, with ports, credentials, HTTP, unsafe callback and
  return-path variants rejected.
- Observed: real Google/VK values work and broad origin attacks fail, but the four
  destination classes above remain accepted.
- Likely category: code|verification
- Recommended next action: scheduler should not close `TASK-030` or promote
  `TASK-031`, `TASK-032`, or `TASK-039`; route an owner-reviewed correction and
  repeat independent `/verify` plus `/red-verify`.
- Requires replan: yes

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
