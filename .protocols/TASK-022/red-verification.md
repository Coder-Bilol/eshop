---
description: TASK-022 adversarial semantic verification.
status: complete
---
# TASK-022 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Scope

- Task: `TASK-022`
- Tier: `T2`
- Mode: manual per-task `/red-verify`
- Verified at: `2026-07-09`
- Functional `/verify`: PASS on 2026-07-09
- Task status change: none; per-task `/red-verify` is optional evidence for T2
  task closure and does not complete FT-003 as a feature.

## Top Substance Risks

No blocking substance risks were found for TASK-022.

Hostile risks checked:

- browser storage could become authoritative for cart items, quantities, totals,
  ownership, auth, or availability;
- local state could pass tests while ignoring backend cart responses;
- stale-reference recovery could reconstruct cart contents from cached data;
- quantity updates could become delta-based instead of absolute;
- UI/provider work could leak into cart page, product-detail, authenticated
  merge, OAuth, backend, checkout, order, or payment scope;
- local tests could prove only mocked behavior while the state boundary no
  longer matches the Store client/reference contract from TASK-018.

Current evidence does not support those failures.

## False-Success / Purpose Fit Assessment

TASK-022's purpose is to provide a deterministic guest-cart state boundary
before rendering and post-auth integration. The implementation fits that
purpose:

- `createGuestCartStateController` composes the TASK-018 Store cart client and
  reference adapter instead of creating a parallel cart API or local cart model.
- First valid add resolves an existing backend cart or creates one lazily, then
  calls the backend add-line operation.
- Restore, add, absolute update, and remove all adopt the returned backend cart
  response as state truth.
- The reference adapter remains the only durable browser persistence boundary,
  and it stores only `{ version, cart_id }`.
- Stale/not-found references are cleared and return an empty state rather than
  rebuilding cart contents from browser data.
- Backend failures retain the opaque reference for retry instead of clearing it
  as stale.

This is not a false PASS for authenticated merge or buyer-visible cart UI; those
remain downstream tasks.

## Anti-Goal And Scope Assessment

- Cart page markup: not implemented.
- Product-detail rendering or handoff changes: not implemented.
- Authenticated merge, OAuth, or post-auth reference switch: not implemented.
- Backend, checkout, order, inventory reservation, payment, or production
  behavior: not touched.
- Browser cart payload cache: not introduced.

Scope scans found only expected references:

- `product-detail` appears only in `apps/storefront/src/test-runner.cjs` suite
  registration.
- `customer_id`, `token`, `authorization`, and payload-like fields appear in
  `cart-state.test.cjs` as forbidden-string assertions or synthetic cart
  fixtures, not as local persistence fields.

## Weak-Context Questions

No weak-context question blocks this task-level semantic verdict.

Non-blocking follow-up boundaries:

- TASK-023 still needs to prove buyer-visible cart UI states.
- TASK-024 still needs to prove authenticated post-merge reference switching.
- TASK-026 still needs real-browser FT-003 acceptance evidence across
  persistence and post-auth merge handoff.
- Feature-level `/red-verify --feature FT-003` remains required after all
  FT-003 tasks pass.

## Hidden Assumptions

- The TASK-018 Store client continues to normalize installed Medusa Store cart
  routes and errors as specified.
- Medusa cart IDs are safe opaque references for browser storage.
- Empty backend carts may remain referenced after remove; this is consistent
  with backend-owned cart truth and does not make the browser authoritative.
- If browser storage is unavailable during lazy create, the controller reports a
  recoverable error rather than claiming persistence; final UX handling belongs
  to TASK-023.

These assumptions are consistent with the linked task split and current test
evidence.

## Cross-Boundary Impact

- TASK-018 -> TASK-022: the state controller uses the existing Store client and
  reference adapter; it does not bypass them.
- TASK-022 -> TASK-023: provider/controller expose state and commands for UI
  rendering without adding cart markup in this task.
- TASK-022 -> TASK-024: no authenticated merge or reference switch is claimed;
  future post-auth integration must use backend merge success as the switch
  trigger.
- FT-003 remains incomplete until downstream UI, handoff, backend acceptance,
  and browser acceptance tasks pass.

## Architectural Concerns

No architectural drift found:

- no new service, queue, cache, broker, deployment unit, or custom event
  contract;
- no direct storefront-to-database access;
- no duplicate custom Store cart CRUD API;
- no Medusa Core modification;
- no backend route or workflow ownership moved into the storefront.

The provider is thin and bounded to client-side state subscription and restore
on mount.

## State/Data Consistency Concerns

No blocking state/data consistency concern found:

- the only durable browser state is the reference envelope;
- backend cart responses are adopted after each successful operation;
- malformed/payload-bearing references are cleared by the adapter;
- `cart_not_found` clears the reference, while backend-unavailable states keep
  the reference for retry;
- stock conflict preserves the latest backend cart response from lazy creation
  without persisting cart payloads;
- line quantity updates pass absolute quantities to the Store client.

## Operational Concerns

- Evidence uses synthetic local fixtures, not production data or secrets.
- `git` is unavailable in the current PowerShell PATH, so diff-based audit was
  not possible. The scope conclusion relies on task/packet allowed scope,
  execute scope audit, direct file reads, and targeted scans.
- Strict doctor passes with two readiness warnings for planned tasks; those are
  status-transition candidates and not semantic blockers.

## Future Maintenance Cost

Maintenance cost remains bounded:

- the controller centralizes guest-cart state transitions without adding a new
  persistence abstraction;
- tests cover the critical state matrix directly;
- provider API is narrow enough for TASK-023/TASK-024 to consume without
  leaking backend internals;
- no speculative merge, auth, checkout, or payment hooks were added early.

## How This Could Still Be Wrong

- TASK-023 could render recoverable errors or empty active carts poorly even
  though the state controller is semantically sound.
- TASK-024 could mishandle authenticated merge target adoption; TASK-022 does
  not prove post-auth switching.
- Real browser storage quirks may need UI-level handling beyond these pure
  controller tests.
- Future Store client error-code changes could alter stale-vs-backend-failure
  classification and should be caught by cart-state/cart-client regression.

## Counterproposal / Escalation Path

No TASK-022 rework is recommended.

Recommended next actions:

- keep `TASK-022` available for explicit closure/sync by the scheduler or manual
  closure owner;
- continue with TASK-023 only after the chosen status owner accepts the current
  `/verify` PASS and this per-task semantic-pass;
- run feature-level `/red-verify --feature FT-003` only after all FT-003 tasks
  are implemented and task-level gates are satisfied.
