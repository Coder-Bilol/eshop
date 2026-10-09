# TASK-055 Context

- Tier: T3
- Task record: `.memory-bank/tasks/TASK-055.task.json`
- Packet: `.memory-bank/packets/TASK-055.packet.json` (`PACKET-TASK-055-R6`, ready)
- Feature: FT-008 / REQ-022
- Dependency: TASK-054 is `done` and its verification is PASS.

## Goal Interpretation

- Purpose: connect native Medusa Admin lifecycle mutations to one guarded, durable logical lifecycle projection and the existing FT-007 pending-order expiry path.
- Success outcome: native mutation remains the authorization and state-change boundary; all in-scope operations share `order-lifecycle:${order_id}`; the projector is allow-listed, authoritative-state based, idempotent, and preserves protected metadata.
- Anti-goals: no provider/webhook/email, custom Admin/Store lifecycle API, Medusa Core edit, direct stock mutation, replay ledger, or payment-success reservation deletion.
- Allowed write scope: exactly the `runtime_context.allowed_write_scope` list in the task record.
- Forbidden scope: exactly the `runtime_context.forbidden_scope` list in the task record.
- Stop conditions: inability to hold the canonical lock around installed native handlers, inability to enforce metadata boundary, unsafe/false native handoff, or any required implementation outside scope.

## Authoritative context

Read before implementation: constitution, Memory Bank indexes and GENERAL role, FT-008 and FT-007 specs, lifecycle/admin architecture and contract, lifecycle and inventory state docs, boundary map, invariants, testing index, tier policy, FT-008 protocol/decision log, implementation plan, packet, and TASK-054 implementation.

## Runtime findings

- Installed Medusa v2.16 exposes `acquireLockStep`/`releaseLockStep` and `LockingModuleService.execute/acquire/release`.
- Supported project middleware accepts route matchers and awaits `next`, so it can retain the lock through a native handler without modifying Medusa Core.
- Installed native Admin handlers for cancel, complete, fulfillment, mark-as-paid, refund are present under `@medusajs/medusa/dist/api/admin` and remain the mutation boundary.
- Native core flows expose `createOrderPaymentCollectionWorkflow` and `markPaymentCollectionAsPaid`; the configured system provider is the current payment profile.

## Boundary notes

- Native Admin session/RBAC remains upstream authorization.
- Middleware is a pre-native guard/serialization boundary; subscriber/workflow is a server-internal reconciliation boundary.
- FT-007 continues to own expiry and reservation cleanup; FT-008 only preserves and projects its markers.
- No public lifecycle input is accepted by the projector.

## Packet/gate notes

Packet is present and ready. Required gates: order-lifecycle integration, backend typecheck, workspace build, and mb-lint. `/verify`, `/red-verify`, `/mb-sync`, and final task status changes belong to the next owner.
