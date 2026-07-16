---
description: Per-task adversarial semantic verification for TASK-026 browser cart persistence and merge acceptance.
status: complete
---
# TASK-026 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Mode And Status

- Mode: manual per-task `/red-verify TASK-026`.
- Tier: T3.
- Scope: browser acceptance substance, provider handoff boundary, synthetic auth,
  data safety, and E2E operational behavior.
- Task status remains unchanged; closure was not requested.
- T3 markers remain pending for a later explicit closure owner.

## Top Substance Risks Checked

- False success through raw merge API plus manual storage mutation: resolved. The
  runner dispatches an E2E-only trigger that calls the existing
  `mergeAfterAuthentication()` provider handoff and observes its target/reference
  and restored-state results.
- Provider login/OAuth scope drift: not found. The trigger is limited to the
  local E2E runtime; it does not add a login UI, provider configuration, or
  production credentials.
- Browser choosing customer/destination identity: not found. The event accepts no
  cart/customer/destination payload; backend selects the target. Synthetic bearer
  injection is limited to E2E fetches ending in `/merge`.
- Replay/data-loss false confidence: not found. Replay runs from a stale browser
  context that retains the consumed source reference, returns `already_merged`,
  restores the target reference/provider state, and retains exact quantity 5.
- Production/runtime drift: not found. The hook is absent unless the runner sets
  `NEXT_PUBLIC_E2E_CART_HANDOFF=true`; normal runtime behavior remains unchanged.

## Purpose And Anti-Goal Assessment

- Purpose fit: pass. The task now proves buyer-visible guest persistence and the
  actual post-auth provider handoff against compiled local Medusa/PostgreSQL.
- Success outcome: pass. REQ-006 through REQ-008 are observed in a real browser
  with reference-only storage, target selection by the backend, consumed-source
  Store 404, and replay without quantity duplication.
- Anti-goals: pass. Backend merge workflow, live OAuth, production data,
  checkout, order, inventory reservation, and payment scope remain untouched.

## Cross-Boundary Assessment

- Storefront boundary: product detail, cart view, `CartProvider`,
  `mergeAuthenticatedCartReference`, and storage reference behavior are exercised
  without exposing a provider-specific production UI.
- API/security boundary: merge still accepts source only from the existing
  reference and uses the backend-selected target. The synthetic bearer is not
  persisted or returned in evidence.
- State/data boundary: actual provider restore occurs after successful merge and
  stale replay starts with the consumed source reference, so the E2E flow tests
  both directions of the reference transition.
- Architecture: no new service, queue, cache, duplicate CRUD API, Medusa Core
  modification, or direct database access is introduced.

## Operational And Maintenance Assessment

- The E2E hook uses named browser events and is guarded by one explicit public
  E2E environment flag set only by the runner.
- The fetch wrapper adds synthetic bearer auth only for exact merge endpoint
  paths; other browser requests retain the original fetch behavior.
- The runner retains trace/screenshots and releases browser/backend/storefront
  ports after success.
- Maintenance cost is acceptable: the test seam is small, local to the provider,
  and exists only to exercise the already-public provider handoff without
  implementing FT-004 login UI.

## Residual Risks And How This Could Still Be Wrong

- The production cookie-session authentication configuration is owned by FT-004;
  this task validates the provider handoff with permitted synthetic bearer auth,
  not a live provider callback.
- An accidental production setting of `NEXT_PUBLIC_E2E_CART_HANDOFF=true` would
  expose a browser event that invokes the same authenticated merge action. It
  carries no custom identity/target input, but deployment configuration must keep
  the flag unset outside E2E.
- Browser acceptance cannot replace TASK-025 server evidence for ownership,
  compensation, and concurrency; that task remains the backend proof.

## Counterproposal / Escalation Path

- No blocker or follow-up is required for TASK-026 semantic acceptance.
- FT-004 should call `mergeAfterAuthentication()` from its real callback/session
  boundary rather than reimplementing merge request or reference-switch logic.
- Before closure, an explicit owner must record human checkpoint and
  rollback/recovery markers; after all FT-003 tasks close, run feature-level
  `/red-verify --feature FT-003`.

## Fresh Commands

- PASS: `npm run smoke:local`
- PASS: `npm --workspace apps/storefront run test:e2e -- cart`
- PASS: `npm run typecheck`
- PASS: `node scripts/mb-lint.mjs`

## Verdict

Per-task semantic verification passes. TASK-026 is eligible for manual T3
closure only after an explicit closure owner records the human checkpoint and
rollback/recovery markers.
