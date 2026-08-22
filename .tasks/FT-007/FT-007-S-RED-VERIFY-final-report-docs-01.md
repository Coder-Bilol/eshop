---
feature: FT-007
stage: red-verify
artifact: final-report
kind: docs
status: complete
---
# FT-007 Feature Semantic Review — Initial

SEMANTIC_VERDICT: semantic-concern

The feature is not yet correct in substance. A real controlled-expiry probe
reused the original idempotency key and received `201`; the normative contract
requires stable `409 checkout_idempotency_conflict` without a replacement order
or reservation. Root cause is the idempotency lookup filtering out metadata
after `checkout_state` changes from `pending_payment` to `expired`, bypassing the
existing terminal-state guard.

Scheduler created bounded T3 follow-up `TASK-053`. FT-007 remains implemented
but not verified until that task closes and a repeated feature review returns
`SEMANTIC_VERDICT: semantic-pass`.
