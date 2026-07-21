# TASK-030 Execute Local Gates Code 06

## Outcome

The two code-06 Reviewer defects are fixed within the existing storefront auth
boundary. DELETE-session `401` completes logout cleanup and converges to guest;
every raw provider location containing literal `#` rejects before URL normalization.
Prior TASK-043 query/path rules and TASK-030 concurrency/storage/cart/token behavior
remain green.

## Commands

- `npm --workspace apps/storefront run test -- auth-client` -> PASS. Exact provider
  destinations and the complete malformed-query/path matrix pass; empty/non-empty
  raw fragment variants reject.
- `npm --workspace apps/storefront run test -- auth-state` -> PASS. Expired-session
  `401` clears return-path/cart/customer with one DELETE under concurrent
  logout/restore; genuine-failure retention and cleanup-only retry remain green.
- `npm --workspace apps/storefront run test` -> PASS, all eight storefront suites.
- `npm run typecheck` -> PASS, storefront and backend workspaces.
- `npm run build` -> PASS, Next.js storefront and Medusa backend production builds.
- `npm --workspace apps/backend run smoke:auth-vkid` -> PASS.
- `npm --workspace apps/backend run test:integration -- auth-completion` -> PASS.
- `node scripts/mb-lint.mjs` -> PASS, 118 files.
- `node scripts/mb-doctor.mjs --strict` -> PASS with three unrelated upstream
  dependency warnings and no errors.
- `git diff --check` -> PASS with existing worktree LF/CRLF warnings only.

## Safety Evidence

- Runtime/test edits are restricted to the four packet-allowed storefront auth
  files. No backend, cart implementation/semantics, UI, checkout, order/payment,
  browser token storage, task lifecycle, verification, red-verification, changelog,
  or sync file changed in this recovery.
- Tests use synthetic customer IDs and provider locations only. No credentials,
  tokens, sessions, customer PII, or production data entered evidence.
- Recovery: revert the four bounded auth/test edits. No migration or durable data
  changed; disable providers and rotate credentials/signing secrets if compromise is
  suspected while preserving durable Auth/Customer/cart records.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
