---
description: TASK-026 local execution gate evidence.
status: active
---
# TASK-026 Verification

## Local Gates

- Pending: `npm run smoke:local`
- Pending: `npm --workspace apps/storefront run test:e2e -- cart`
- Pending: `npm run typecheck`
- Pending: `node scripts/mb-lint.mjs`

## Notes

- These gates are `/execute` evidence only and do not close `TASK-026`.
- T3 closure still requires `/verify PASS`, per-task `/red-verify` semantic-pass,
  `HUMAN_CHECKPOINT: done`, and `ROLLBACK_RECOVERY_NOTE: present` by the later
  closure owner.
