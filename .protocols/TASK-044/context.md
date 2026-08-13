---
description: Execution context for TASK-044 wishlist lifecycle fixture retention.
status: in_progress
---
# TASK-044 Context

## Role And Boundary

- Role: Implementer.
- Task: `TASK-044`, tier `T2`, authoritative lifecycle status `in_progress`.
- This run implements the bounded acceptance harness handoff, records local gate
  evidence, and does not run verification workflows or make a lifecycle decision.
- Implementation remains limited to the acceptance script and changelog; protocol and
  evidence files are execution records.
- The verifier and scheduler own functional verdicts, lifecycle decisions, and sync.

## Authoritative Inputs

- Task record: `.memory-bank/tasks/TASK-044.task.json` (`T2`, `in_progress`).
- Required packet: `.memory-bank/packets/TASK-044.packet.json` (`T2`, `ready`).
- Feature: `.memory-bank/features/FT-005-authenticated-wishlist.md`.
- Feature design: `.memory-bank/tech-specs/FT-005-authenticated-wishlist.md`.
- Data specification: `.memory-bank/domains/wishlist-data.md`.
- Wishlist API/security contract: `.memory-bank/contracts/wishlist-api-security.md`.
- Authentication/session contract: `.memory-bank/contracts/auth-session-security.md`.
- Authentication/session state: `.memory-bank/states/customer-auth-session.md`.
- Testing strategy: `.memory-bank/testing/index.md`.
- Feature implementation plan: `.memory-bank/tasks/plans/IMPL-FT-005.md`.
- Constitution: `.memory-bank/constitution.md`.
- Tier policy: `.memory-bank/workflows/tier-policy.md`.
- SDD backbone and registry: `.memory-bank/spec-backbone.md` and
  `.memory-bank/spec-index.md`.

## Dependency And Prior Evidence

- `TASK-041` is indexed and `done`; its real local Medusa/PostgreSQL acceptance and
  unconditional synthetic cleanup are documented in `.tasks/TASK-041/acceptance-evidence.md`,
  `.tasks/TASK-041/gate-results.md`, and `.tasks/TASK-041/rollback-recovery-note.md`.
- `.tasks/TASK-042/TASK-042-S-RED-VERIFY-final-report-docs-01.md` records the existing
  browser false-success gap: hidden, restored, and out-of-stock lifecycle states are not
  retained for the real browser read.
- TASK-044 addresses only the acceptance-harness retention handoff described by its own
  task record. TASK-042 lifecycle, status, protocols, and scheduler decision are outside
  this run.

## Goal Interpretation

- Purpose: Provide a safe acceptance-only retention/setup handoff so TASK-042 can prove
  buyer-visible wishlist lifecycle projections in a real browser.
- Success outcome: TASK-042 can read retained synthetic hidden, restored, and out-of-stock
  favorites through the real browser boundary and cleanup remains deterministic.
- Anti-goals: Do not change production wishlist/auth/catalog behavior; do not add a
  production bearer path or browser persistence; do not use real PII, credentials,
  tokens, cookies, session IDs, secrets, or production data.

## Exact Acceptance Scope

- A browser-customer-bound retention/setup phase keeps synthetic hidden, restored, and
  out-of-stock rows available for the real browser read.
- Hidden rows remain durable and omitted, restored products reappear, and visible
  out-of-stock products remain listable with `is_available` false until cleanup.
- The existing unconditional cleanup removes all synthetic rows and fixtures after
  success or interruption without production data access.
- No production wishlist/auth/catalog behavior or bearer/auth boundary is changed.
- The existing TASK-041 write/read/cleanup acceptance behavior is preserved.
- The standard local customer ownership handoff is used without direct database/module
  insertion, production auth changes, or a new bearer path.

## Allowed And Forbidden Scope

- Task implementation scope: `apps/backend/src/scripts/smoke-wishlist-acceptance.ts` and
  `.memory-bank/changelog.md`.
- Implementation scope in this run: `apps/backend/src/scripts/smoke-wishlist-acceptance.ts`
  and `.memory-bank/changelog.md`; protocol and evidence records are also updated as
  required by `/execute`.
- Forbidden scope: production wishlist/auth/catalog behavior, storefront, auth providers,
  bearer transport, database schema, production data, and live providers.
- Also forbidden in this run: task JSON, packet, TASK-042 lifecycle or scheduler status,
  production source, `/verify`, `/red-verify`, `/mb-sync`, and `/mb-packet`.

## Stop Conditions

- The existing harness cannot safely hand off a synthetic browser customer actor.
- Retention would require weakening hidden-product privacy or changing production
  routes/workflows.
- Cleanup cannot be guaranteed on success and interruption.
- The fix requires edits outside the acceptance harness and changelog without an
  additional owner decision.
- The existing TASK-041 acceptance write/read/cleanup coverage regresses or requires
  production data, live providers, credentials, cookies, bearer values, tokens, session
  IDs, or secrets.

## Intended Gates

- `npm --workspace apps/backend run test:integration -- wishlist-acceptance`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

Gate results and substantive sanitized evidence are recorded under `.tasks/TASK-044/`.

## Scheduler Boundary

- `/verify TASK-044` must produce the T2 functional evidence and `VERDICT: PASS` before
  scheduler closure.
- T2 task closure requires this full protocol, the required packet/spec gates, and the
  verification PASS; per-task `/red-verify` is not required by T2 task policy.
- After all FT-005 tasks are implemented, feature-level `/red-verify --feature FT-005`
  remains required before treating the feature as semantically complete.
- The scheduler owns task status, closure/failure/blocking decisions, evidence links in
  the task record, and `/mb-sync`. This worker owns none of those decisions.
