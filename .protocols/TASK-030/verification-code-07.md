# TASK-030 Independent Functional Verification Code 07

## Findings

- No actionable functional, security, scope, or regression findings.

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Run: code-06 recovery re-verification after the prior invocation was externally
  cancelled without a verdict
- Packet: `PACKET-TASK-030-R14` (`ready`), with an exact authoritative task hash
  match: `sha256:034df2f32870c9e936fbcef3c3d2165efac21d0d56c458ed7bf272eae35ef09b`

VERDICT: PASS

## Recovery Findings Rechecked

- PASS: installed Medusa maps an unauthenticated `DELETE /auth/session` to `401`.
  The storefront client preserves that status as `AuthClientError(401)`, and the
  controller treats only this response as authoritative session absence.
- PASS: an independent black-box race probe used the real storefront HTTP client,
  restored a customer, then overlapped two logout callers and `restoreSession()`
  around a delayed DELETE `401`. All callers shared one DELETE; no second current-
  customer GET started; customer state cleared before browser cleanup.
- PASS: the same probe made the first cart cleanup throw. All joined operations
  rejected with the genuine cleanup error and left `logging_out` with no customer.
  A later logout retried return-path/cart cleanup only, issued no second DELETE, and
  reached clean `guest` after cleanup succeeded.
- PASS: network/5xx and every non-401 genuine logout failure remain distinct from
  confirmed session absence. A delayed `503` overlapping current-customer restore
  performed no local cleanup, restored the last backend-confirmed customer with a
  recoverable error, preserved the cart reference, and stale-suppressed the late GET.
- PASS: any literal `#` is rejected on the raw provider location before `new URL()`.
  Google/VK base URLs ending in `#`, query-ending empty fragments, and non-empty
  fragments reject; encoded query data remains governed by the bounded raw parser.

## Complete Acceptance And Regression Results

- Provider boundary: PASS. Installed Google emits
  `https://accounts.google.com/o/oauth2/v2/auth`; project VK emits
  `https://id.vk.com/authorize`; Medusa forwards provider `location` unchanged.
  Exact real provider-shaped values pass, while backend/relative/wrong-provider
  destinations, HTTP, lookalikes, credentials, explicit ports, literal fragments,
  trailing/wrong/normalized paths, callback aliases, return aliases, duplicates, and
  wrong provider-bound callbacks fail closed.
- Raw query boundary: PASS. Valueless/unnamed/empty segments, invalid and truncated
  percent syntax, encoded controls, malformed or repeatedly encoded dangerous names,
  and case-folded duplicates reject. Exactly 4096 raw query characters and 32 unique
  segments pass; 4097 characters and 33 segments reject. This preserves the closed
  `TASK-043` behavior.
- HTTP/session client: PASS. Google/VK POST, current-customer GET, and session DELETE
  use `credentials: "include"`, `cache: "no-store"`, and the publishable key with no
  Authorization header or request body.
- Customer authority: PASS. A valid current-customer response is the only transition
  to confirmed customer state. Current-customer `401` produces clean `guest` without
  logout cleanup or durable Customer/cart mutation; malformed responses fail closed.
- Concurrency: PASS. Reads started before logout cannot resurrect identity, reads
  requested during logout join it, concurrent logout is single-flight, failed logout
  overlapping restore retains confirmed identity, and confirmed session deletion
  dominates stale work.
- Browser cleanup/cart: PASS. Cleanup uses only
  `CartProvider.clearLocalReference()` after confirmed deletion or authoritative
  DELETE `401`. No guest completion is emitted while cart cleanup fails, and retry is
  cleanup-only.
- Return-path storage: PASS. Only a versioned safe one-leading-slash internal path is
  stored in sessionStorage. Read/removal faults fail closed and remain one-shot in the
  runtime; malformed envelopes and unsafe paths fall back to `/`.
- Token/privacy: PASS. Runtime auth sources add no auth localStorage, JWT, bearer,
  provider/access/refresh/ID token, Authorization header, customer payload, secret,
  or parallel browser identity persistence. The only application localStorage
  boundary remains the existing opaque FT-003 cart reference.
- Scope/anti-goals: PASS. Runtime/test work remains in the allowed storefront auth
  boundary. No backend callback implementation, page design, cart merge semantics,
  checkout/order/payment behavior, lifecycle change, or sync action is attributed to
  the code-06 recovery or this Reviewer pass.

## Prior Finding Reconciliation

- Initial stale-current-customer, duplicate logout, post-DELETE cart leak, arbitrary
  provider origin, and failed return-path consumption findings: closed and regressed.
- Code-02 read-fault replay and failed-logout/restore confirmed-state findings: closed
  and regressed.
- Code-03 real Google/VK provider capability finding: closed against installed
  provider source and generated path contracts.
- Code-04 callback binding, explicit default port, and fragment payload findings:
  closed and regressed.
- Code-05 malformed/double-encoded query finding: closed by `TASK-043`; its closure
  evidence and current bounded parser behavior were independently rechecked.
- Code-06 DELETE `401` cleanup and trailing-empty-fragment findings: closed by the
  current recovery and independent combined fault/race probes.

## Commands And Evidence

- PASS: raw SHA-256 comparison for R14 packet/task freshness.
- PASS: `node scripts/mb-doctor.mjs --strict`; 0 errors, 3 unrelated upstream
  dependency warnings.
- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test -- auth-state`.
- PASS: `npm --workspace apps/storefront run test`; all eight storefront suites.
- PASS: independent `task030-code07` black-box probe covering exact provider/query
  boundaries, actual-client DELETE `401`, concurrent logout/restore, combined cart
  cleanup failure and cleanup-only retry, genuine `503`, current-customer `401`,
  storage faults, credentials, and runtime no-token persistence.
- PASS: `npm run typecheck`; storefront and backend workspaces.
- PASS: `npm run build`; Next.js storefront and Medusa backend/Admin.
- PASS: `npm --workspace apps/backend run smoke:auth-vkid`.
- PASS: `npm --workspace apps/backend run test:integration -- auth-completion`.
- PASS: `node scripts/mb-lint.mjs`; 118 files.
- PASS: `git diff --check`; no whitespace errors, existing line-ending warnings only.
- Tooling observation: the first parallel backend invocations hit the known
  PowerShell `ChildProcess.kill` wrapper failure, and one concurrent root typecheck
  timed out after both compilers printed success. Every affected command was rerun
  in isolation, and the final root typecheck/build and backend gates completed with
  exit code 0. No product assertion failed.

## T3 And Scheduler Recommendation

- Human checkpoint is explicit in the operator instruction and implementation
  handoff. Recovery is credible: revert the four bounded auth/test edits or disable
  provider starts; after suspected compromise rotate provider/signing secrets and
  invalidate sessions while preserving durable Auth, Customer, and cart records.
- APPROVE. `TASK-030` is functionally scheduler closure-eligible subject to the
  required code-07 semantic verdict. Reviewer did not change task lifecycle,
  dependencies, packet state, changelog, or `/mb-sync` state.
- After closure, scheduler should reevaluate direct dependents: `TASK-031` can become
  `ready`; `TASK-032` remains blocked on `TASK-031`; `TASK-039` remains blocked on
  planned `TASK-038`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
