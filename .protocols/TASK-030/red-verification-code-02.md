# TASK-030 Independent Red Verification Code 02

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: bounded retry 1/2

## Findings

- MEDIUM state-consistency failure: the controller discards a previously confirmed
  customer when restore and a failed logout overlap, then suppresses the successful
  restore response and remains indefinitely in `customer_resolving`. The state no
  longer represents either the still-valid backend session or a terminal failure.
- MEDIUM one-shot navigation failure: a transient `sessionStorage.getItem` error
  fails closed only for that call. Recovery exposes the old envelope on a later
  consume, so the stored continuation is not truly one-shot across storage faults.

## Hostile Assessment

- Purpose fit: incomplete. The retry fixes successful-logout stale responses,
  duplicate DELETEs, post-DELETE cleanup retry, and destination-origin enforcement,
  but the boundary is still non-deterministic on a specified failure/retry path.
- False-success risk: confirmed. Focused tests report both deterministic logout
  failure recovery and one-shot storage behavior, but exercise only serial DELETE
  failure and `removeItem` failure. Green tests do not cover the two reproduced
  cases above.
- Anti-goals and autonomy: respected. No provider callback backend, page markup,
  checkout/payment, cart merge semantic, token persistence, or forbidden runtime
  boundary was added. Reviewer writes are evidence artifacts only.
- Auth/session boundary: failed DELETE correctly performs no local cleanup, but it
  must retain the last confirmed authenticated state. Capturing a transient
  `customer_resolving` snapshot violates the linked failure rule and can leave UI
  indefinitely blocked despite a still-valid session.
- Successful logout precedence: corrected. Reads started before logout are stale;
  reads requested during logout join it; concurrent logout is single-flight.
- Cart boundary: corrected for the reviewed post-DELETE fault. Cleanup failure is
  visible, customer identity is cleared, retry does not repeat DELETE, and guest is
  emitted only after the public cart cleanup boundary succeeds.
- Redirect boundary: configured-backend-origin enforcement is correct for relative,
  absolute, external, protocol-relative, lookalike-host, and unsafe-scheme probes.
- Storage/privacy: no token/customer persistence was found. The versioned path is
  same-origin-safe, but the transient-read case can reuse stale continuation state.
- State/data consistency: no durable data mutation or migration exists. The defect
  is in-memory lifecycle consistency, not durable customer/cart loss.
- Operations/recovery: rollback/recovery evidence remains credible. Removing the
  provider mount/auth files or disabling providers stops exposure; session-secret
  rotation remains available for compromise response without deleting durable data.
- Maintenance: the sequence/single-flight model remains small, but it needs an
  explicit last-confirmed-state invariant. Storage fault handling should apply one
  tombstone rule rather than separate partial branches.

## Hidden Assumptions And How This Could Still Be Wrong

- The implementation assumes failed logout will not overlap a current-customer
  refresh. React mount/refresh actions and user logout can overlap, and the public
  controller does not forbid that ordering.
- It assumes inability to read session storage means consumption has not occurred.
  The security-oriented one-shot contract requires the opposite fail-closed choice:
  once consume is attempted, that runtime must not later expose the old value.
- Browser E2E remains assigned to TASK-034, but later acceptance cannot repair these
  deterministic unit-level lifecycle defects.
- Start-login overlap with incomplete logout was not needed to establish this
  verdict and remains a residual concurrency risk for later UI/E2E verification.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth.ts:199-246`,
  `apps/storefront/lib/auth-state.ts:99-157`, and focused auth tests.
- Expected: every consume attempt is one-shot despite storage faults; failed logout
  retains the last backend-confirmed authenticated/cart state across overlapping
  restore operations.
- Observed: transient read failure permits later `/checkout` reuse; failed DELETE
  during pending restore leaves `customer_resolving` with no customer indefinitely.
- Likely category: code|verification
- Recommended next action: add a consume tombstone before any storage read and keep
  an explicit last-confirmed auth state for failed logout restoration; add both
  hostile regressions and rerun `/verify` plus `/red-verify`.
- Requires replan: no

SEMANTIC_VERDICT: semantic-fail

Scheduler recommendation: `REQUEST_CHANGES`; do not close TASK-030 or promote
TASK-031/TASK-032/TASK-039. Use bounded retry 2/2, then repeat independent functional
and semantic verification. Reviewer did not execute fixes, sync, or lifecycle work.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
