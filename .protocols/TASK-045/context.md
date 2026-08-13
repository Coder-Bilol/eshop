---
description: Implementer context for TASK-045 wishlist fixture channel alignment.
status: in_progress
---
# TASK-045 Context

## Role And Boundary

- Role: `Implementer`.
- Task: `TASK-045`, tier `T2`, authoritative lifecycle status `in_progress`.
- This run implements only the acceptance harness change and records local evidence;
  it does not run `/verify` or `/red-verify` and does not make a lifecycle decision.
- Scheduler owns task status, packet changes, closure, and `/mb-sync`.

## Readiness And Inputs

- Task record: `.memory-bank/tasks/TASK-045.task.json`.
- Required packet: `.memory-bank/packets/TASK-045.packet.json` (read-only).
- Dependency: `TASK-044` is indexed `done`.
- Normative inputs read: `.memory-bank/constitution.md`, `.memory-bank/spec-backbone.md`,
  `.memory-bank/spec-index.md`, FT-005 feature/spec, wishlist data/API contracts,
  testing strategy, and `IMPL-FT-005.md`.
- Prior acceptance context read: TASK-044 handoff/evidence and TASK-042 retry boundary.
- No source/spec/packet contradiction was found that blocks this implementation.

## Goal Interpretation

- Purpose: remove the acceptance-only sales-channel mismatch blocking browser-positive
  wishlist lifecycle verification.
- Success outcome: the browser Store API observes retained restored and out-of-stock
  fixtures through the channel selected by the actual publishable key, while hidden rows
  remain omitted.
- Anti-goals: no production wishlist/auth/catalog behavior, route/workflow/schema change,
  new bearer path, direct browser DB/module access, live provider, or sensitive evidence.

## Implemented Boundary

- The runner passes the actual seeded browser publishable key to each local acceptance
  phase through a dedicated child-process environment variable. The key is not written
  to state, stdout, evidence, or browser artifacts.
- The acceptance script resolves `api_key -> sales_channels.id` through Medusa `QUERY`
  and stores only the selected channel ID in the private run state. It rechecks the
  channel before `read` and `browser-setup`.
- Visible, unpublished, inactive-category, restorable, and out-of-stock fixtures use the
  selected channel; the channel-invisible fixture remains unlinked. Hidden semantics
  therefore remain unchanged.
- Browser assertions use the long-lived Store API. Retained rows are expected during
  catalog/detail mutation checks, and removal waits for the specific wishlist card to
  detach before asserting the retained list state.
- Existing unconditional cleanup remains in both backend phase orchestration and the
  runner `finally` path.

## Scope Contract

- Allowed implementation files: `apps/backend/src/scripts/smoke-wishlist-acceptance.ts`,
  `apps/storefront/e2e/run-real-medusa-e2e.cjs`, and `.memory-bank/changelog.md`.
- Protocol/evidence files under `.protocols/TASK-045/` and `.tasks/TASK-045/` are
  operational handoff artifacts, not production implementation scope.
- Forbidden: production wishlist/auth/catalog source, routes/workflows, auth providers,
  bearer transport, schema, production data, live providers, browser direct DB/module
  access, TASK-042 lifecycle/retry/status/scheduler artifacts, task JSON, and packet.

## Stop Conditions Checked

- Supported local channel resolution unavailable or ambiguous.
- Alignment requiring production behavior, auth changes, direct browser DB/module access,
  a new bearer path, or edits outside the approved implementation files.
- Regression of TASK-041/TASK-044 acceptance or unconditional cleanup.
- Evidence containing keys, credentials, cookies, bearer values, tokens, sessions, secrets,
  PII, or production data.

## Handoff State

- Implementation gates passed; sanitized evidence is under `.tasks/TASK-045/`.
- `/verify`, `/red-verify`, `/mb-sync`, and scheduler closure were not run.
- Task status remains `in_progress`; `HUMAN_CHECKPOINT` and `ROLLBACK_RECOVERY_NOTE`
  closure markers are absent.
