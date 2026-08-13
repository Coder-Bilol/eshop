---
description: Independent functional verification report for TASK-042.
status: fail_pending_followup
---
# TASK-042 Verification Report

VERDICT: FAIL

## Findings

- HIGH: `apps/storefront/e2e/run-real-medusa-e2e.cjs:1041-1116` checks hidden,
  restored, and out-of-stock IDs only through browser absence. It does not prove
  hidden durable-row omission, restored reappearance, or visible `is_available: false`
  state. The backend lifecycle phase removes those records before browser list checks,
  so these assertions are false-success coverage.

## Evidence Checked

- `node scripts/mb-doctor.mjs --strict`: PASS, 0 errors and 0 warnings.
- `npm --workspace apps/storefront run test:e2e -- wishlist`: PASS; real MS Edge,
  storefront, compiled Medusa, PostgreSQL, standard session-cookie auth boundary,
  synthetic fixtures, cleanup, and released ports.
- `npm --workspace apps/storefront run test`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `node scripts/mb-lint.mjs`: PASS, 122 files.
- Syntax, package JSON, scoped diff, sanitized report/logs, privacy scan, screenshot,
  recovery evidence, implementation report, and full TASK-042 protocol.
- FT-005 wishlist feature/data/API/security/session/testing specs and dependency
  evidence from TASK-034, TASK-040, and TASK-041.

## Acceptance Results

- PASS: authenticated catalog/detail/wishlist add, view, remove, reload.
- PASS: second-customer isolation and foreign remove non-observability.
- PASS: guest login routing with no favorite persistence.
- PASS: four hidden-product 404 signatures from the browser Store API.
- FAIL: browser omission of durable hidden rows is not proved.
- FAIL: browser-positive restored-product reappearance is not proved.
- FAIL: browser-positive out-of-stock visible/unavailable projection is not proved.
- PASS: valid customer wishlist remains usable during `merge_blocked`; checkout remains
  blocked.
- PASS: logout/session-expiry UI and browser storage cleanup.
- PASS: synthetic-only data, privacy boundary, cleanup, and task scope.

## Marker And Scope Status

- Existing `HUMAN_CHECKPOINT` status: pending; not emitted or changed by this Reviewer.
- Existing `ROLLBACK_RECOVERY_NOTE` status: present; not emitted or changed by this
  Reviewer.
- No source, task JSON, packet, lifecycle status, task verify field, scheduler state,
  closure/promotion, or production behavior was changed by this Reviewer.

## Report Paths

- `.protocols/TASK-042/verification.md`
- `.protocols/TASK-042/red-verification.md`
- `.tasks/TASK-042/TASK-042-S-RED-VERIFY-final-report-docs-01.md`
