# TASK-027 Independent Red Verification

Role: Reviewer. Mode: scheduler. Tier: T3. Date: 2026-07-18.

SEMANTIC_VERDICT: semantic-fail

## Hostile Hypotheses And Results

- Callback override bypass: not reproduced. The exact static application guard is
  sorted before Medusa's parameterized auth middleware and route handlers, and
  rejects both GET and POST body/query `callback_url` input.
- Admin auth weakening or customer password exposure: not found. Actor allowlists
  preserve user `emailpass` and permit only customer `google,vkid`.
- Provider secret disclosure on configuration failure: not found in focused
  synthetic checks; failure names the missing variable/provider without printing
  a supplied synthetic value.
- False secure-session success: confirmed. Staging and other non-production HTTPS
  configurations receive a cookie with `Secure=false` because the implementation
  keys solely on `NODE_ENV === "production"`.
- Session forgery after deployment misconfiguration: confirmed. Missing production
  JWT/cookie secrets silently select known repository literals rather than failing
  startup, making the signed credential baseline unsafe.

## Substance Assessment

- Purpose fit: failed. Provider registration is sound, but the task's purpose is a
  secure provider/session baseline; known signing secrets and an insecure HTTPS
  cookie mode defeat that outcome.
- Anti-goals and autonomy: passed. No callback UI/exchange, customer password auth,
  live credentials, Medusa Core, VK provider implementation, checkout, order, or
  payment behavior was added.
- Cross-boundary impact: callback enforcement stays at the approved application
  middleware boundary. The session defects affect every later FT-004 slice and
  should block dependent promotion.
- State/data consistency: no migration or durable-data mutation was introduced.
- Operations/recovery: the existing rollback note is credible: disable providers,
  revert scoped config/middleware changes, rotate provider/session secrets when
  exposed or compromised, and preserve durable Auth/Customer/cart records.
- Maintenance: the narrow guard is simple. Environment security rules need one
  explicit fail-closed policy rather than relying on permissive literals.

## How This Could Still Be Wrong

No live-provider or full HTTP server UAT was run, by design. Later provider and
acceptance tasks still own callback completion, VK behavior, PostgreSQL identity
linkage, rate limiting, and browser flows; none can compensate for the two current
session configuration failures.

## Escalation Path

Request implementation changes within TASK-027 scope, rerun all packet gates, and
repeat independent functional and semantic verification. Scheduler should keep the
task `in_progress` or apply its failure policy and must not promote dependents.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
