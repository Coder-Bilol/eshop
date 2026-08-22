---
task_id: TASK-053
stage: implementation
tier: T3
status: complete
---
# TASK-053 Plan

1. Preserve idempotency-key lookup after terminal metadata transition using the existing order metadata.
2. Extend real backend acceptance to expire the created order, retry the same key, and assert sanitized `409` with unchanged post-expiry counts.
3. Restore the real-browser controlled-expiry retry assertion to `409` and prove the stale success panel is removed.
4. Run targeted integration/typechecks, real browser e2e, workspace build, lint/doctor, privacy/cleanup checks, verify, red-verify, T3 markers, sync, and repeated FT-007 feature review.
