---
description: Execution plan for TASK-044 wishlist lifecycle fixture retention.
status: in_progress
---
# TASK-044 Plan

## Scope Contract

- Implement only the acceptance-harness retention/setup change and its changelog entry
  in the task's approved scope.
- Preserve the existing TASK-041 write/read/cleanup acceptance behavior.
- Use synthetic local fixtures and the existing standard customer ownership handoff.
- Do not choose a new product, API, auth, data, schema, or public-contract behavior.
- Protocol and evidence artifacts are implementation records; task lifecycle remains
  owned by the scheduler.

## Planned Work Sequence

1. Inspect the existing TASK-041 acceptance harness and its current write/read/cleanup
   phase boundary.
2. Add a local `browser-setup` phase that accepts the synthetic browser customer actor,
   seeds hidden durable rows through the acceptance module service, restores the visible
   product, and retains the visible out-of-stock row.
3. Return only synthetic fixture IDs/handles and coarse row counts; do not expose hidden
   rows through the Store API or add a production bearer/auth path.
4. Preserve unconditional cleanup for both successful and interrupted runs, including
   all synthetic rows and fixtures.
5. Run the task gates and local browser-setup smoke, record sanitized evidence under
   `.tasks/TASK-044/`, and hand off to the independent verifier and scheduler.

If any step requires a forbidden file, a production behavior change, or an unresolved
product/spec/public-contract decision, stop and report the blocker instead of widening
the task locally.

## Exact Acceptance Matrix

- A browser-customer-bound retention/setup phase keeps synthetic hidden, restored, and
  out-of-stock rows available for the real browser read.
- Hidden rows remain durable and omitted, restored products reappear, and visible
  out-of-stock products remain listable with `is_available` false until cleanup.
- The existing unconditional cleanup removes all synthetic rows and fixtures after
  success or interruption without production data access.
- No production wishlist/auth/catalog behavior or bearer/auth boundary is changed.
- The existing TASK-041 acceptance write/read/cleanup behavior remains covered.
- The standard local customer ownership handoff is used without direct database/module
  insertion, production auth changes, or a new bearer path.

## Intended Gates

| Gate | Required | Evidence target | Status |
|---|---:|---|---|
| `npm --workspace apps/backend run test:integration -- wishlist-acceptance` | yes | Existing TASK-041 write/read/cleanup acceptance output | PASS |
| `npm --workspace apps/backend run typecheck` | yes | Backend typecheck output | PASS |
| `node scripts/mb-lint.mjs` | yes | Memory Bank lint output | PASS |

Additional evidence is substantive local output under `.tasks/TASK-044/`: browser actor
handoff/retention output, privacy/scope evidence, rollback/recovery evidence, and proof
that TASK-041 coverage remains intact. These are evidence requirements, not new product
decisions.

## Stop Conditions

- The existing harness cannot safely hand off a synthetic browser customer actor.
- Retention would require weakening hidden-product privacy or changing production
  routes/workflows.
- Cleanup cannot be guaranteed on success and interruption.
- The fix requires edits outside the acceptance harness and changelog without an
  additional owner decision.
- The existing TASK-041 acceptance write/read/cleanup coverage regresses or requires
  production data, live providers, credentials, cookies, bearer values, tokens, session
  IDs, or secrets.

## Ownership Boundaries

- Implementer: make the bounded harness/changelog change, run local gates, and record
  evidence without changing task lifecycle.
- Implementer: make the bounded harness/changelog change, run intended local gates, and
  record evidence without changing task lifecycle.
- Verifier: independently evaluate acceptance evidence and issue the T2 functional
  verdict; do not decide scheduler lifecycle state.
- Scheduler: own status/closure decisions, feature-level semantic verification routing,
  task-record evidence links, and `/mb-sync`.
