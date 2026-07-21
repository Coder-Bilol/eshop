# TASK-029 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-029.task.json`
- Packet: `.memory-bank/packets/TASK-029.packet.json` (`PACKET-TASK-029-R5`,
  derivative context; scheduler/doctor readiness accepted)
- Status observed: `in_progress`; lifecycle is outside this run
- Dependencies: `TASK-027` and `TASK-028` are `done`

## Sources Used

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- `.memory-bank/constitution.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/workflows/tier-policy.md`
- TASK-027 and TASK-028 final implementation reports and handoffs

## Preflight

- Installed Medusa 2.16 exposes `IAuthModuleService.validateCallback`,
  `createCustomerAccountWorkflow`, Customer Module retrieval/listing, and the
  server-side `req.session.auth_context` contract used by Medusa's session route.
- No direct core-table write or Medusa Core modification is required.
- The configured provider callbacks already target
  `/auth/customer/{google|vkid}/complete`.
- Exact runtime files: `apps/backend/src/auth/complete-customer-auth.ts`,
  `apps/backend/src/auth/rate-limit.ts`,
  `apps/backend/src/api/auth/customer/[provider]/complete/route.ts`,
  `apps/backend/src/api/middlewares.ts`,
  `apps/backend/src/scripts/smoke-auth-completion.ts`,
  `apps/backend/package.json`, and append-only `.memory-bank/changelog.md`.
- Existing dirty dependency, scheduler, deployment, packet, and operator changes
  are preserved.
- No live provider credentials or provider calls are permitted.
- Retry 2/2 inputs include the latest independent Reviewer code-02 FAIL reports.
  The bounded defects are callback cleanup ownership after resolution-lock release
  and uncompensated post-create identity-read failure; all prior passing behavior
  must remain unchanged.
