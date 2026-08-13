---
description: T2 implementation plan and gate record for TASK-045.
status: in_progress
---
# TASK-045 Plan

## Scope Contract

- Make the smallest acceptance-only alignment needed for synthetic wishlist fixtures to
  use the browser publishable-key sales channel.
- Keep production wishlist/auth/catalog behavior, routes, workflows, auth transport,
  schema, and live-provider configuration unchanged.
- Preserve TASK-041 write/read/cleanup and TASK-044 browser-setup retention semantics.
- Use Medusa `QUERY` for local API-key/channel resolution and the real browser Store API;
  no browser database/module bypass or new authentication path.
- Lifecycle remains scheduler-owned.

## Goal Interpretation

- Purpose: fix the acceptance fixture channel mismatch blocking browser-positive lifecycle
  verification.
- Success outcome: browser-visible restored and out-of-stock fixtures are retained and
  observable through the actual publishable-key-selected channel, while hidden products
  remain omitted.
- Anti-goals: no production behavior, bearer/session workaround, direct browser DB/module
  access, real secrets, production data, or public contract change.

## Work Completed

1. Passed the actual publishable key from the browser runner to local acceptance phases.
2. Resolved the key's linked channel through the supported Medusa query graph boundary.
3. Bound non-channel-hidden synthetic products to that channel and persisted the channel
   in run state; retained the unlinked channel-hidden fixture.
4. Revalidated the selected channel before fresh-process read and browser setup.
5. Kept browser-positive assertions on the long-lived Store API and retained fixture
   cleanup unconditional. Made list mutation assertions retention-aware without changing
   storefront production behavior.
6. Ran implementation gates and captured sanitized evidence for the next owner.

## Acceptance Matrix

- `salesChannelResolution=publishable-key-query` and `fixtureSalesChannelAligned=true`.
- Browser setup retains hidden `4`, restored `1`, and out-of-stock `1` rows.
- Browser Store API observes `visibleRows=2`, restored presence, and out-of-stock
  `is_available=false`.
- Four hidden causes remain unified `404` on add and omitted on list.
- TASK-041 acceptance and TASK-044 retention/cleanup remain green.
- No production wishlist/auth/catalog, bearer path, schema, or live-provider change.

## Local Gates

| Gate | Result | Evidence |
|---|---|---|
| `npm --workspace apps/backend run test:integration -- wishlist-acceptance` | PASS | `.tasks/TASK-045/gate-results.md` |
| `npm --workspace apps/storefront run test:e2e -- wishlist` | PASS | `.tasks/TASK-045/acceptance-evidence.md` |
| `npm --workspace apps/storefront run test` | PASS | `.tasks/TASK-045/gate-results.md` |
| `npm run typecheck` | PASS | `.tasks/TASK-045/gate-results.md` |
| `npm run build` | PASS | `.tasks/TASK-045/gate-results.md` |
| `node scripts/mb-lint.mjs` | PASS | `.tasks/TASK-045/gate-results.md` |
| `node --check apps/storefront/e2e/run-real-medusa-e2e.cjs` | PASS | `.tasks/TASK-045/gate-results.md` |
| Scoped `git diff --check` | PASS | `.tasks/TASK-045/gate-results.md` |
| Privacy scan | PASS | `.tasks/TASK-045/privacy-scope-evidence.md` |

## Ownership

- Implementer: code, local gates, and implementation evidence only.
- Verifier: independently run `/verify TASK-045` and record its functional verdict.
- Scheduler: own task status, packet/task-record changes, closure, feature semantic gate,
  and `/mb-sync`.

## Handoff

- Full protocol is present in `.protocols/TASK-045/`.
- Evidence is present in `.tasks/TASK-045/`.
- `/verify`, `/red-verify`, `/mb-sync`, task status changes, packet edits, and closure
  markers were not performed.
