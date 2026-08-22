---
feature: FT-007
stage: red-verification
status: pass
---
# FT-007 Feature Semantic Review

SEMANTIC_VERDICT: semantic-pass

## Remediated finding

The initial controlled-expiry browser probe reused the original idempotency key
and received `201`, creating a replacement pending order. The normative API and
tech spec require `409 checkout_idempotency_conflict` for a non-retryable expired
order. The workflow lookup currently searches only metadata still classified as
`pending_payment`, so the expiry workflow's `checkout_state: expired` update
hides the original key before the existing terminal-state guard can reject it.

TASK-053 removed that state filter only from the persisted-key lookup. The
existing actor/cart/fingerprint/native-status/expiry guards now reject the
terminal order. Real Medusa/PostgreSQL and Edge evidence observe `409` and
unchanged post-expiry order/reservation counts; the browser removes the old
success panel and shows only the sanitized conflict.

## Feature composition review

- TASK-050 creates one authenticated native pending order, reserves managed
  lines, reconciles valid retries, and compensates post-order reservation failure.
- TASK-051 owns the guarded 72-hour expiration/cancel/release workflow and
  recovery/repeated-run semantics.
- TASK-052 connects the authenticated checkout handoff and proves truthful UI,
  provider isolation, privacy, and cleanup.
- TASK-053 preserves the idempotency binding across TASK-051's terminal metadata
  transition, closing the only cross-task gap found by the first feature review.

All reviewed boundaries pass: authenticated ownership,
server-authoritative cart/price/tariff data, in-window same-order replay,
reservation linkage/compensation, guarded expiry/release, no provider traffic,
privacy, and cleanup.

All four T3 tasks are `done` with functional PASS, per-task semantic-pass, exact
checkpoint/recovery markers, final matching ready packets, and reproducible
runtime evidence. FT-007 is semantically correct and eligible for lifecycle
reconciliation to `verified`.
