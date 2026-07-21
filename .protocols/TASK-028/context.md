# TASK-028 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-028.task.json`
- Packet context: `.memory-bank/packets/TASK-028.packet.json` R4 (derivative;
  scheduler/doctor readiness was accepted and not structurally revalidated)
- Dependency: `TASK-027` is `done`
- Task status observed: `in_progress`; lifecycle will not be changed

## Sources Used

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- `.memory-bank/constitution.md`
- `.memory-bank/invariants.md`
- `.memory-bank/testing/index.md`
- `.tasks/TASK-027/TASK-027-S-IMPL-final-report-code-03.md` for provider
  configuration and dependency handoff behavior only
- `.protocols/TASK-028/verification.md` and `.protocols/TASK-028/red-verification.md`
- `.tasks/TASK-028/TASK-028-S-VERIFY-final-report-docs-01.md` and
  `.tasks/TASK-028/TASK-028-S-RED-VERIFY-final-report-docs-01.md`
- Official VK ID API reference for the confidential authorization-code wire
  contract: `service_token` is required and `device_id` is the identifier returned
  with, and bound to, the authorization code

## Preflight

- Installed Medusa/Auth packages are version `2.16.0` and expose
  `AbstractAuthModuleProvider`, `ModuleProvider(Modules.AUTH, ...)`, provider state
  storage, and provider identity retrieve/create methods required by the task.
- The Medusa state cache has a 20-minute storage TTL but no consume primitive. The
  provider must therefore store its own shorter expiry and mark state consumed
  before external exchange, with an in-process claim guard for concurrent replay.
- Exact runtime files expected: `apps/backend/src/modules/auth-vkid/index.ts`,
  `service.ts`, `types.ts`, `apps/backend/src/scripts/smoke-auth-vkid.ts`, and
  `apps/backend/package.json`; `.memory-bank/changelog.md` receives an append-only
  task entry.
- Existing dirty changes from TASK-027, scheduler state, packets, deployment work,
  and unrelated operator work are preserved.
- No semantic contradiction, unsafe underspecification, or stop condition was
  found. Automated evidence will use synthetic provider doubles only.
- Retry 1/2 is bounded to the two reviewer findings: replace the incorrect
  `client_secret` exchange field and make the provider double reject a mismatched
  `device_id`. All previously passing auth invariants remain required.
