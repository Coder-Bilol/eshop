# TASK-043 Independent Functional Verification

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Packet: `PACKET-TASK-043-R3` (`ready_with_gaps`), accepted by strict doctor
  against the current authoritative task hash

VERDICT: FAIL

## Findings

- HIGH: malformed percent syntax still fails open when it appears after one or
  more decode rounds. `decodeQueryComponent()` returns the partially decoded value
  when the malformed `%` is found after round zero (`apps/storefront/lib/auth.ts:382-384`).
  Independent probes accepted `state=%25`, `state=%252`, and
  `state=%2520%25`, although each becomes an invalid, truncated, or mixed percent
  escape during bounded decoding. `callback_url%25=x` is also accepted. This
  violates the task invariant that malformed query syntax fails closed.
- MEDIUM: decoded blank or delimiter-like names are not rejected. `%20=x`, `+=x`,
  and `%3D=x` are accepted because the parser checks only `name === ""`, not a
  safe decoded-name grammar (`apps/storefront/lib/auth.ts:347-373`). These are not
  legitimate OAuth parameter names and preserve structural ambiguity after raw
  parsing.
- MEDIUM: the parser bounds decode rounds but not input size or parameter count.
  Independent probes accepted a 1 MB value and 10,000 unique segments. This did
  not crash the test process, but it leaves the security boundary resource-unbounded
  for a backend-returned location.
- MEDIUM: the focused suite claims malformed percent coverage but omits malformed
  forms created by decoding and the accepted blank/delimiter-name classes
  (`apps/storefront/src/auth-client.test.cjs:190-201`). Its green result therefore
  does not prove the complete hostile matrix.

## Functional Matrix

- PASS: bare names, raw empty names, leading/middle/trailing empty segments, and a
  bare query marker reject.
- PASS: raw invalid/truncated/mixed percent escapes reject.
- FAIL: invalid/truncated/mixed percent escapes produced after decoding are
  accepted.
- PASS: raw and one-through-four-level encoded NUL, C0/C1 controls, and truncated
  UTF-8 reject.
- PASS: duplicate names reject before and after case folding and one-through-four
  decode levels.
- PASS: raw, case, camel-case, hyphenated, and repeatedly encoded callback/return
  aliases reject. Provider-mismatched and non-exact `redirect_uri` values reject.
- PASS: encoding deeper than the three-round bound rejects when a percent octet
  remains.
- FAIL: encoded blank/delimiter-like names and overlong/high-segment-count queries
  are accepted.
- PASS: realistic duplicate-free Google and VK OAuth/PKCE starts on the exact
  approved HTTPS paths with exact provider-bound callbacks are accepted.

## Prior TASK-030 Regression Evidence

- PASS: exact provider origins and paths remain enforced; backend/relative/wrong-
  provider destinations, HTTP downgrade, lookalikes, ports, credentials, fragments,
  path normalization, ordinary callback/return abuse, and wrong callbacks reject.
- PASS: the full storefront suite preserves current-customer identity proof, `401`
  guest transition, stale-response suppression, concurrent logout single-flight,
  failed-logout retention, post-DELETE cart cleanup retry, one-shot return-path
  storage, credentials inclusion, and cart behavior.
- PASS: VK provider smoke preserves state/PKCE/device ID/token non-persistence and
  sanitized failure behavior.
- PASS: source scan found no storefront auth token, Bearer/Authorization, or auth
  `localStorage` persistence. The only `localStorage` hit is the pre-existing opaque
  cart reference boundary.

## Commands And Gates

- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test`; all eight suites passed.
- PASS: `npm --workspace apps/storefront run typecheck`.
- PASS: `npm run typecheck`; storefront and backend passed.
- PASS: `npm --workspace apps/backend run smoke:auth-vkid`.
- PASS: `npm run lint`; no workspace lint scripts are configured.
- PASS: `node scripts/mb-lint.mjs`; 118 files passed.
- PASS: `node scripts/mb-doctor.mjs --strict`; packet R3/hash gates passed with
  unrelated upstream-dependency warnings only.
- PASS: `git diff --check`; existing line-ending warnings only.
- FAIL: independent inline Node hostile matrix reproduced the accepted post-decode
  malformed escapes, blank/delimiter names, 1 MB value, and 10,000 segments.

## Root Wrapper Assessment

- PASS: `npm --workspace apps/storefront run build` completed independently.
- PASS: `npm --workspace apps/backend run build` completed independently.
- PASS: a separate reviewer run of root `npm run build` then completed both
  workspaces without `ChildProcess.kill` or compiler failure.
- The implementation run's earlier `Unknown: ChildProcess.kill` was not reproduced.
  It is treated as a transient root process-harness observation, not evidence of a
  workspace compiler defect and not a substitute for the functional FAIL above.

## Scope And T3 Evidence

- The indexed task remains `in_progress`; scheduler owns lifecycle and dependency
  decisions. Reviewer changed no implementation, task/packet state, sync, or bug
  record.
- Runtime/test implementation is limited to the allowed auth client and focused
  test files. No backend provider, cart semantic, checkout/order/payment, or browser
  token-storage change is attributed to TASK-043.
- The canonical packet is R3. Existing implementation context/progress still label
  R2, which is metadata drift but does not override the strict-doctor-accepted R3.
- Human checkpoint is recorded in the implementation handoff and current operator
  instruction. The recovery note is credible: revert/disable provider starts,
  rotate compromised provider/signing secrets, invalidate sessions if needed, and
  preserve durable Auth, Customer, and cart records.

## Failure / Recommendation

- Status: failed
- Where: `apps/storefront/lib/auth.ts:347-399` and the focused hostile matrix.
- Expected: malformed or ambiguous raw query syntax fails closed through every
  bounded decode round while legitimate Google/VK starts remain accepted.
- Observed: normal malformed cases reject, but post-decode malformed escapes,
  invalid decoded names, and unbounded query shapes are accepted.
- Likely category: code|verification
- Recommended next action: apply a bounded parser-only fix, add every reproduced
  input as a regression, and repeat independent `/verify` and `/red-verify`.
- Requires replan: no

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
