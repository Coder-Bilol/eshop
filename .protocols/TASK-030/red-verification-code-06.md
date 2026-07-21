# TASK-030 Independent Red Verification Code 06

## Findings

- HIGH session-authority/shared-browser failure: an expired Medusa session makes
  logout return `401`, but the storefront restores its old confirmed customer and
  skips cart cleanup. The UI therefore claims authenticated identity and retains a
  prior-customer cart reference after the backend has authoritatively denied the
  session.
- MEDIUM fail-closed redirect gap: a provider location ending in a bare `#` passes
  the no-fragment validator because WHATWG exposes an empty `hash`, then the client
  returns the location with the fragment delimiter intact.

- Role: Reviewer
- Mode: scheduler
- Tier: T3

SEMANTIC_VERDICT: semantic-fail

## Purpose Fit And False-success Assessment

- Purpose fit is incomplete. The implementation provides a small cookie-session
  customer boundary and all ordinary/covered races are deterministic, but it does
  not converge to backend truth when logout itself proves the session is absent.
  That is central to customer authority and shared-browser cleanup, not an optional
  edge behavior.
- TASK-043 substantively fixed the previously known malformed, repeated-encoding,
  decoded-name, and resource-bound query classes. The current focused and full suites
  are green, but neither covers an empty fragment delimiter or session-expired
  logout. Those omissions create false confidence over the exact T3 claims.
- The real Google and VK provider starts are compatible with the strict origin/path,
  callback, and bounded-query policy. The findings do not require broadening provider
  destinations or changing backend exchange behavior.

## Anti-goals, Scope, And Boundaries

- Anti-goals are respected: no callback backend logic, login/checkout page markup,
  cart merge semantic, order/payment behavior, parallel auth store, or browser token
  persistence was added by TASK-030/TASK-043.
- Runtime scope is contained to the task's storefront auth boundary and its existing
  public `CartProvider.clearLocalReference()` handoff. The broad dirty worktree was
  inspected without attributing separately indexed backend/auth/deployment changes
  to TASK-030.
- Auth/session boundary: FAIL for logout `401`. The Medusa middleware's authoritative
  no-session result is converted into retained local identity instead of guest.
- Cart boundary: PASS for successful DELETE and cleanup-only retry, but FAIL in the
  expired-session branch because the cleanup boundary is never called.
- Redirect boundary: PASS for real provider destinations and the TASK-043 hostile
  query matrix; FAIL for the explicit bare-fragment case.
- Storage/privacy boundary: PASS. Safe navigation state is versioned and one-shot in
  the covered runtime fault model, and no auth/provider token persistence was found.

## State, Operations, And Maintenance

- State/data consistency: no durable Auth, Customer, or cart data is mutated by the
  storefront controller. The defect is local state divergence from backend session
  truth plus retained browser cart state.
- Operational behavior: network/5xx logout failure correctly preserves confirmed
  state for retry; successful DELETE plus cart-cleanup failure correctly retries
  cleanup without another DELETE. Treating `401` identically to a transient 5xx is
  the incorrect branch because retry cannot restore an already absent session.
- Security/privacy: stale authenticated UI and retained shared-browser cart state are
  meaningful T3 concerns. The empty fragment has limited payload impact but proves
  the claimed exact URL boundary is not exact.
- Maintenance cost remains otherwise low. Both defects are local policy omissions,
  not evidence that the controller or parser needs a broader architecture.

## Hidden Assumptions And How This Could Still Be Wrong

- The controller assumes every logout error means backend session state is unknown.
  Medusa's installed middleware disproves that for `401`: it means there is no valid
  session actor for the DELETE request.
- The destination validator assumes `URL.hash === ""` means no fragment syntax.
  WHATWG also reports an empty hash for a trailing `#` while preserving it in `href`.
- Live provider UAT remains an external checkpoint, but installed provider source and
  synthetic provider execution establish the exact generated URLs without secrets.
  Live UAT would not exercise or excuse either reproduced local defect.
- Return-path one-shot guarantees rely on an in-memory tombstone if storage cannot be
  read or modified. A full browser-runtime restart during a persistent storage fault
  remains a residual limitation, but no replaying path is returned in the verified
  fault calls and this does not drive the verdict.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth-state.ts:140-146`,
  `apps/storefront/lib/auth.ts:323-344`, and missing focused regressions.
- Expected: every authoritative no-session result converges to guest and clears local
  shared-browser references; every fragment-bearing provider location fails closed.
- Observed: logout `401` restores stale customer/cart state, and `...?state=x#` is
  returned as an accepted provider location.
- Likely category: code|verification
- Recommended next action: distinguish confirmed session-invalid logout from
  retryable logout failure, add actual Medusa-401 cleanup coverage, reject a fragment
  delimiter before WHATWG normalization, and rerun both independent T3 stages.
- Requires replan: no

## Scheduler Recommendation

- REQUEST_CHANGES. Do not close TASK-030 or promote TASK-031, TASK-032, or TASK-039.
  Recommend scheduler remediation followed by functional PASS and semantic-pass;
  Reviewer performs no lifecycle or `/mb-sync` action.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
