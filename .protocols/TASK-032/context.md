# TASK-032 Context

- Role: GENERAL implementer
- Mode: manual implementation handoff
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-032.task.json`
- Packet: `.memory-bank/packets/TASK-032.packet.json`
  (`PACKET-TASK-032-R7`, status `ready`)
- Status observed: `ready`; `/execute` does not change lifecycle state
- Dependencies: `TASK-030` and `TASK-031` are `done`

## Sources Used

- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/features/FT-004-oauth-login-before-payment.md`
- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- `.memory-bank/workflows/tier-policy.md`
- TASK-030 and TASK-031 task records and current storefront auth/cart boundaries

## Preflight

- TASK-032 is indexed, has a valid T3 tier and `ready` status, and its dependencies
  are closed.
- Linked SDD specs, task record, plan, and packet agree that only
  `authenticated_ready` may render checkout continuation.
- `AuthProvider.restoreSession()` confirms the backend customer session;
  `CartProvider.restore()` and `mergeAfterAuthentication()` expose the existing
  backend cart and FT-003 merge boundaries needed to distinguish ready from blocked.
- No browser readiness flag is needed. Customer and cart IDs are used only as opaque
  backend-returned values for the in-memory readiness check.
- The worktree already contains operator changes in `.memory-bank/changelog.md` and
  `DEPLOYMENT_process.md`; they must be preserved.
- No backend authorization, checkout fields, order, inventory, payment, external
  redirect, or write outside the task scope is required.

## Semantic Remediation Preflight

- Independent `/verify` returned `VERDICT: PASS`; `/red-verify` returned
  `SEMANTIC_VERDICT: semantic-concern` because `/checkout` was duplicated in the
  `/login` query despite the session-storage-only security contract.
- The operator explicitly instructed GENERAL to continue with the recommended
  bounded login-boundary remediation after the required scope escalation was
  presented.
- Approved neighboring scope is limited to login page/component, auth-state login
  start behavior, and their existing focused tests. Backend auth, provider,
  callback, merge, checkout-field, order, inventory, and payment scope remains
  forbidden.
- The authoritative task record and derivative packet are refreshed before code
  remediation; existing functional/semantic evidence is retained as historical
  evidence and must be repeated after the fix.
