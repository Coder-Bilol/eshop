---
description: Repeated fresh-context security review after documentation remediation.
status: complete
---
# TASK-MB-REVIEW S-04 — Security Re-review

## Verdict

REJECT. One current P1 access-boundary finding remains. Under the review request,
any open P0/P1 security or privacy issue blocks final scheduler approval.

## Findings

### P1 — Public production VPS still permits password authentication for `root`

The current deployment evidence records all of the following together:

- `DEPLOYMENT_process.md:47-67` says the `root` SSH configuration was not changed
  and reports the effective policy as `root: passwordauthentication yes`.
- The same current checkpoint says SSH is open in the public firewall and the VPS
  is serving the public deployment.
- `DEPLOYMENT.md:107-115` routes ordinary work through the dedicated key-only
  `eshop` user, but the authoritative runbook contains no hardening or verification
  step that disables password authentication for `root`.

Impact: compromise or guessing/reuse of the root password gives immediate control
of the host, production secrets, PostgreSQL data, media, backups, containers, and
TLS/auth configuration. The dedicated key-only deployment user does not mitigate a
parallel password-authenticated root path.

Required remediation: first establish and verify a non-lockout recovery path
(provider console and/or tested administrative public-key access), then disable
root password authentication with an SSH drop-in (`PermitRootLogin
prohibit-password` or `no`, plus password/keyboard-interactive authentication
disabled as appropriate). Validate with `sshd -t`, keep the current session open,
reload SSH, and prove the effective policy from a second session. Reconcile the
authoritative runbook and current handoff with the verified result. This review
does not authorize changing the live server.

## Remediation areas re-audited

### Auth SDD scope removal — acceptable

- The unsupported Telegram identity-label requirement was removed consistently
  from the PRD, RTM, EP-002, FT-004, auth runtime/security/state specs, and the
  FT-004 feature design. Active Memory Bank and product-source searches found no
  remaining Telegram or identity-label behavior.
- Removal did not weaken the security boundary: Medusa customer actor/session is
  still authoritative; callback state/PKCE, fixed redirects, signed `HttpOnly`
  cookies, explicit CORS, collision fail-closed behavior, logout cleanup, rate
  limits, and token/PII non-persistence remain normative.
- Targeted `auth-client`, `auth-state`, `auth-ui`, and `checkout-auth-gate` suites
  passed, including stale-session/logout and PII/token non-disclosure cases.

### FT-007 idempotency and expiry mapping — acceptable

- Native/global expiry is now consistently `canceled`; FT-007
  `checkout_state: expired` is a bounded timeout-reason projection, not a second
  peer order status.
- Idempotency lookup remains state-independent for the persisted key. Actor, cart,
  request fingerprint, native status, expiry, and reservation guards fail closed
  before mutation; terminal same-key replay returns stable `409`.
- TASK-053 and the repeated FT-007 feature review record real PostgreSQL/browser
  evidence that expired replay creates no replacement order or reservation. The
  local pending-order source/transport/privacy suite also passed in this review.

### Deployment backup wording — acceptable for this scheduler gate

- `system-architecture.md`, `spec-backbone.md`, and `DEPLOYMENT.md` now distinguish
  PostgreSQL structured data from persistent product-media blobs and define the
  matching database dump plus versioned media archive as one recovery set.
- The runbook requires both members to be copied to external storage and restored
  together when uploaded media exists, with `/static` verification before traffic
  resumes. This closes the prior database-only wording contradiction.
- External target selection, protected/encrypted copy, retention/access policy,
  and a non-production full-set restore rehearsal remain production-launch gates.
  They are already tracked in deployment planning and must be completed before
  customer/order data makes the deployment production-ready; they do not erase the
  separate current SSH P1 above.

## Secrets, privacy, and access evidence

- Tracked env-like files are example templates plus historical redacted scan
  artifacts; the templates contain explicit local/fake placeholders.
- A redacted assignment scan found no private-key markers or AWS-style access-key
  marker, and `.gitignore` excludes real root/app `.env` files.
- Production Compose keeps PostgreSQL off host ports and binds backend/storefront
  only to loopback behind Caddy. Secret env files are documented as mode `600`;
  the secrets directory is mode `700`.
- Pending-order responses and UI use stable sanitized errors and do not promote
  cart IDs, checkout fields, prices, tariffs, inventory IDs, order state, or
  browser auth state to server authority.

## Checks run

- `node scripts/mb-lint.mjs` — PASS, 138 files.
- `node scripts/mb-doctor.mjs --strict --json` — PASS, 0 errors, 0 warnings;
  53/53 tasks `done`.
- `node apps/storefront/src/test-runner.cjs auth-client auth-state auth-ui checkout-auth-gate`
  — PASS.
- `node -e "require('./apps/storefront/src/pending-order.test.cjs').run()"` — PASS.
- Redacted repository credential-assignment scan and private-key marker scan — no
  tracked real secret identified.

## Evidence checked

Constitution; MBB; spec backbone/index; invariants; API and boundary contracts;
auth architecture/security/state/feature specs; FT-007 runtime/API/data/state
specs and implementation guards; TASK-053 functional/adversarial evidence; final
FT-007 semantic review; `DEPLOYMENT.md`, `DEPLOYMENT_HANDOFF.md`, current sections
of `DEPLOYMENT_process.md`, Compose, env templates, and Medusa configuration;
historical S-04 docs-02 and the bounded remediation report.

VERDICT: REJECT
