---
description: Independent semantic verification for TASK-042 browser wishlist acceptance.
status: semantic_fail_pending_followup
---
# Red Verification - TASK-042

## Semantic Verdict

SEMANTIC_VERDICT: semantic-fail

## Hostile Assessment

- The implementation solves the intended real-browser auth/wishlist slice for the
  ordinary catalog/detail/wishlist lifecycle and uses the existing FT-004 session
  boundary rather than adding a production bearer path.
- The evidence is not sufficient for the complete purpose: the browser suite's hidden
  row omission, positive restoration, and out-of-stock claims are delegated to a
  backend phase, while the browser checks only absence after those backend records
  were removed.
- This is a false-success path: the E2E process can pass while the buyer-visible
  restored or unavailable projection is broken.

## Findings

### HIGH - Browser lifecycle coverage does not prove the required visibility states

- In `apps/storefront/e2e/run-real-medusa-e2e.cjs:1041-1116`, browser list checks use
  `some(...) === false` for hidden, restored, and out-of-stock IDs. No hidden durable
  row is retained for browser omission, no restored presence is asserted, and no
  `product.is_available === false` value is checked.
- In `apps/backend/src/scripts/smoke-wishlist-acceptance.ts:594-703`, the separate
  lifecycle phase removes hidden rows and then removes the restored/out-of-stock rows
  after proving them. The browser phase therefore cannot observe these states.
- This violates the TASK-042 success outcome and FT-005 browser verification target,
  even though TASK-041 backend semantics are independently verified.
- Counterproposal: arrange the acceptance phases so the restored favorite remains
  visible and the out-of-stock favorite remains saved until browser reads; assert
  presence and exact unavailable state in the browser, then clean both records in the
  existing `finally`/cleanup path.

## Purpose And Anti-Goal Assessment

- Purpose fit: partial. Authenticated buyer flow and privacy purpose are met; complete
  buyer-visible lifecycle proof is not.
- Anti-goals: no evidence of real PII, production data, live provider traffic, new
  production bearer behavior, variant favorites, sharing, or recommendations.
- Allowed scope: the reviewed task diff stays within the runner, package script, and
  changelog; production source is not part of the TASK-042 change surface.

## Cross-Boundary Review

- FT-004 provider doubles still reach the standard Medusa callback/session and current
  customer boundary.
- TASK-041 supplies valid backend PostgreSQL lifecycle evidence, but it cannot replace
  the missing browser projection assertions owned by TASK-042.
- Wishlist capability remains exercised independently from `merge_blocked`, while
  checkout remains blocked as required.

## State, Data, And Operational Concerns

- No ownership or durable data-loss defect was observed in the reviewed run.
- Synthetic fixture cleanup ran in the final run and ports were released; recovery note
  is present.
- The current phase ordering creates an observability gap, not a production data leak,
  but it weakens confidence in product visibility state at the storefront boundary.
- Future maintenance risk is localized: acceptance can silently regress positive
  lifecycle rendering while backend tests continue to pass.

## How This Could Still Be Wrong

- If the product owner explicitly accepts backend-only proof for restoration and
  out-of-stock, the finding would be a scope interpretation issue; the task prompt and
  FT-005 browser target currently require buyer-visible proof, so no such assumption is
  adopted here.
- The hydration warning remains a residual risk only: it was reproduced but caused no
  acceptance failure and did not widen production scope.

## Marker Status

- Existing TASK-042 artifacts report `HUMAN_CHECKPOINT` as pending. This Reviewer did
  not create or change that marker.
- Existing recovery evidence reports `ROLLBACK_RECOVERY_NOTE` as present. This Reviewer
  did not create or change that marker.

## Scope

- Reviewer is read-only for source and lifecycle state. Only the `/verify` and T3
  `/red-verify` protocol/report artifacts are written.
- No task status/verify update, packet refresh, closure, promotion, marker emission,
  source correction, `/execute`, `/mb-packet`, or `/mb-sync` was performed.
## Final Bounded Retry 2/2 Independent Semantic Verification

### Semantic Verdict

SEMANTIC_VERDICT: semantic-pass

### Hostile Assessment

- The retry proves the actual task purpose at the buyer-visible boundary: retained
  durable rows are read through the real browser Store API before cleanup.
- The previous false-success path is closed. The runner retains hidden/restored/out-of-
  stock rows, obtains the current browser actor, and asserts runtime list membership,
  current handle, and `product.is_available === false`.
- No false success was found in the fresh browser run. Assertions are driven by response
  product IDs/handles and API response values, not static report booleans.

### Scope, Anti-Goals, And Boundaries

- FT-005 scope is respected: product-level favorites only, existing auth/session boundary,
  no guest persistence, no variant favorites, sharing, recommendations, or admin behavior.
- Customer ownership remains actor-derived. The browser wishlist path sends no bearer
  token and does not select a customer from request input.
- TASK-045 changes are confined to the acceptance harness channel-resolution boundary;
  no production route/workflow, auth provider, bearer mechanism, schema, or migration
  responsibility moved.

### Cross-Boundary Substance

- FT-004 provider doubles reach the standard Medusa callback and session-cookie flow;
  current-customer capability is obtained before browser setup.
- TASK-044 retention and TASK-045 publishable-key channel alignment supply fixtures, while
  TASK-042 independently proves the storefront projection through the long-lived Store API.
- Wishlist remains independent from cart merge state, and checkout remains blocked under
  `merge_blocked`.
- PostgreSQL/module cleanup is unconditional; the fresh run released runtime ports and
  stale state from the interrupted attempt was removed by the existing cleanup phase.

### Critical, Security, And Operational Review

- No production credentials, live providers, production data, cookies, session IDs, OAuth
  tokens, bearer values, or secrets were written to evidence.
- Publishable-key handling is internal to the local acceptance child process; only coarse
  resolution status/prefix evidence is retained.
- No irreversible operation, schema change, data-loss path, or production runtime change
  was introduced. Recovery evidence is present and credible for synthetic fixtures.
- Residual LOW risk: existing Next.js wishlist-control hydration warnings remain visible
  in the runtime log but did not fail an assertion or change the reviewed scope.

### Hidden Assumptions And How This Could Still Be Wrong

- The evidence assumes the local PostgreSQL instance and canonical seeded catalog are the
  intended synthetic test environment; the runner reports `productionData=false` and the
  privacy scan found no production payload.
- A future change could weaken the retained fixture handoff or current-handle projection;
  the positive browser assertions would need to remain mandatory in regression coverage.
- No owner decision is needed for the reviewed implementation; only scheduler-owned T3
  human checkpoint and lifecycle handling remain outside this read-only review.

### T3 Marker Status

- `HUMAN_CHECKPOINT: pending` is the exact existing status and was not emitted or changed.
- `ROLLBACK_RECOVERY_NOTE: present` is the exact existing status and was not emitted or
  changed.
- The semantic result is substantive `semantic-pass`; T3 closure still requires the
  scheduler/owner-controlled human checkpoint marker.

### Evidence Paths

- `.tasks/TASK-042/TASK-042-S-RED-VERIFY-final-report-docs-02.md`
- `.tasks/TASK-042/TASK-042-S-VERIFY-final-report-code-03.md`
- `.tasks/TASK-042/playwright/wishlist-browser-report.json`
- `.tasks/TASK-042/final-gate-results.md`
- `.tasks/TASK-042/final-privacy-scan.md`
- `.tasks/TASK-042/rollback-recovery-note.md`
- `.protocols/TASK-044/handoff.md`
- `.tasks/TASK-045/TASK-045-S-VERIFY-final-report-code-02.md`

## Scheduler Closure

The scheduler supplied the required T3 checkpoint and recovery markers after this
semantic-pass review; the Reviewer did not change lifecycle state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
