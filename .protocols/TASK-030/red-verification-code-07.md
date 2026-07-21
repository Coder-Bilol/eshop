# TASK-030 Independent Red Verification Code 07

## Findings

- No actionable semantic, security, state-consistency, scope, or regression findings.

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Run: adversarial code-07 verification of the code-06 recovery

SEMANTIC_VERDICT: semantic-pass

## Purpose Fit And False-success Assessment

- Purpose fit is achieved. The storefront exposes one deterministic cookie-session
  customer boundary that can start both configured providers, establish customer
  state only from backend truth, preserve only safe navigation state, and complete
  logout without token or prior-cart leakage.
- The recovery solves the actual shared-browser/session-authority problem rather than
  only making a focused test green. Installed Medusa makes DELETE `401` an
  authoritative no-session result; the implementation now converges that result to
  guest through mandatory local cleanup.
- False-success risk was challenged with a separate black-box harness rather than
  relying only on implementation tests. It combined actual-client DELETE `401`, two
  logout callers, restore overlap, first cart cleanup failure, and cleanup-only retry.
  It also challenged genuine `503` preservation, current-customer expiry, URL parser
  normalization, raw query limits, and storage faults. All passed.
- The literal-fragment fix is placed before WHATWG normalization, so it closes the
  semantic distinction between no fragment and a trailing empty `#` instead of
  attempting another post-normalization heuristic.

## Hostile Cross-boundary Assessment

- Auth/session authority: PASS. Current-customer success is the only local identity
  proof. Current-customer `401` becomes guest; DELETE `401` also becomes guest but,
  unlike passive expiry, completes explicit shared-browser return-path/cart cleanup.
- Failure semantics: PASS. Only `AuthClientError` status `401` is treated as confirmed
  absence. Network errors, 5xx, malformed responses, and other statuses preserve the
  last confirmed customer/cart state and surface a recoverable error without cleanup.
- Race safety: PASS. Logout is single-flight, dominates stale customer responses,
  makes restore join the terminal operation, and retains confirmed state when
  deletion genuinely fails. Once deletion/absence is confirmed, customer identity
  is cleared before local cleanup.
- Cart boundary: PASS. Auth orchestration invokes only the existing public
  `clearLocalReference()` boundary and does not alter FT-003 ownership or merge
  semantics. Cleanup failure cannot produce false guest; retry does not repeat the
  destructive session operation.
- Redirect boundary: PASS. The implementation accepts only exact real Google/VK
  HTTPS authorization paths and provider-bound backend callbacks. It rejects raw
  literal fragments before URL parsing and retains the `TASK-043` bounded malformed-
  query checks before forgiving normalization.
- Storage/privacy: PASS. The safe return path is internal-only, versioned, one-shot,
  and fail-closed under covered storage faults. No auth/provider token, customer
  payload, secret, session credential, or wishlist/cart payload is introduced into
  auth browser storage.
- State/data consistency: PASS. Explicit logout cleans only browser references and
  in-memory identity; passive session expiry clears in-memory authority. Neither path
  deletes durable Auth, Customer, or cart records.
- Architecture/scope: PASS. No parallel identity/session model, backend callback
  drift, cart semantic drift, checkout/payment scope, or Medusa Core change was
  introduced. The local sequence/single-flight model remains small and reviewable.
- Operational behavior: PASS. Failures are sanitized and retry behavior is explicit.
  Query work is capped at 4096 characters, 32 segments, and three decode rounds.
- Maintenance cost: acceptable. The recovery adds two local policy checks to the
  existing controller/validator and focused regressions; it does not add a new state
  machine or parser framework.

## Anti-goals And Autonomy

- No provider callback backend logic, login/checkout page design, cart merge change,
  order/payment work, browser token persistence, lifecycle mutation, or sync was
  performed by the recovery or Reviewer.
- Runtime/test changes stay inside packet R14 allowed scope. The broad dirty worktree
  contains separately indexed work and was not modified or attributed to TASK-030.
- Packet, task, linked SDD specs, `TASK-043` closure, implementation handoff, and all
  prior functional/semantic findings are consistent; no weak-context blocker remains.

## Critical T3 Assessment

- Security/privacy: session authority, shared-browser cleanup, exact provider
  destinations, malformed query rejection, credentials include, and token
  non-persistence pass independent review.
- Runtime/production: full tests, typechecks, builds, provider/backend integration
  gates, lint, doctor, and independent hostile probes pass. The earlier parallel
  PowerShell wrapper failures were rerun successfully in isolation.
- Irreversible/data-loss/compliance: no migration, production write, durable deletion,
  payment, or compliance behavior belongs to this task.
- Human checkpoint: explicit and credible in the operator instruction and handoff.
- Rollback/recovery: credible. Revert the bounded storefront auth/test changes or
  disable provider starts; rotate provider/session signing secrets and invalidate
  sessions after suspected compromise while preserving durable records.

## Hidden Assumptions And How This Could Still Be Wrong

- Live Google/VK UAT remains an external staging checkpoint. Installed provider code,
  synthetic provider smoke, and exact generated-path tests establish current contract
  compatibility, but a future provider parameter/path change requires reviewed UAT.
- The return-path one-shot guarantee uses an in-memory tombstone when browser storage
  cannot be read or changed. A browser restart during a persistent storage fault is a
  known residual limitation, but no unsafe/replayed path is returned in the verified
  runtime and this does not contradict the current contract.
- Full browser logout acceptance remains assigned to `TASK-034`. That later E2E may
  find browser integration issues, but no current unit, boundary, source, or build
  evidence indicates an unresolved TASK-030 defect.

## Counterproposal / Escalation Path

- None required for TASK-030. Future provider destination or query-limit changes must
  be reviewed explicitly rather than broadening this trust boundary silently.

## Closure Recommendation

- APPROVE. With code-07 functional `VERDICT: PASS`, `TASK-030` satisfies the T3
  scheduler closure gates. Scheduler may record `done`, then reevaluate dependents
  (`TASK-031` ready; `TASK-032` still blocked on `TASK-031`; `TASK-039` still blocked
  on `TASK-038`) and later own `/mb-sync`.
- Reviewer did not close/fail/block/promote tasks, edit task/packet records, execute a
  fix, or run `/mb-sync`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
