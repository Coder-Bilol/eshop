# TASK-051 Plan

Status: implementation resumed in scheduler-mode after infrastructure hangs.

Authoritative inputs:
- Task: `.memory-bank/tasks/TASK-051.task.json` (`T3`, `in_progress`).
- Packet: `.memory-bank/packets/TASK-051.packet.json` (derivative context; readiness
  was checked by scheduler/mb-doctor and is not revalidated here).
- FT-007 SDD: pending-order runtime, API, data, lifecycle, feature, and testing
  references listed by the task/packet.

Goal Interpretation:
- Purpose: expire only eligible logical `pending_payment` orders after 72 UTC
  hours and release native line reservations with retry-safe cleanup.
- Success outcome: the pending-order expiry integration proves cancellation,
  line-item cleanup, unchanged paid/non-pending/future/canceled orders, and
  recovery after simulated partial cleanup failure.
- Anti-goals: no payment-provider behavior, FT-008 lifecycle/Admin work, custom
  queue/ledger, direct stock mutation, Medusa Core edits, production data, or
  secrets.
- Allowed write scope: the six paths in `runtime_context.allowed_write_scope`;
  protocol and `.tasks/TASK-051/` evidence are execution artifacts.
- Forbidden scope: the five `runtime_context.forbidden_scope` categories and
  any task/status/packet/scheduler transition.
- Stop conditions: inability to distinguish eligible orders, non-retryable
  cleanup, contradictory installed Medusa APIs/specs, or unverifiable paid-order
  preservation.

Boundary Notes:
- Responsibility boundary: Medusa workflow errors cross into the local
  integration smoke as either native `Error` instances or serialized plain
  objects; the assertion must inspect the stable message content without
  changing the workflow's recoverable-failure behavior.
- Native cancellation boundary: installed Medusa `cancelOrderWorkflow` already
  invokes reservation deletion by order line. The outer workflow must not call
  the same step again for a normal cancel; explicit deletion remains required
  for an already-canceled order whose cleanup metadata is still `pending`.
- Boundary drift risk: provider behavior, raw internal error exposure, direct
  stock mutation, or a custom inventory ledger would exceed this task.

Execution plan:
1. Preserve and inspect existing partial source work and the latest failed gate.
2. Make the pending-order expiry integration assertion tolerate the supported
   Medusa workflow error shape while still requiring the simulated-failure
   message; avoid duplicate reservation deletion after native cancellation.
3. Run backend typecheck, targeted integration, workspace build, and Memory Bank
   lint; retain command/status/log evidence under `.tasks/TASK-051/`.
4. Update full T3 execute protocol and implementation report; leave verify,
   red-verify, scheduler closure, and mb-sync to their owners.

Required later lifecycle gates remain outside this run: `/verify`, per-task
`/red-verify`, human checkpoint/recovery closure markers, scheduler transition,
and `/mb-sync`.
