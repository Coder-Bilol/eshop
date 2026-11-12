# Offline review — 2026-11-12

- Role: Reviewer; source read-only. No server, database or VPS started.
- Verdict: REQUEST_CHANGES for the lifecycle snapshot reviewed; APPROVE for offline harness changes.

## Later fix review — 2026-11-12

- Full-refund-before-paid-projection finding: FIXED in the reviewed source.
  The refund branch validates the missing paid milestone from native evidence
  and reconciles a cumulative full refund; canceled native orders retain
  cancellation precedence.
- Missing unique lock owner finding: FIXED at source level. Middleware and the
  helper generate per-operation UUIDs; both workflow definitions use a shared
  per-execution UUID transform for acquisition and release. Installed transform
  implementation caches its result in transaction temporary data; the installed
  acquire step preserves that owner in compensation data. No database contention
  test was run, so this conclusion concerns source correctness only.
- `node -r ts-node/register src/scripts/smoke-order-lifecycle-offline.ts`
  from `apps/backend`: independently PASS; output explicitly reports controlled
  native records and `runtimeVerified: false`.
- Remaining HIGH: middleware still releases only on response `finish`, not actual
  native handler completion/failure after disconnect. The owner UUID fix does not
  establish a handler lifetime boundary or guarantee cleanup. No approval for
  full lifecycle serialization or runtime completion is given.
- Current verdict: REQUEST_CHANGES for full lifecycle boundary; reviewed refund
  and owner fixes plus the offline harness are accepted within their stated scope.

Historical findings below describe the earlier snapshot; items 1 and 2 are now
superseded by the fix review above. Item 3 remains unresolved.

## Actionable lifecycle findings

1. HIGH: full refund can become permanently unprojectable when notifications lag.
   With native captured + fully refunded records and metadata `pending_payment`,
   the refund branch rejects the prior logical state; delayed paid notification
   rejects cumulative full refund. Reconcile proven paid/progress milestones
   before applying a standalone refund, without trusting notification amounts.
   Add a regression for refund-first delivery with stale pending metadata.

2. HIGH: acquisition has no unique owner identifier. Installed PostgreSQL lock
   provider's duplicate-INSERT path compares `ownerId != owner.owner_id`.
   Undefined versus persisted null compares equal, so simultaneous first
   acquisitions can both return successfully. Give each acquisition a unique
   owner and use it consistently for release/compensation; test contention at
   initial insertion and prevent one owner releasing another's lock.

3. HIGH: `finish` alone does not cover a client-disconnected async handler.
   Removing `close` release avoids early unlock but may leave the lock forever:
   installed provider rejects a null-owned existing row before considering its
   expiration. A TTL is also not proof of handler completion. Use an actual
   native handler completion/error boundary, with release in its finally,
   rather than treating socket completion or a lease as that boundary.

These findings were delivered to the owner during ongoing implementation; this
report is a snapshot, not a final review of later fixes.

## Harness review

- Backend and storefront requested suites fail closed for unknown and mixed
  known/unknown names before mutation/process startup; no-argument defaults and
  stable deduplication are preserved.
- `node apps/backend/test/runner-suite-selection.test.cjs`: PASS, 64 assertions,
  independently executed by reviewer without services.
- Installed Admin check uses a distinct suite and explicitly emits
  `runtimeVerified: false`; field/source wiring assertions do not claim a real
  order payload, rendering, authorization, inventory, or payment proof.

## Other evidence checked

- Native Query graph loader and capture-based evidence, authoritative guard,
  projector, subscriber, expiry and lock helpers.
- Installed Medusa workflow composer adds sequential actions; omission of an
  explicit canceled output from later step input alone is not sufficient proof
  that cancellation and cleanup run concurrently.
- Installed PostgreSQL lock provider and acquire/release workflow step source.
- Runtime/browser acceptance remains deferred under the operator override.
