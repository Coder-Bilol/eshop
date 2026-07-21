# TASK-030 Independent Functional Verification Code 02

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: bounded retry 1/2
- Packet: `PACKET-TASK-030-R4` (`ready`), with matching task SHA-256

## Findings

- MEDIUM: return-path consumption is not one-shot after a transient storage read
  failure. `consumeReturnPath()` returns `/` immediately when `getItem()` throws at
  `apps/storefront/lib/auth.ts:215-220`, without recording the in-memory tombstone
  used by the removal-failure path. An independent storage probe returned `/` on
  the first call and the old `/checkout` value on the second call after storage
  recovered. This violates the requested one-shot behavior under storage faults
  and can reuse navigation state from an earlier completion attempt.
- MEDIUM: a failed logout overlapping an already-started session restore loses the
  last backend-confirmed customer and leaves a non-terminal state. `restoreSession()`
  first emits `customer_resolving` with `customer: null` at
  `apps/storefront/lib/auth-state.ts:107-108`; logout then captures that transient
  state at lines 129-131. When DELETE fails, line 137 restores the transient state,
  while operation sequencing suppresses the pending successful customer response.
  The independent probe ended permanently at `{ status: "customer_resolving",
  customer: null }` with no cleanup. This contradicts the normative rule that
  logout failure keeps confirmed authenticated/cart state until retry and breaks
  deterministic state under restore/logout concurrency.

## Acceptance Results

- PASS: a customer response started before successful logout is stale-suppressed;
  a restore requested during pending logout joins the logout result and cannot
  resurrect identity.
- PASS: concurrent logout calls are single-flight, share one backend DELETE and one
  cleanup, and resolve deterministically to `guest` after success.
- PASS: post-DELETE cart cleanup failure remains `logging_out` with no customer;
  retry performs cleanup without a duplicate DELETE and does not emit false guest
  completion before cleanup succeeds.
- PASS: provider IDs are allowlisted and login destinations are limited to the exact
  configured backend origin. Same-origin absolute and relative destinations pass;
  external, protocol-relative, lookalike-host, and non-HTTP destinations fail.
- PARTIAL: normal consume and `removeItem()` failure are one-shot and fail closed,
  but transient `getItem()` failure permits later reuse of the old value.
- PASS: current-customer success is the only identity proof; `401` becomes guest;
  all requests use `credentials: "include"` and no Authorization header or token
  request body.
- PASS: no JWT/provider token, customer payload, auth `localStorage`, or token value
  is persisted by the TASK-030 runtime surface. Session storage holds only the
  versioned safe return-path envelope.
- FAIL: logout failure preserves confirmed state only in the serial focused test,
  not when a current-customer restore is already pending.
- PASS: allowed runtime scope and anti-goals remain respected. No backend callback,
  login/checkout page, cart merge semantic, order/payment, or lifecycle change is
  attributed to retry 1.

## Commands And Evidence

- PASS: canonical packet/task raw SHA-256 comparison,
  `6ee5ceb998614ed5e4c30c21fcb9409838abf8b92e86361fb6e13bc626dbcecf`.
- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test -- auth-state`.
- PASS: `npm --workspace apps/storefront run test`, all eight suites.
- PASS: `npm --workspace apps/storefront run typecheck`.
- PASS: `npm --workspace apps/storefront run build`.
- PASS: `node scripts/mb-lint.mjs`, 118 files.
- PASS: `node scripts/mb-doctor.mjs --strict`, zero errors/warnings.
- PASS: `git diff --check`, existing line-ending warnings only.
- PASS: independent configured-backend-origin destination matrix.
- FAIL: independent transient-`getItem` probe: first consume `/`, second consume
  `/checkout`.
- FAIL: independent pending-restore plus failed-DELETE probe: two customer reads,
  one DELETE, zero cleanup calls, final `customer_resolving` with no customer.

VERDICT: FAIL

Scheduler recommendation: `REQUEST_CHANGES`; do not close TASK-030 or promote its
dependents. Use bounded retry 2/2 to tombstone every failed consume attempt and to
preserve the last confirmed state across failed logout even when restore is pending,
then repeat both independent verification stages. Reviewer did not modify lifecycle,
task status, dependencies, or Memory Bank sync state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
