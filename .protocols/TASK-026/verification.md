---
description: Independent verification evidence for TASK-026 browser cart persistence and merge acceptance.
status: complete
---
# TASK-026 Verification

VERDICT: FAIL

## Mode And Status

- Mode: manual `/verify TASK-026`.
- Tier: T3.
- Task status: unchanged by this verification run.
- Recommended status: `failed` until the actual storefront handoff is covered by
  browser acceptance and `/verify` passes again.

## Required Packet And Specs

- Required packet: `.memory-bank/packets/TASK-026.packet.json`.
- Packet status before verification: `ready`.
- Packet `source_task_hash` matched the current task record before this
  verification evidence was recorded.
- Linked FT-003 SDD specs and the cart API/security/testing contracts were read
  as the normative basis.

## Fresh Gate Results

| Gate | Result | Evidence |
|---|---|---|
| `npm run smoke:local` | PASS | `.tasks/TASK-026/verify-command-output.md` |
| `npm --workspace apps/storefront run test:e2e -- cart` | PASS | `.tasks/TASK-026/verify-command-output.md` |
| `npm run typecheck` | PASS | `.tasks/TASK-026/verify-command-output.md` |
| `node scripts/mb-lint.mjs` | PASS | `.tasks/TASK-026/verify-command-output.md` |

## Acceptance Results

| Acceptance target | Verification result |
|---|---|
| Real browser starts from a valid product-detail variant, creates a guest cart, updates/removes lines, and restores it after reload/new context. | PASS. Fresh Playwright run used the compiled local Medusa/PostgreSQL runtime, created the cart from product detail, reflected absolute update/remove, and restored the opaque reference after reload/new context. |
| Synthetic authenticated context merges into an existing customer cart and atomically switches to the backend-selected target. | FAIL. The E2E runner calls the merge route directly and writes the target reference itself; it does not execute the storefront `mergeAfterAuthentication()` handoff or prove its validation/state restoration. |
| Repeated handoff keeps exact quantities and stale consumed-source Store access returns not found before authenticated replay recovers the target. | PARTIAL. Backend route replay returns quantity 5 and source Store retrieval returns 404, but these assertions are made through the harness's raw request/manual-reference path rather than the storefront handoff. |
| REQ-006 through REQ-008 are evidenced without live OAuth or later checkout/order scope. | PARTIAL. REQ-006/REQ-007 browser evidence passes and the test uses synthetic local emailpass auth without later scope. REQ-008 buyer-visible handoff evidence is incomplete. |
| T3 closure includes `/verify PASS`, per-task semantic-pass, human checkpoint, and rollback/recovery evidence. | FAIL/PENDING. Functional `/verify PASS` is absent; do not run closure steps. |

## Functional Blocker

- Bug: `.memory-bank/bugs/TASK-026-browser-merge-handoff-bypass.md`.
- The task purpose requires buyer-visible evidence for the post-auth merge
  handoff, not only a successful raw API request plus manually written browser
  storage.
- The current harness bypasses the code that validates the response, writes the
  backend-selected target reference, and restores storefront state.

## Scope And Anti-Goals

- Fresh runtime evidence confirms synthetic local data, no live OAuth provider,
  no production data, and no checkout/order/inventory/payment flow.
- The failure is evidence coverage/implementation scope, not a secrets or
  production-data exposure finding.

## Evidence Files

- `.tasks/TASK-026/verify-command-output.md`
- `.tasks/TASK-026/verify-handoff-boundary-audit.md`
- `.tasks/TASK-026/TASK-026-S-verify-final-report-code-01.md`
- `.memory-bank/bugs/TASK-026-browser-merge-handoff-bypass.md`

## Verdict

The required technical gates pass, but functional `/verify` fails. TASK-026 is
not closure-eligible until browser acceptance exercises the actual storefront
post-auth handoff and a later `/verify` returns PASS.

## Reverification 2026-07-12

### Remediation Evidence

- The user approved an E2E-only provider trigger gated by
  `NEXT_PUBLIC_E2E_CART_HANDOFF=true`; ordinary storefront runtime does not
  register the trigger.
- The runner no longer calls the merge API through `mergeCartInBrowser()` or
  writes the target reference with `writeBrowserCartReference()`.
- The primary merge dispatches the provider trigger and observes the actual
  `mergeAfterAuthentication()` result: source ID, backend-selected target ID,
  `merged` outcome, non-replay result, target reference, and restored provider
  state.
- Replay starts in a stale browser context that still holds the consumed source
  reference and invokes the same provider trigger. It observes
  `already_merged`, the recorded target, restored provider state, exact quantity
  5, and no duplicate increment.
- Synthetic bearer injection is limited to the E2E fetch wrapper for the merge
  endpoint. No live OAuth, provider login UI, production data, backend merge
  behavior, checkout, order, inventory reservation, or payment scope was added.

### Fresh Reverification Gates

| Gate | Result | Evidence |
|---|---|---|
| `npm run smoke:local` | PASS | `.tasks/TASK-026/verify-command-output.md` |
| `npm --workspace apps/storefront run test:e2e -- cart` | PASS | `.tasks/TASK-026/verify-command-output.md` |
| `npm run typecheck` | PASS | `.tasks/TASK-026/verify-command-output.md` |
| `node scripts/mb-lint.mjs` | PASS | `.tasks/TASK-026/verify-command-output.md` |

### Final Acceptance Results

- PASS: a real browser creates a guest cart from product detail, updates/removes
  lines, and restores it after reload/new context.
- PASS: synthetic authenticated context invokes the actual storefront provider
  handoff, which atomically adopts the backend-selected target and restores
  provider state.
- PASS: a stale consumed-source context receives Store 404 before replay; actual
  handoff replay adopts the recorded target with exact quantity and no duplicate.
- PASS: REQ-006 through REQ-008 are evidenced without live OAuth, production
  data, checkout, order, inventory reservation, or payment scope.

### Final Verdict

VERDICT: PASS

The earlier `VERDICT: FAIL` is superseded by this re-verification. TASK-026 is
functionally verified but T3 closure still requires per-task `/red-verify`,
human checkpoint, and rollback/recovery markers.
