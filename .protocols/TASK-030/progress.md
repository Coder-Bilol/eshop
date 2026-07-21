# TASK-030 Progress

- Preflight complete: task, current R7 packet, linked specs, dependency, existing providers,
  test harness, and dirty-worktree overlap checked.
- Added a direct Medusa HTTP auth client for allowlisted Google/VK login start,
  current-customer retrieval, and confirmed session deletion. Every request uses
  `credentials: "include"`; no browser bearer credential exists.
- Added a versioned `sessionStorage` adapter that accepts only one-leading-slash
  internal paths, rejects `//`, schemes, controls, and backslashes, consumes the
  value on read, and falls back to `/`.
- Added deterministic session state for auth start, provider pending, customer
  resolution, session establishment, auth failure, logout, and 401-to-guest expiry.
- Added operation sequencing so a late current-customer response cannot restore
  customer state after confirmed logout.
- Added AuthProvider inside CartProvider. It uses only the existing public
  `clearLocalReference()` boundary and invokes it after session deletion succeeds.
- Added focused client/state tests and registered them in the existing runner.
- Packet-sourced focused tests, full storefront regressions, storefront typecheck,
  Memory Bank lint, and diff check pass.
- Runtime write scope respected; forbidden scope and unrelated dirty changes were
  untouched. `.memory-bank/changelog.md` was intentionally not edited because it
  has unrelated changes and sync/lifecycle are excluded from this run.

## Implementation Notes

- Logout failure restores the last backend-confirmed state and performs no local
  cleanup. Successful session deletion clears return-path/cart references before
  emitting `guest`; in-memory customer state is cleared even if browser cleanup
  itself throws.
- Session expiry clears only in-memory identity. It does not delete or mutate
  durable customer/cart records and does not change FT-003 cart semantics.
- Automated evidence contains synthetic IDs and locations only; no live provider
  token, session, secret, customer email, or production data was used or printed.

## Retry 1/2

- Read packet R4 and both independent Reviewer FAIL reports before editing.
- Provider start now accepts only HTTP(S) destinations on the configured backend
  origin; arbitrary absolute and protocol-relative external origins fail closed.
- Return-path consumption records an in-memory tombstone before removal. A removal
  exception returns `/`, attempts to invalidate the stored envelope, and cannot
  expose the same path again in the active runtime.
- Logout is single-flight. Calls made concurrently share one backend DELETE and one
  cleanup, while session restore during logout joins the terminal logout result.
- Successful DELETE invalidates earlier customer reads and clears in-memory customer
  identity before local cleanup. If `clearLocalReference()` throws, state remains
  `logging_out` with no customer and the error is propagated; a retry repeats only
  cleanup and reaches `guest` without another DELETE.
- Added adversarial regressions for every Reviewer finding. Cart implementation,
  provider/callback backend, UI, checkout, orders/payments, token storage, task
  lifecycle, changelog, and sync files were not changed in this retry.
- Focused auth suites, all storefront suites, storefront typecheck/build, Memory
  Bank lint, and diff check pass. Evidence is in
  `.tasks/TASK-030/execute-local-gates-code-02.md`.

## Final Retry 2/2

- Read packet R5, the latest functional/semantic Reviewer code-02 FAIL reports,
  and their detailed protocol evidence before editing.
- Return-path consumption now records its runtime tombstone before any storage read.
  A transient `getItem()` exception returns `/`; even when the stale envelope later
  becomes readable, a repeated consume returns `/` and removes it.
- The auth controller now retains its last backend-confirmed state separately from
  transient `customer_resolving` state. Failed session DELETE restores that status
  and customer with a normalized recoverable error.
- An overlapping restore response remains stale after failed logout and cannot
  overwrite the deterministic failed-logout state or replace confirmed identity.
- Added both hostile regressions while preserving retry-1 provider-origin,
  successful-logout precedence, single-flight DELETE, and cleanup-only retry tests.
- Packet R5 focused tests/typecheck/lint, all eight storefront suites, production
  build, token-storage scan, and diff check pass. Evidence is in
  `.tasks/TASK-030/execute-local-gates-code-03.md`.
- Runtime changes remain limited to the two auth libraries and two focused test
  files. Cart, backend, UI, checkout, task lifecycle, changelog, verification,
  red-verification, and sync state were not changed.

## Operator-Approved Recovery Beyond Retry 2/2

- Read packet R7, the authoritative reopened task decision, bug artifact, latest
  functional/semantic FAIL reports, linked specs, and all prior passing fixes.
- Replaced backend-only destination validation with the approved allowlist: the
  configured backend origin plus exact HTTPS Google and VK ID origins.
- Added fail-closed checks for unrelated/lookalike origins, provider HTTP downgrade,
  URL credentials, malformed/external/nested callback targets, and return-path
  parameters in an OAuth start location.
- Added positive Google and VK ID authorization URLs with backend callback targets,
  plus hostile destination regressions. Existing backend-origin positives remain.
- Preserved prior current-customer/logout concurrency, storage consume, cart cleanup,
  credentials-include, and token non-storage behavior; `auth-state` and all eight
  storefront suites pass unchanged.
- Packet gates, full storefront tests/build, backend VK provider smoke, Memory Bank
  lint, and diff check pass. Evidence is in
  `.tasks/TASK-030/execute-local-gates-code-04.md`.
- Code changes are limited to `apps/storefront/lib/auth.ts` and
  `apps/storefront/src/auth-client.test.cjs`. No forbidden scope, lifecycle,
  verification, red-verification, sync, or changelog change was made.

## Operator-Approved Recovery 2

- Read packet R10, the second reopened decision, bug artifact, code-04 functional
  and semantic FAIL evidence, linked security/state specs, and the existing
  implementation/tests before editing.
- Replaced origin-level acceptance with provider-bound exact base destinations.
  Backend and relative top-level locations, every explicit port (including default
  `:443`), credentials, fragments, all other paths/origins, and path-normalization
  variants now fail closed.
- OAuth query parameters remain supported only on the exact provider bases. A
  supplied `redirect_uri` must be unique and equal the provider's exact backend
  `/complete` callback; callback aliases, return-path fields, nested callback data,
  and case-insensitive duplicates reject.
- Expanded the hostile auth-client matrix across provider mismatch, backend
  destinations, default/non-default ports, credentials, fragments, wrong paths,
  callback/return abuse, malformed empty query, controls, and duplicate parameters.
- Focused auth-client/auth-state tests, all eight storefront suites, storefront
  typecheck/build, backend VK smoke, Memory Bank lint, token-storage scan, and diff
  check pass. Evidence is in
  `.tasks/TASK-030/execute-local-gates-code-05.md`.
- An additional non-packet `mb-doctor --strict` check reported only a mismatched
  packet source hash for R10. `/execute` does not repair or validate packet
  freshness/hash; scheduler/doctor ownership is preserved in handoff.
- Runtime changes remain limited to `apps/storefront/lib/auth.ts` and
  `apps/storefront/src/auth-client.test.cjs`. Prior concurrency, one-shot storage,
  cart cleanup retry, credentials-include, `401 -> guest`, and no-token behavior all
  remain green; forbidden scope and lifecycle/sync files were not touched.

## Code-06 Reviewer FAIL Bounded Recovery

- Read packet R14, both code-06 Reviewer FAIL reports and detailed evidence, linked
  auth/cart contracts, lifecycle spec, current implementation, and prior regressions.
- Logout `401` now confirms session absence and enters the existing post-DELETE
  cleanup phase. Customer state, safe return path, and cart local reference clear
  before `guest`; network/5xx and other genuine failures still restore the last
  backend-confirmed state without cleanup.
- Added an adversarial expired-session regression that overlaps two logout callers
  and restore, proving one DELETE, no stale retrieval, one public cart cleanup, and a
  shared terminal guest result. Existing stale-response and cleanup-only retry tests
  remain green.
- Provider destination validation now rejects any literal raw `#` before WHATWG URL
  normalization. Empty fragments on Google/VK bases and a query-ending `#` reject;
  the complete TASK-043 malformed-query/path matrix remains green.
- Focused suites, all eight storefront suites, workspace typecheck/build, backend VK
  and auth-completion checks, Memory Bank lint/strict doctor, and diff check pass.
  Evidence is in `.tasks/TASK-030/execute-local-gates-code-06.md`.
- Runtime/test changes are limited to the four scoped auth files. Backend, cart
  implementation/semantics, UI, checkout, order/payment, token storage, packet/task
  lifecycle, changelog, verification, red-verification, and sync were not changed.
