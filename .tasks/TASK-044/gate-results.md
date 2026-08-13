---
description: Local gate results for TASK-044 acceptance fixture retention.
status: captured
---
# TASK-044 Gate Results

| Command | Result | Evidence |
|---|---|---|
| `npm --workspace apps/backend run test:integration -- wishlist-acceptance` | PASS | Real local phased TASK-041 baseline; all 11 assertion groups passed and cleanup completed. |
| `npm --workspace apps/backend run smoke:wishlist-acceptance` | PASS | Backend package entry reproduced write/read/cleanup acceptance. |
| `npm --workspace apps/backend run typecheck` | PASS | Backend `tsc --noEmit` completed successfully. |
| `npm run smoke:local` | PASS | Windows-native PostgreSQL, backend, storefront environment, database smoke, and typechecks passed. |
| `node scripts/mb-lint.mjs` | PASS | `mb-lint passed (122 files)`. |
| Local `browser-setup` followed by unconditional `cleanup` | PASS | Synthetic actor handoff retained hidden `4`, restored `1`, out-of-stock `1`; cleanup reported complete. |
| `git diff --check -- apps/backend/src/scripts/smoke-wishlist-acceptance.ts .memory-bank/changelog.md` | PASS | No whitespace errors. |

These are implementation gates only. No `/verify`, `/red-verify`, `/mb-sync`, or
scheduler lifecycle operation was run.
