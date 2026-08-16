---
description: Adversarial semantic verification report for TASK-049.
status: complete
---
# TASK-049 Adversarial Semantic Verification

REVIEW_REPORT
- role: Reviewer
- task_id: TASK-049
- tier: T3
- mode: scheduler-read-only
- verdict: REQUEST_CHANGES
- semantic_verdict: semantic-fail

## Findings

- BLOCKER — cleanup is not guaranteed when fixture creation is interrupted.
  `apps/backend/src/scripts/smoke-checkout-delivery-acceptance.ts:637-709`
  creates the fulfillment set, stock location, links, service zone, and
  Shipping Options before returning their IDs. The caller records those IDs
  only after `createDeliveryFixtures()` returns (`:106-117`), and its outer
  cleanup is therefore unable to remove resources when any intermediate create
  operation throws (`:375-395`). The browser fixture path has the same gap:
  `fixtures` is assigned only after the factory returns (`:414-424`), while its
  failure handler cleans only when that aggregate exists (`:438-445`). The
  browser state file is written after all resources are created (`:425-428`),
  so a partial setup has no recovery ledger. This violates the packet stop
  condition that cleanup be guaranteed after success or interruption and can
  leave synthetic Admin/fulfillment data in PostgreSQL.

- HIGH — browser success artifacts can be stale or positive after a failed
  run. The runner truncates only `real-runtime-progress.log` at startup
  (`apps/storefront/e2e/run-real-medusa-e2e.cjs:55-58`); it does not invalidate
  the previous `checkout-browser-report.json` or `checkout-delivery.png`.
  Worse, the checkout report and screenshot are written before logout and the
  final `401` assertion (`:958-998`), so a later cleanup/logout failure can
  leave `status: ok` artifacts while the command exits unsuccessfully. The
  current filesystem corroborates the traceability problem: the scheduler
  rerun report is timestamped 13:42:46, while the browser JSON and screenshot
  are timestamped 13:25:43, `real-runtime.log` 13:26:21, and the newer
  `real-runtime-progress.log` ends at browser verification at 13:35:49. The
  current artifacts are sanitized, but they are not reproducibly tied to the
  claimed scheduler browser exit code 0. This is a false-success risk for the
  required T3 browser evidence.

- MEDIUM — server-side provider absence is asserted more strongly than it is
  observed. `providerRequest: false` is emitted as a literal in the backend
  report (`apps/backend/src/scripts/smoke-checkout-delivery-acceptance.ts:332-369`),
  and `assertReadOnlyCheckoutBoundary()` is only a narrow route/workflow text
  scan (`:905-925`). The browser request observer sees browser-origin requests,
  not server-side outbound calls (`apps/storefront/e2e/run-real-medusa-e2e.cjs:850-868`).
  Current production checkout source inspection found no order, inventory,
  payment, or provider mutation, and the DB mutation counts stayed unchanged;
  this remains an evidence-strength limitation rather than evidence that a
  provider mutation currently occurred.

## Purpose fit and acceptance assessment

- The core runtime boundary is substantively aligned: checkout uses the real
  compiled Medusa HTTP/session path, the route derives the actor from
  `req.auth_context`, and client-supplied `customer_id` is rejected. The
  browser uses the local provider double only for OAuth setup and then exercises
  the real Medusa session and `/store/checkout` boundary; checkout itself is not
  Playwright-mocked or backed by a fake server.
- The production tariff path reads Admin/Shipping Options and linked price-set
  data (`apps/backend/src/checkout/delivery-options.ts` and
  `delivery-tariffs.ts`). The `0/500/700` values in the acceptance script are
  synthetic fixture/expected-test data, not a runtime tariff registry; no
  production hardcoded tariff fallback or silent substitution was found.
- Unavailable delivery behavior is fail-closed: the backend returns
  `422 delivery_method_unavailable`, the browser keeps the unavailable method
  selected, and the test explicitly selects pickup afterward. No silent
  substitution was found.
- The route/workflow contain no order, inventory, payment, or provider module
  mutation; the backend acceptance compares order/payment-collection/reservation
  counts before and after, and the compiled runtime report records them
  unchanged. No current mutation was found, subject to the provider-evidence
  limitation above.
- Standard Medusa parser ownership (`req.validatedBody ?? req.body`) and deferred
  malformed-JSON normalization are accepted as intentional per the launch
  instruction; no parser contradiction is recorded.
- The inspected screenshot/report contain synthetic values only. No cookies,
  tokens, secrets, production data, or real PII were found. The task's claimed
  implementation surface is within the packet's allowed runtime/package/
  changelog paths; unrelated dirty worktree files are pre-existing adjacent
  task work and were not changed here.

## Cross-boundary and operational impact

- Cross-boundary impact: a failed browser setup can leak Admin fulfillment
  records, while a failed post-validation cleanup can leave positive evidence;
  both directly affect scheduler trust in FT-006 and the later FT-007/FT-009
  handoff gate.
- Architectural concern: the fixture factory has no resource ledger or
  compensating transaction. Cleanup is caller-owned only after a complete
  aggregate is returned, which is unsafe for a multi-resource T3 harness.
- State/data concern: the temporary state file is created too late to represent
  partial setup, and the positive report has no run ID/command completion stamp
  and is written before cleanup completion.
- Maintenance cost: every additional fixture resource increases the untracked
  partial-creation window; every new post-report assertion can create another
  stale-success path.

## Hidden assumptions and how this could still be wrong

- The current evidence implicitly assumes fixture setup is all-or-nothing and
  that a scheduler exit-0 report implies fresh browser artifacts. Neither
  assumption is enforced by the implementation.
- A future provider call hidden behind an imported helper could evade the narrow
  text scan and still produce `providerRequest: false`; the current source has
  no such call, but the proof is not robust.
- No missing product/spec decision changes the verdict. Fresh raw scheduler
  stdout could improve browser evidence provenance, but it would not remove the
  cleanup blocker in the source.

## Recommended escalation

1. Track every created fixture ID immediately (or persist a run manifest before
   the next create) and run compensating cleanup in the factory's own `finally`
   path, including partial setup and failed state-file writes.
2. Remove or mark old browser success artifacts at run start; write the success
   report/screenshot only after logout, fixture cleanup, process shutdown, and
   released-port checks succeed. Include a run ID and completion timestamp.
3. Add a server-side provider-call spy/audit or explicitly record the exact
   source-based limitation instead of treating a literal flag as observed
   network evidence.
4. Rerun the required backend/browser acceptance after those fixes and create a
   new semantic verification pass. This review intentionally did not run the
   long browser command and did not modify implementation, task status, packet,
   dependents, or closure markers.

## Evidence checked

- `AGENTS.md`, `.memory-bank/commands/red-verify.md`,
  `.agents/skills/red-verify/SKILL.md`, `.memory-bank/roles/worker.md`.
- `.memory-bank/tasks/TASK-049.task.json`,
  `.memory-bank/packets/TASK-049.packet.json`,
  `.memory-bank/workflows/tier-policy.md`, the FT-006 feature/architecture/
  contract/data/state specs, customer-auth state, testing strategy, API
  guidelines, implementation plan, BR-002, and FT-006 protocol files.
- All files under `.protocols/TASK-049/`,
  `.tasks/TASK-049/TASK-049-S-VERIFY-final-report-docs-03.md`, and
  `.tasks/TASK-049/TASK-049-S-runtime-rerun-final-report-code-02.md`.
- Runtime source and browser harness listed above; read-only source/diff,
  artifact timestamp, privacy, temp-file, and port checks. The long browser
  command was not run.

## Failure / Blocker

- Status: failed
- Where: fixture factory cleanup and browser evidence lifecycle.
- Expected: truthful, fresh browser evidence and unconditional cleanup after
  success or interruption.
- Observed: partial fixture IDs are not retained on factory failure, and stale
  positive browser artifacts can survive failed or incomplete runs.
- Likely category: code and verification.
- Recommended next action: repair the fixture resource ledger/rollback and
  evidence invalidation/order, then rerun the required gates and repeat
  semantic verification.

SEMANTIC_VERDICT: semantic-fail
