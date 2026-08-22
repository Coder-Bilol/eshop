# TASK-051 Context

TASK_ID: TASK-051
ROLE: GENERAL / IMPLEMENTER
Mode: scheduler-mode implementation handoff; task status remains scheduler-owned.
Feature context: FT-007 pending-order expiry and native reservation release.
Authoritative references: `AGENTS.md`; `.memory-bank/constitution.md`;
`.memory-bank/mbb/index.md`; `.memory-bank/spec-backbone.md`;
`.memory-bank/spec-index.md`; `.memory-bank/index.md`;
`.memory-bank/commands/execute.md`; `.memory-bank/workflows/tier-policy.md`;
the indexed TASK-051 record; canonical packet; linked FT-007 SDD specs; and
existing `.protocols/TASK-051` plus latest `.tasks/TASK-051` artifacts.
Infrastructure recovery context: the targeted integration first exposed a
serialized workflow-error assertion mismatch, then exposed a duplicate release
attempt because installed Medusa `cancelOrderWorkflow` already deletes native
reservations by line item. The resumed implementation keeps explicit deletion
only for the already-canceled recovery path.
Scope: implement only TASK-051 allowed source/test/changelog changes, preserve
existing partial source work, and record reproducible execute evidence.
Explicit exclusions: do not modify task JSON, packet, scheduler/task status,
Medusa Core, forbidden FT-008/FT-009 scope, production data, secrets, or browser
database access. Do not run `/verify`, `/red-verify`, or `/mb-sync`.
