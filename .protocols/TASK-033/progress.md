# TASK-033 Progress

## Preflight

- PASS: task/index identity, T3 routing, dependency, packet/spec links, scope, and
  verification basis are usable and consistent.
- PASS: installed Medusa Auth Module CRUD and customer-account workflows support a
  real PostgreSQL fixture/read/cleanup acceptance path.
- Implemented: multi-process auth acceptance, sanitized provider-double runner, and
  integration dispatcher registration.

## Implementation

- Write process creates synthetic Google/VK Auth identities through the real module,
  executes production completion orchestration with real Customer workflows, and
  proves first/repeat/collision/missing-email/session outcomes.
- Read process independently reloads Auth/Customer/provider identity records from
  PostgreSQL and proves durable links without persisted session/token state.
- Provider runner executes VK and completion contract suites while suppressing and
  scanning child output before emitting coarse evidence.
- Cleanup process removes account links, customers, and identities and asserts zero
  remaining fixtures.

## Local Gates

- Initial acceptance attempt: PostgreSQL write/read/cleanup passed; stale out-of-scope
  `smoke-auth-config.ts` fixture failed because it invoked rate-limit middleware with
  an incomplete request double. No production defect was found or changed.
- Remediation: actual cookie/CORS/session config is asserted inside the allowed real
  Medusa acceptance script; provider runner remains limited to valid provider and
  completion contract suites.
- Final auth acceptance: PASS.
- Auth-completion and auth-vkid dispatcher regressions: PASS.
- Backend typecheck: PASS.
- Windows-native `npm run smoke:local`: PASS.

## Scope

- Runtime/test writes remain inside TASK-033 `allowed_write_scope`.
- Existing TASK-032 storefront/task/protocol changes were preserved.
- Production auth behavior, live providers/credentials, production data, storefront,
  checkout, order, and payment scope were not touched.

## Session HTTP Remediation

- Trigger: independent `/verify` correctly returned FAIL because the initial harness
  used an in-memory recorder and overclaimed cookie/restart coverage.
- Added a private temp handoff containing only synthetic fixture IDs and a temporary
  publishable key; it is never printed and is removed after successful cleanup.
- Real compiled Medusa is built and started on an isolated local port with synthetic
  JWT/cookie secrets and providers disabled.
- A synthetic bearer for the persisted fixture creates a real session through
  `POST /auth/session`; assertions cover actual Set-Cookie flags, CORS, and
  authenticated `/store/customers/me` response.
- Real `DELETE /auth/session` is called; the prior cookie receives `401` afterward.
- A second valid session cookie is created, the backend process is fully stopped and
  restarted with the same signing config, and the old cookie receives `401` because
  the in-memory session store is empty.
- Fresh-process PostgreSQL read then confirms customer/identity durability; cleanup
  revokes/deletes the temporary API key and removes all synthetic fixtures.
- Final `auth-acceptance` on the remediated harness: PASS.

## Interrupted-run Recovery Remediation

- Trigger: adversarial verification found a private state file from an earlier hard
  interruption and correctly rejected the assumption that JavaScript `finally`
  always runs.
- The dispatcher now creates a private owner marker before any PostgreSQL write and
  discovers at most 20 bounded TASK-033 owner/state run groups before a new run.
- Markers owned by a live PID within the two-hour run window are skipped; expired,
  dead, malformed, missing, and legacy owner states are cleaned idempotently through
  the existing Medusa cleanup phase.
- Acceptance now writes real simulated-interruption fixtures, marks their owner dead,
  invokes recovery as a later run would, and requires exactly one recovered run.
- The first remediated command recovered the legacy run that triggered the concern,
  recovered the simulated run, completed the normal HTTP/restart flow, and left no
  TASK-033 temp owner/state files.
- Auth acceptance, backend typecheck, and Windows-native local smoke: PASS.

## Final Closure

- Repeated functional verification: PASS.
- Repeated adversarial verification: semantic-pass.
- Explicit standalone manual owner recorded TASK-033 as `done` and reconciled packet,
  task, bug, protocol, evidence, and changelog state through `/mb-sync`.
- TASK-034 promotion and FT-004/REQ lifecycle remain outside this sync.
