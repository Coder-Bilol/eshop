# TASK-030 Independent Functional Verification

VERDICT: FAIL

## Findings

- HIGH: logout does not dominate a concurrently started current-customer read.
  The independent probe started `restoreSession()` while logout was pending,
  completed the session DELETE, and then delivered the older `/store/customers/me`
  success. The final state became `session_established` with
  `cus_stale_after_delete`, even though backend logout had succeeded and cart
  cleanup had run. The latest-call-wins sequence in
  `apps/storefront/lib/auth-state.ts:97-105,117-137` treats the later-started GET as
  authoritative without accounting for the successful destructive logout. This
  violates the `logging_out -> guest` transition and can expose authenticated UI
  after the server session has been destroyed.
- HIGH: two concurrent logout calls can leave the controller permanently in
  `logging_out`. The first DELETE succeeded and performed cleanup; the second
  DELETE failed and restored its captured `logging_out` state. The probe observed
  two DELETEs, one cleanup, and final state `{ status: "logging_out", customer:
  { id: "cus_double" } }`. The existing stale-response test covers only a restore
  started before logout and misses this opposite ordering and duplicate logout.
- MEDIUM: provider-name allowlisting works, but provider destination allowlisting
  is not implemented. `isHttpLocation` in `apps/storefront/lib/auth.ts:256-264`
  accepts every HTTP(S) origin. A Google start response containing
  `https://attacker.example/authorize` was accepted. This does not satisfy the
  architecture statement that start returns an allowlisted provider location and
  leaves a redirect/phishing path if the trusted backend response is misconfigured
  or corrupted. The focused test proves only scheme validation.
- MEDIUM: return-path consumption is not strict when `removeItem` fails.
  `consumeReturnPath` returns the validated path despite failed deletion. A storage
  double whose read succeeds and removal fails returned `/checkout` twice and kept
  the version-1 envelope. Paths remain same-origin under the tested URL-parser
  bypass set, but the required one-time consume behavior is not guaranteed.
- MEDIUM: after a successful backend DELETE, a cart cleanup exception is allowed to
  propagate while auth state becomes `guest`. The probe observed the safe return
  path cleared, the cart reference retained, final guest state, and rejected logout.
  With the real CartProvider boundary, `clearCartReference` throws before emitting
  empty cart state. This can leave the prior customer's cart reference/state on a
  shared browser after the session is gone.

## Context Gates

- The indexed task exists, remains `in_progress`, and has `tier: T3`; scheduler mode
  owns lifecycle changes.
- Canonical packet `PACKET-TASK-030-R3` is `ready`. Its raw task hash exactly
  matches `source_task_hash`:
  `sha256:6bf84cdf18e1fb416fef6b43d62738ec95a8d6987f6fbcc0aa77acaee56f5f2b`.
- Linked FT-004 auth/session/cart architecture, security, state, feature, task-plan,
  and tier-policy inputs were checked. Protocol context/plan still identify R2;
  this is non-blocking documentation drift because canonical R3 is valid.
- Runtime changes attributable to TASK-030 stay in its allowed storefront scope.
  No provider callback, login/checkout UI, cart merge semantics, order/payment, or
  browser token-storage change was attributed to this task.
- Verification changed only this protocol report and the required TASK-030
  verification report artifacts. It did not change code, task status, lifecycle,
  dependencies, Memory Bank sync state, or unrelated worktree content.

## Functional Evidence

- Credentials and session API contract: PASS. Google/VK start, current-customer,
  and logout requests use `credentials: "include"`, `cache: "no-store"`, and the
  publishable key without Authorization or request token bodies.
- Provider start: PARTIAL. Runtime provider IDs reject values outside `google` and
  `vkid`; arbitrary HTTP(S) destination origins are accepted.
- Customer identity and expiry: PASS for serial behavior. Only a validated
  current-customer payload establishes the customer, and current-customer `401`
  maps to clean `guest` state. FAIL for the successful-logout versus late-GET race.
- Return path: PASS for version, exact envelope shape, common open-redirect inputs,
  controls, schemes, `//`, and raw backslashes. Encoded separators remained on the
  configured storefront origin under URL parsing. FAIL for strict one-time consume
  when storage deletion fails.
- Logout ordering: PASS for one serial success and one serial backend failure.
  DELETE precedes local cleanup; failed DELETE preserves prior state and references.
  FAIL for duplicate/concurrent operations and local cart-cleanup failure.
- Token storage: PASS for TASK-030 source. No JWT/provider token, Authorization
  header, customer payload persistence, or auth localStorage adapter was added.
- Regression surface: focused auth suites, all eight storefront suites, typecheck,
  production build, Memory Bank lint, strict doctor, and diff check passed. These
  green gates do not exercise the failing interleavings above.

## Commands And Checks

- `npm --workspace apps/storefront run test -- auth-client` -> PASS.
- `npm --workspace apps/storefront run test -- auth-state` -> PASS.
- `npm --workspace apps/storefront run test` -> PASS, all eight suites.
- `npm --workspace apps/storefront run typecheck` -> PASS.
- `npm --workspace apps/storefront run build` -> PASS.
- `node scripts/mb-lint.mjs` -> PASS, 118 files.
- `node scripts/mb-doctor.mjs --strict` -> PASS, zero errors/warnings.
- `git diff --check` -> PASS with existing line-ending warnings only.
- Raw SHA-256 comparison -> packet/task hash match.
- Independent double-logout probe -> FAIL: final `logging_out` after one successful
  DELETE and one failed DELETE.
- Independent logout-versus-late-current-customer probe -> FAIL: final
  `session_established` after successful DELETE and cart cleanup.
- Independent destination/consumption probe -> arbitrary HTTPS origin accepted;
  failed removal allowed the same versioned path to be consumed twice.
- Independent post-DELETE cart-cleanup probe -> final guest plus retained cart
  reference and rejected logout.

## Recommendation

- Scheduler should not close TASK-030 or promote TASK-031/TASK-032/TASK-039 and
  should recommend `status: failed`.
- Serialize or otherwise define operation precedence so successful logout is
  terminal over every in-flight/current customer response and duplicate logout is
  idempotent. Add both failing interleavings to the auth-state suite.
- Enforce the specified provider destination policy or explicitly reconcile the
  architecture/task evidence if backend-only destination trust is intended.
- Make return-path consumption fail closed when deletion cannot be confirmed and
  ensure post-DELETE cart cleanup cannot leave a prior customer cart reference or
  in-memory cart exposed. Then repeat `/verify TASK-030` and
  `/red-verify TASK-030`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
