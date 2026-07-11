---
description: Adversarial semantic verification for TASK-024 post-auth cart merge handoff.
status: complete
---
# TASK-024 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Scope

- Mode: per-task `/red-verify TASK-024`.
- Tier: T3.
- Feature: FT-003.
- Basis: task record, required packet, full protocol, `/verify PASS`, linked
  FT-003 API/security/state/UX specs, implementation files, and evidence under
  `.tasks/TASK-024/`.
- Packet `source_task_hash` was refreshed after the task record red-verification
  entry was added and matches the updated task record.
- Status ownership: this red-verification does not close, fail, block, or promote
  the task.

## Top Substance Risks

| Hostile hypothesis | Result |
|---|---|
| Client could choose destination/customer and bypass backend ownership. | Not observed. Request body is `{}`, source is path-derived from stored cart reference, and no destination/customer authority is sent. |
| A malformed success response could switch the reference to a wrong cart. | Not observed. Response validation requires source match, non-empty target, target equal to `cart.id`, known outcome, and boolean replay marker before `writeCartReference`. |
| Recoverable failures could discard the source reference. | Not observed. Error paths throw before `writeCartReference`; tests cover forbidden, in-progress, not-found/stale, server failure, stock conflict, and invalid response. |
| Consumed-source ordinary CRUD could silently become target adoption. | Not observed. Ordinary restore clears not-found consumed source; target adoption happens only through authenticated merge replay. |
| Provider handoff could leak auth/provider details or implement OAuth scope. | Not observed. `CartProvider` exposes only `mergeAfterAuthentication()` and contains no Google/VK/OAuth provider logic or auth-token persistence. |

## False-Success And Purpose Fit

- Purpose fit: yes. TASK-024 adds a narrow provider-agnostic post-auth handoff
  that FT-004 can invoke after authentication.
- Success outcome: substantially achieved for this slice. Successful merge and
  replay responses switch the stored reference to the backend-selected target;
  failure paths preserve recoverable source state.
- No evidence that the implementation merely satisfies local assertions while
  missing the actual post-auth reference-switching purpose.

## Anti-Goal And Scope Assessment

- No Google OAuth, VK ID, login UI, or callback routes were added.
- No client-side customer identity inference was added.
- No backend merge semantics, checkout, order, inventory reservation, payment,
  production mutation, queue, cache, or new service was added.
- Allowed scope matches TASK-024 files plus protocol/evidence artifacts.
- Forbidden scope was not observed in implementation files.

## Cross-Boundary Impact

- API boundary: respects `POST /store/carts/{source_cart_id}/merge`, empty body,
  `x-publishable-api-key`, and `credentials: include`.
- Security boundary: backend remains responsible for actor identity, destination
  selection, ownership checks, replay, and merge semantics.
- State boundary: browser storage remains an opaque `eshop.cart.v1` reference;
  no item, quantity, auth token, customer ID, or total payload is persisted.
- Feature boundary: FT-004 remains responsible for actual auth provider login and
  callback integration.

## Critical/Security And Operational Concerns

- Secrets exposure: no full session cookie, bearer token, OAuth token, customer
  email/contact data, or production payload evidence found.
- Data loss: the frontend never mutates backend carts directly and preserves the
  source reference on frontend-recognized merge failure paths.
- Retry/replay: completed replay adoption is routed through the authenticated
  merge endpoint; ordinary Store CRUD not-found handling does not adopt target.
- Runtime risk: `mergeAfterAuthentication()` restores state after target reference
  switch; if the follow-up restore fails, the target reference remains stored and
  the failure is recoverable, but FT-004 should surface a retryable UI state.
- T3 closure markers: semantic review does not provide human approval or recovery
  marker evidence. They remain required before closure.

## Hidden Assumptions

- Backend TASK-021 continues to enforce authenticated actor, ownership, journal
  replay, and stable error semantics.
- FT-004 caller awaits `mergeAfterAuthentication()` and renders success/failure
  based on the returned result/state instead of assuming login alone completed
  merge.
- Medusa auth/CORS/CSRF configuration is finalized by FT-004 or deployment work;
  TASK-024 correctly avoids provider-specific decisions.

## How This Could Still Be Wrong

- A future FT-004 caller could ignore rejected merge promises and render a false
  merged state.
- A backend regression could return internally inconsistent successful merge
  payloads; the current frontend validation catches target/source mismatches but
  relies on backend semantics for actor/customer validity and quantity effects.
- A network failure during post-merge restore could leave the target reference
  stored while UI state is temporarily not refreshed; this is recoverable but
  must be handled by the eventual auth UI.

## T3 Closure Check

- `/verify PASS`: present.
- Per-task `/red-verify`: this report records `semantic-pass`.
- Human checkpoint marker: pending; no human approval marker is recorded here.
- Rollback/recovery marker: pending; no closure recovery marker is recorded here.

## Counterproposal / Escalation Path

- No replan or bug is recommended for TASK-024 substance.
- Before closure, run the T3 closure owner step to record human checkpoint and
  rollback/recovery evidence, then `/mb-sync` if appropriate.
- During FT-004 implementation, add UI-level handling for rejected
  `mergeAfterAuthentication()` and post-merge restore failures.
