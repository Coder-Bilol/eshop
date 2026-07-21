# TASK-030 Independent Red Verification Code 03

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: final bounded retry 2/2

SEMANTIC_VERDICT: semantic-fail

## Findings

- HIGH purpose-fit failure: the storefront cannot start the configured VK ID flow.
  The backend provider deliberately returns `https://id.vk.com/authorize`, Medusa
  forwards that `location`, and the storefront rejects it because it is not the
  Medusa backend origin. A safe origin check has been optimized into a rule that
  excludes the actual trusted provider boundary.

## Hostile Assessment

- Purpose fit: failed. The session/customer state boundary is now deterministic for
  the reviewed fault orderings, but a buyer cannot reach the VK provider through the
  public `startProviderLogin()` path, so the required Google/VK login-start outcome
  is not achieved.
- False-success risk: confirmed. The focused auth-client suite uses synthetic
  backend-origin `location` values. It proves the implemented predicate, not
  compatibility with the configured Medusa providers. Full tests, typecheck, build,
  lint, and doctor remain green while the real VK cross-boundary value is rejected.
- Final retry fixes: substantively correct. Storage read faults are one-shot, failed
  logout preserves the last confirmed customer, and stale restore completion cannot
  overwrite the recoverable failed-logout state.
- Concurrency/state: earlier successful-logout precedence, restore joining,
  single-flight logout, cleanup-only retry, `401 -> guest`, and confirmed-state
  retention all passed independent probes.
- Cart boundary: corrected. Cart cleanup runs only after session DELETE success; a
  cleanup failure does not report guest and retry does not repeat DELETE.
- Storage/privacy: corrected for consume replay. No browser auth token, provider
  token, Authorization header, customer payload, or parallel identity store was
  found.
- Redirect/security: unrelated origins are rejected, but the trust model is
  semantically wrong because it equates provider authorization origin with backend
  origin. Security hardening cannot remove the required provider capability.
- Anti-goals/autonomy: respected. No callback backend, login/checkout markup, cart
  merge semantics, order/payment behavior, token persistence, lifecycle, or sync
  work was added by TASK-030 retry 2 or this Reviewer pass.
- Data/operations: no migration or durable customer/cart mutation belongs to this
  task. The existing rollback/recovery note is credible: disable providers or remove
  the storefront auth mount, rotate compromised secrets/sessions when required, and
  preserve durable records.
- Maintenance: keeping the current mock contract will cause future UI/E2E tasks to
  diagnose provider-start failures outside their ownership and may encourage unsafe
  ad hoc bypasses of the origin check.

## Hidden Assumptions And How This Could Still Be Wrong

- The implementation assumes Medusa rewrites provider authorization locations to
  its own origin. Installed Medusa route code forwards `location` unchanged, and the
  configured VK provider explicitly emits the VK authorization origin.
- A provider-specific allowlist must be reconciled with actual Google and VK
  locations. Accepting arbitrary HTTP(S) remains invalid; accepting only the backend
  origin is also invalid.
- Real-browser acceptance remains assigned to TASK-034, but later E2E cannot make a
  broken TASK-030 client boundary closure-eligible.
- Additional browser-only failures may still exist because no TASK-030 real-browser
  flow was run; this residual risk is secondary to the reproduced start failure.

## Critical T3 Assessment

- Security/privacy: token and customer-data non-persistence passed; origin policy
  fails capability correctness rather than exposing an external open redirect.
- Runtime/production: VK login start deterministically fails before navigation in
  every environment where backend and VK origins differ.
- Irreversible/data-loss: none introduced; no migration or durable deletion exists.
- Recovery evidence: present and credible in `.protocols/TASK-030/handoff.md`.
- Human checkpoint evidence: exact marker is present in the implementation handoff.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth.ts:290-302`,
  `apps/backend/src/modules/auth-vkid/service.ts:118-127`, and the installed Medusa
  auth route `route.js:17-20`.
- Expected: reject unrelated destinations while allowing the configured Google/VK
  provider authorization origins returned by Medusa.
- Observed: the real VK authorization location is rejected with
  `auth_invalid_response`.
- Likely category: code|verification
- Recommended next action: scheduler records final TASK-030 failure and keeps
  dependents unpromoted; any continuation requires separately owned correction and
  cross-boundary provider-origin tests.
- Requires replan: yes
- Retry budget: exhausted (`2/2`).

Scheduler recommendation: `REQUEST_CHANGES`; recommend `status: failed`. Reviewer
did not fix, execute, sync, close, fail, block, or promote lifecycle state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
