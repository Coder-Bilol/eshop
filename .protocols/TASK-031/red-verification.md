# TASK-031 Independent Red Verification

## Findings

- HIGH: The implementation creates false success across the FT-004/FT-003 boundary.
  A durable merge response plus failed/empty target-cart restore is collapsed to
  `merged`, then to `authenticated_ready`, even though CartProvider reports that the
  active cart is not ready. This violates the only-authenticated-ready continuation
  invariant and can silently continue checkout without preserved cart continuity.
- MEDIUM: The focused suite is structurally unable to prove concurrency safety. It
  does not mount React and does not challenge auth loss while merge is pending,
  stale fulfillment after failure, unmount/remount, or real double clicks. The
  completion operation token is advanced only when a merge starts, not when auth
  becomes invalid or the component unmounts, leaving stale-success risk.

- Role: Reviewer
- Mode: scheduler
- Tier: T3

SEMANTIC_VERDICT: semantic-fail

## Purpose Fit And False-success Assessment

- Google/VK login choices, callback cleanup, sanitized error copy, current-customer
  retrieval, no-source flow, ordinary merge success, recoverable rejection/retry,
  and one-shot return-path mechanics fit the intended design in their covered happy
  paths.
- The task nevertheless fails its core purpose because cart continuity is not based
  on the complete existing CartProvider handoff. Ignoring `handoff.state` converts a
  backend/restore inconsistency into buyer-visible success and checkout navigation.
- This is a demonstrated semantic break, not only missing evidence. The hostile
  probe used the exported production resolver and handoff shapes that the public
  CartProvider type permits.

## Cross-boundary Assessment

- Auth/session truth: current-customer success is required before merge begins, but
  a later cart readiness failure does not prevent `authenticated_ready`.
- Cart state/data consistency: the target reference may have been cleared by a 404
  restore or retained with `backend_error`, while completion still announces that
  the saved cart is ready.
- Checkout boundary: return-path consumption is syntactically gated to
  `authenticated_ready`, but the state is assigned from incomplete evidence and so
  the gate fails in substance.
- Privacy/security: callback query/fragment values, raw errors, tokens, and customer
  PII are sanitized or not rendered in the reviewed paths. No provider secret or
  token storage was found.
- Scope/autonomy: implementation stayed within the allowed storefront UI/test
  boundary and reused existing AuthProvider/CartProvider APIs. No backend, merge
  semantics, checkout, order, inventory, payment, or Medusa Core drift was found.
- Operations/recovery: recoverable merge rejection keeps session/source and can be
  retried. The unhandled restore-error/empty state instead creates false readiness,
  reducing observability and bypassing recovery UI.
- Maintenance: the UI remains small, but helper-only/source-regex tests give false
  confidence around the most stateful behavior.

## Anti-goals And Hidden Assumptions

- Anti-goals concerning backend merge changes, checkout/payment scope, provider
  payload rendering, and customer PII are respected.
- Hidden assumption: any non-null merge response implies the CartProvider state is
  ready. The provider contract does not guarantee this; it explicitly returns both
  `result` and `state` after a separate restore operation.
- Hidden assumption: an operation ID that changes only on merge start is sufficient
  for auth loss and unmount. It is not invalidated by those transitions.
- Live provider UAT and full TASK-034 browser acceptance remain future gates, but
  they do not excuse the local false-ready defect.

## Critical T3 Assessment

- Security/privacy checks pass for rendered data, callback cleanup, and token/PII
  non-persistence.
- Runtime failure-mode check fails because target restore failure is classified as
  success and may navigate into checkout.
- No migration, irreversible production write, payment mutation, or durable deletion
  belongs to this task.
- Human checkpoint and rollback/recovery markers are present and credible, but they
  cannot make a semantically failing implementation closure-eligible.

## How This Could Still Be Wrong

- Mounted browser evidence could reveal additional duplicate-request, stale-promise,
  focus, or responsive issues because the focused suite does not render components.
- A future CartProvider contract could guarantee ready state on every non-null result,
  but the current implementation demonstrably does not: it returns the result after
  a separately caught state-controller restore.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/components/auth-completion.tsx:78-83,152-185`
- Expected: only a successfully restored/adopted cart or genuine no-source handoff
  may reach `authenticated_ready` and consume the return path.
- Observed: non-null result reaches readiness even with `backend_error` or `empty`
  handoff state.
- Likely category: code
- Recommended next action: fix readiness classification and add mounted concurrency,
  auth-loss, unmount, success/no-source, restore-failure, and retry tests; rerun both
  T3 verification passes.
- Requires replan: no

## Closure Recommendation

- REQUEST_CHANGES. Recommend scheduler keep TASK-031 `in_progress` or apply its
  failure/retry policy, leave dependents unpromoted, and rerun `/verify TASK-031` and
  `/red-verify TASK-031` after remediation.
- Reviewer did not close/fail/block/promote lifecycle records, execute a fix, or run
  `/mb-sync`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
