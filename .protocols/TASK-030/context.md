# TASK-030 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-030.task.json`
- Packet: `.memory-bank/packets/TASK-030.packet.json`
  (`PACKET-TASK-030-R14`, ready derivative context)
- Run: bounded code-06 Reviewer FAIL recovery `/execute TASK-030`
- Status observed: `in_progress`; lifecycle is outside this run
- Dependency: `TASK-027` is `done`

## Sources Used

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/workflows/tier-policy.md`
- `apps/storefront/components/cart-provider.tsx`
- `.tasks/TASK-030/TASK-030-S-VERIFY-final-report-code-06.md`
- `.tasks/TASK-030/TASK-030-S-RED-VERIFY-final-report-code-06.md`
- `.tasks/TASK-030/BUG-OAUTH-PROVIDER-REDIRECT-ALLOWLIST.md`
- `.protocols/TASK-030/verification-code-06.md`
- `.protocols/TASK-030/red-verification-code-06.md`

## Preflight

- The existing CartProvider exposes the required synchronous
  `clearLocalReference()` public boundary. Its exception can be handled and retried
  by auth orchestration without changing cart implementation.
- Direct Medusa HTTP session APIs can satisfy the task without browser token
  persistence or an SDK.
- Exact runtime files are `apps/storefront/lib/auth.ts`,
  `apps/storefront/lib/auth-state.ts`,
  `apps/storefront/components/auth-provider.tsx`,
  `apps/storefront/app/layout.tsx`, and the scoped storefront tests/runner.
- `.memory-bank/changelog.md` has unrelated existing changes and is intentionally
  untouched; scheduler/lifecycle synchronization is outside this run.
- No backend, page design, cart merge semantics, checkout, order, or payment file
  is required.
- Recovery runtime/test write scope is limited to `apps/storefront/lib/auth.ts`,
  `apps/storefront/lib/auth-state.ts`, `apps/storefront/src/auth-client.test.cjs`,
  `apps/storefront/src/auth-state.test.cjs`, and protocol/evidence artifacts.
- Medusa DELETE `401` authoritatively confirms that the session is absent. It must
  enter the existing post-deletion cleanup phase while genuine errors retain the
  last backend-confirmed customer/cart state.
- A literal fragment delimiter must reject before WHATWG URL normalization, including
  a trailing empty `#`; percent-encoded query data remains governed by the existing
  TASK-043 raw-query parser.
- Existing exact provider/query/path rules, race ordering, one-shot storage, cart
  cleanup retry, credentials, and token non-storage behavior must remain unchanged.
