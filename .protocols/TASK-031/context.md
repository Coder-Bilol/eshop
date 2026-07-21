# TASK-031 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-031.task.json`
- Packet: `.memory-bank/packets/TASK-031.packet.json`
  (`PACKET-TASK-031-R10`, ready derivative context)
- Status observed: `in_progress`; lifecycle is outside this run
- Dependencies: `TASK-024`, `TASK-029`, and `TASK-030` are `done`

## Sources Used

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/workflows/tier-policy.md`
- TASK-024, TASK-029, and TASK-030 implementation/verification handoffs

## Preflight

- Existing `AuthProvider` exposes provider start, session restoration, and sanitized
  auth state without rendering customer data.
- Existing `CartProvider.mergeAfterAuthentication()` returns `null` for no source,
  a validated result for backend merge success, and throws while preserving the
  source reference on recoverable failure.
- The completion UI can keep merge readiness local to this route without changing
  auth/session or FT-003 merge semantics.
- Exact runtime/test files are the two scoped pages, two scoped auth components,
  `apps/storefront/src/auth-ui.test.cjs`, and the storefront test runner.
- `.memory-bank/changelog.md` already contains scheduler changes and will receive an
  append-only TASK-031 entry.
- No backend, provider, provider state, checkout, order, inventory, payment, auth
  provider, cart provider, or merge implementation file is required.

## Retry 1/2 Preflight

- Read packet R9 and the independent functional/semantic FAIL reports.
- Confirmed the bounded defects: non-null merge results ignored restored cart state,
  and stale async work was not invalidated by auth loss or unmount.
- Confirmed exact retry write scope: `auth-completion.tsx`, `auth-login.tsx`,
  `auth-ui.test.cjs`, changelog, protocol, and code-02 execution evidence/report.
- Existing Node/CommonJS TypeScript harness can deterministically test a component
  controller without Playwright, a browser install, or another dependency.
- No task/spec contradiction, dirty-overlap blocker, forbidden-scope requirement, or
  public-contract decision was found.

## Retry 2/2 Preflight

- Read packet R10 and the code-02 functional/semantic Reviewer FAIL reports.
- Confirmed the final bounded defects: root `CartProvider restoreOnMount={false}`
  returns `null + idle` when no guest reference exists, and readiness did not reject
  every errored, pending, incomplete, or contradictory merge handoff.
- Confirmed exact retry write scope: `auth-completion.tsx`, `auth-ui.test.cjs`,
  changelog, implementation protocol, and code-03 execution evidence/report.
- Existing stale-result invalidation, one-flight actions, return-path gating, error
  sanitization, and privacy behavior require no runtime changes.
- No task/spec contradiction, forbidden-scope requirement, public-contract change,
  or wider FT-003 merge-semantic change was found.
