# TASK-030 Independent Functional Verification Code 05

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Run: operator-approved recovery 2
- Packet: `PACKET-TASK-030-R11` (`ready`), accepted by strict doctor with the
  current authoritative task hash

VERDICT: FAIL

## Findings

- HIGH: malformed OAuth query parameters are accepted instead of failing closed.
  `allowedAuthorizationLocation()` checks the exact raw base and dangerous decoded
  names, but then relies on forgiving `URL`/`URLSearchParams` parsing without
  validating query grammar (`apps/storefront/lib/auth.ts:318-338` and
  `apps/storefront/lib/auth.ts:344-367`). Independent probes accepted valueless
  `?state`, unnamed `?=value`, invalid percent escape `?state=%`, percent-encoded
  NUL `?state=%00`, invalid name `?%ZZ=value`, and empty query segments such as
  `?state=x&&client_id=y`. The same gap accepts double-encoded navigation aliases
  such as `callback%255Furl`, `return%255Furl`, and malformed
  `redirect_uri%00`. This violates the requested malformed-query/encoded-trick and
  callback/return fail-closed matrix.
- MEDIUM: the focused suite claims malformed callback/return and duplicate query
  coverage but asserts only duplicate decoded names, a bare `?`, and a raw control
  character (`apps/storefront/src/auth-client.test.cjs:155-203`). None of the
  independently accepted malformed forms above is covered, so the green suite
  overstates the recovery boundary.

## Functional Results

- PASS: exact Google and VK authorization bases are accepted, including realistic
  duplicate-free OAuth query parameters (`response_type`, `client_id`, exact
  provider-bound `redirect_uri`, `scope`, `state`, and VK PKCE parameters).
- PASS: backend top-level destinations, relative destinations, provider mismatch,
  HTTP downgrade, lookalike origins, explicit default and nondefault provider
  ports, URL credentials, and fragments reject.
- PASS: trailing/wrong paths, encoded path characters, and dot-segment/path
  normalization attempts reject before parser normalization can widen the path.
- PASS: ordinary `callback_url`, `callback`, `callbackUrl`, `redirectUri`,
  `return_url`, `returnUrl`, `return-path`, duplicate names, case-insensitive
  duplicates, external/nested callback values, and wrong-provider callbacks reject.
- FAIL: malformed query grammar and double-encoded/malformed navigation aliases are
  accepted, so the exact recovery contract is not fully satisfied.
- PASS: current-customer success remains the only identity proof; `401` resolves to
  `guest`; stale restore cannot resurrect identity after logout; concurrent logout
  remains single-flight; failed logout preserves the last confirmed customer.
- PASS: confirmed DELETE precedes local cleanup; cart cleanup failure remains
  `logging_out` and retries cleanup without a second DELETE; return-path consumption
  remains one-shot across read/removal faults.
- PASS: every auth request uses `credentials: "include"`; runtime source contains
  no Authorization header, JWT/provider token, bearer credential, or auth
  `localStorage` persistence.

## Context And Scope Gates

- The indexed task exists, remains `in_progress`, has `tier: T3`, and links the
  required FT-004 SDD specs. Scheduler retains lifecycle and dependent ownership.
- Packet R11 is `ready`; `node scripts/mb-doctor.mjs --strict` passed with zero
  errors and warnings, validating required packet readiness and source hash.
- Task, packet R11, exact-path reopened decision, bug artifact, all prior functional
  and semantic FAIL reports, code-05 implementation/evidence, linked auth/session/
  cart specs, current runtime source, tests, and diff/status surface were checked.
- Recovery runtime scope remains limited to `apps/storefront/lib/auth.ts`; focused
  tests are in `apps/storefront/src/auth-client.test.cjs`. No backend callback,
  page/checkout design, cart semantics, order/payment, browser token store,
  lifecycle, dependent, or sync change is attributed to recovery 2.

## Commands And Evidence

- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test -- auth-state`.
- PASS: `npm --workspace apps/storefront run test`, all eight storefront suites.
- PASS: `npm --workspace apps/storefront run typecheck`.
- PASS: `npm run typecheck`, storefront and backend.
- PASS: `npm --workspace apps/storefront run build`.
- PASS: `npm run build`, storefront and Medusa backend.
- PASS: `npm --workspace apps/backend run smoke:auth-vkid`.
- PASS: `node scripts/mb-lint.mjs`, 118 files.
- PASS: `node scripts/mb-doctor.mjs --strict`, zero errors/warnings.
- PASS: `git diff --check`, with existing line-ending warnings only.
- PASS: runtime token-storage source scan via project content search.
- PASS: independent exact-path/port/credential/fragment/path/duplicate/callback/
  return matrix.
- FAIL: independent malformed-query and encoded-alias probes reproduced every
  accepted case listed in Findings.

## Failure / Recommendation

- Status: failed
- Where: `apps/storefront/lib/auth.ts:318-367` and the focused hostile matrix in
  `apps/storefront/src/auth-client.test.cjs:155-203`.
- Expected: accept exact Google/VK authorization paths with syntactically valid,
  duplicate-free OAuth query parameters; reject malformed/encoded navigation data.
- Observed: exact paths and ordinary hostile cases work, but forgiving query parsing
  admits malformed parameters and encoded callback/return aliases.
- Likely category: code|verification
- Recommended next action: scheduler should not close `TASK-030` or promote its
  dependents. Route any correction through operator/scheduler ownership, add the
  reproduced matrix as regressions, and repeat independent `/verify` and
  `/red-verify`.
- Requires replan: yes

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
