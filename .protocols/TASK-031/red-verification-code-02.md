# TASK-031 Independent Red Verification Code 02

## Findings

- HIGH: The retry fixes the prior false-ready cases but creates false failure for the
  normal no-cart buyer. The focused test invents an `empty` no-source handoff, while
  the production CartProvider in the root layout remains `idle` when no reference
  exists. Successful authentication without a guest cart is consequently trapped in
  `merge_blocked`, contrary to the feature's required no-source readiness state.
- MEDIUM: The fail-closed claim is broader than the implementation. Contradictory
  `ready` state/error/operation combinations and incomplete merge metadata still
  produce `merged`, so the isolated controller suite provides false confidence about
  malformed handoff handling.

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry reviewed: 1/2

SEMANTIC_VERDICT: semantic-fail

## Purpose Fit And False-success Assessment

- Google/VK login choice, callback cleanup, current-customer authority, validated
  merge success, recoverable merge failure, retry, stale-result invalidation,
  one-flight actions, return-path gating, and privacy behavior fit the intended
  design in their independently checked paths.
- The task nevertheless misses its success outcome for a first-class path: no guest
  reference must reach `authenticated_ready`, but the real provider handoff is
  rejected. This is a deterministic production-composition failure, not a browser
  tooling or live-provider evidence gap.
- The focused suite passes because `noSourceHandoff()` supplies `status: "empty"`,
  which the production root layout does not establish before the merge handoff.

## Cross-boundary Assessment

- Auth/session truth: current-customer success remains required before merge starts;
  recoverable cart failure does not roll back authentication.
- Cart state/data consistency: validated target adoption now checks target IDs and
  ready status. However, the no-reference contract is misread across the
  AuthCompletion/CartProvider boundary, and contradictory typed cart states are not
  rejected consistently.
- Checkout boundary: blocked states do not consume the safe return path, but the
  valid no-source buyer remains blocked forever and cannot reach the future checkout
  gate through the intended return path.
- Privacy/security: callback parameters, raw errors, tokens, customer PII, and
  browser auth-token persistence were not found in the reviewed UI/evidence paths.
- Scope/autonomy: retry changes stayed inside the allowed UI/test boundary and did
  not alter backend auth, merge semantics, checkout, order, inventory, or payment.
- Operational behavior: auth-loss, retry, and unmount stale results are invalidated
  by operation generation. The untested real no-reference handoff is an ordinary
  runtime state, so controller-only success does not establish end-to-end readiness.
- Maintenance: the extracted controller is small and testable, but duplicating an
  inaccurate CartProvider fixture makes the suite brittle at exactly the integration
  boundary TASK-031 owns.

## Anti-goals And Hidden Assumptions

- Backend merge behavior, checkout/payment scope, provider payload rendering, and
  customer PII anti-goals are respected.
- Hidden assumption: no stored reference implies the CartProvider state is `empty`.
  In the actual root composition `restoreOnMount` is false, so the state is `idle`.
- Hidden assumption: checking target IDs, outcome, and `ready` status is sufficient
  to call any handoff structurally valid. The current non-discriminated state/result
  types permit contradictory fields that the resolver accepts.
- Browser E2E remains assigned to TASK-034, but no browser is needed to reproduce
  either defect because both are deterministic controller/provider compositions.

## Critical T3 Assessment

- Security/privacy checks pass for callback cleanup, bounded rendered errors, token
  non-persistence, and customer PII non-rendering.
- Runtime failure-mode check fails because successful authentication with no guest
  source cannot complete, and some malformed handoffs still fail open.
- No migration, irreversible production write, payment mutation, durable deletion,
  or secret exposure was introduced by this retry.
- Human checkpoint and rollback/recovery markers are present and credible, but they
  do not make the semantically failing result closure-eligible.

## How This Could Still Be Wrong

- A future CartProvider could normalize no-reference state to `empty`, but the
  current production root and handoff do not; closure must use current behavior.
- Real-browser execution could reveal additional effect-order, focus, or responsive
  defects. Those residual risks do not weaken the deterministic failures already
  reproduced.
- The malformed cases are defensive contract failures rather than outputs currently
  emitted by the cart controller, but the task explicitly claims fail-closed runtime
  validation and the current type does not prevent those combinations.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/app/layout.tsx:19`,
  `apps/storefront/components/cart-provider.tsx:96-107`, and
  `apps/storefront/components/auth-completion.tsx:80-115`
- Expected: documented merge success and actual no-reference handoff reach readiness;
  backend-error, empty-after-merge, malformed, contradictory, and unknown handoffs
  remain blocked.
- Observed: actual no-reference `null + idle` is blocked, while several contradictory
  malformed handoffs are accepted.
- Likely category: code/test
- Recommended next action: use the real CartProvider no-reference contract in the
  resolver and deterministic tests, tighten contradictory handoff validation, and
  repeat `/verify TASK-031` plus `/red-verify TASK-031` in retry 2/2.
- Requires replan: no

## Closure Recommendation

- REQUEST_CHANGES. Recommend the scheduler keep TASK-031 `in_progress` under retry
  policy and leave dependents unpromoted. Retry 2/2 should remediate both contract
  mismatches before another independent T3 review.
- Reviewer did not close/fail/block/promote lifecycle records, execute a fix, or run
  `/mb-sync`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
