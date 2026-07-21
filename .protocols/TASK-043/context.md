# TASK-043 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-043.task.json`
- Packet: `.memory-bank/packets/TASK-043.packet.json` (`PACKET-TASK-043-R4`, `ready_with_gaps`)
- Retry: bounded retry 1/2 after independent Reviewer FAIL
- Status observed: `in_progress`; lifecycle remains scheduler-owned
- Dependencies: `TASK-027` and `TASK-028` are `done`

## Sources Used

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.tasks/TASK-030/BUG-OAUTH-PROVIDER-REDIRECT-ALLOWLIST.md`
- `.tasks/TASK-030/TASK-030-S-VERIFY-final-report-code-05.md`
- `.tasks/TASK-030/TASK-030-S-RED-VERIFY-final-report-code-05.md`
- `.protocols/TASK-030/verification-code-05.md`
- `.protocols/TASK-030/red-verification-code-05.md`
- Existing `apps/storefront/lib/auth.ts` validator and `apps/storefront/src/auth-client.test.cjs`

## Preflight

- Exact runtime/test writes are `apps/storefront/lib/auth.ts` and
  `apps/storefront/src/auth-client.test.cjs`.
- `.memory-bank/changelog.md` contains unrelated scheduler changes and is not touched.
- Raw query validation can precede WHATWG URL normalization without changing the
  approved Google/VK origins, paths, backend callback, or auth/session behavior.
- Backend provider implementation, cart semantics, checkout/order/payment, browser
  token storage, task lifecycle, verification, red-verification, and sync are out of scope.

## Bounded Retry 1/2

- Reviewer findings are limited to malformed percent syntax produced after decoding,
  invalid decoded parameter names, absent query resource caps, and missing regressions.
- Exact runtime/test writes remain `apps/storefront/lib/auth.ts` and
  `apps/storefront/src/auth-client.test.cjs`; the dirty changelog remains excluded.
- Existing exact Google/VK destinations, provider-bound callback checks, and all
  prior TASK-030 behavior must remain unchanged.
