# TASK-033 Context

- Role: GENERAL implementer
- Mode: manual implementation handoff
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-033.task.json`
- Packet: `.memory-bank/packets/TASK-033.packet.json`
  (`PACKET-TASK-033-R2`, status `ready`)
- Status observed: `ready`; `/execute` does not change lifecycle state
- Dependency: `TASK-029` is `done`

## Sources Used

- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/features/FT-004-oauth-login-before-payment.md`
- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- TASK-029 task record, implementation, and current auth integration harnesses

## Preflight

- TASK-033 is indexed, T3, `ready`, and its dependency is closed.
- Task, packet, specs, and plan agree that acceptance must exercise real Medusa
  Auth/Customer modules and PostgreSQL with local synthetic provider doubles.
- Existing `smoke-auth-completion.ts` proves in-memory orchestration contracts but is
  not sufficient evidence of PostgreSQL persistence or fresh-process linkage.
- Existing `test/run-integration.cjs` already owns real `medusa exec` dispatch and can
  add a dedicated multi-process auth acceptance without changing production auth.
- Real Auth Module CRUD and supported customer-account workflows are available from
  the installed Medusa v2.16 runtime.
- Existing TASK-032 storefront/task/protocol changes are unrelated dirty worktree
  state and will not be modified by TASK-033 except for append-only shared changelog
  handling.
- No production auth behavior, live provider, real credential/data, storefront,
  checkout, order, or payment change is required.
