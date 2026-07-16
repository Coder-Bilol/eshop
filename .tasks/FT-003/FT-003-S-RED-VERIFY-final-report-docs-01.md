---
description: FT-003 feature-level adversarial semantic verification report.
status: complete
---
# FT-003 Feature Red Verification

SEMANTIC_VERDICT: semantic-concern

## Scope And Preconditions

- All indexed FT-003 tasks (`TASK-017` through `TASK-026`) are `done`.
- T2/T3 task evidence includes required packets, functional `/verify` results,
  per-task T3 semantic passes, and T3 human/recovery markers.
- The review used the FT-003 SDD hub, runtime/API/access/data/state contracts,
  implementation surface, prior red-verification evidence, and fresh gates.

## Substance Assessment

- The buyer-visible real-browser path passes against compiled local
  Medusa/PostgreSQL: guest create/update/remove, reload and new-context
  recovery, actual provider handoff, backend-selected target adoption,
  consumed-source `404`, and stale-context replay without duplicate quantity.
- The earlier browser handoff false success is not present: the E2E runner
  invokes `CartProvider.mergeAfterAuthentication()` and observes its restored
  provider state and stored target reference.
- The backend design remains aligned with the feature contracts: backend actor
  ownership, deterministic target selection, immutable Variant-ID aggregation,
  journal-first replay, source soft-delete, restore-first compensation, and no
  browser-authoritative cart state.
- No OAuth provider, production data, Medusa Core change, checkout, order,
  inventory-reservation, payment, queue, or additional service scope was found.

## Blocking Concern

- The required server-side gate
  `npm --workspace apps/backend run test:integration -- cart-merge-acceptance`
  fails twice after a successful `seed:medusa:catalog` run because its fixture
  lookup finds no sellable canonical variant.
- `npm --workspace apps/backend run smoke:product-detail` fails on the same
  seeded local database with `ProductDetailNotFoundError`.
- This conflicts with the documented local setup and prevents fresh,
  reproducible execution of the ownership/replay/compensation acceptance suite.
  The passing compiled browser flow does not replace that independent backend
  evidence.

## Fresh Gates

| Gate | Result |
|---|---|
| `npm --workspace apps/backend run seed:medusa:catalog` | PASS |
| `npm --workspace apps/backend run test:integration -- cart-merge-acceptance` | FAIL: no sellable canonical variant |
| `npm --workspace apps/backend run smoke:product-detail` | FAIL: canonical product detail not found |
| `npm --workspace apps/storefront run test:e2e -- cart` | PASS |
| `npm run smoke:local` | PASS |

## Cross-Boundary And Operational Assessment

- Browser/reference, Store API, route/workflow/module, journal, ownership, and
  consumed-source contracts have no newly observed semantic mismatch.
- The failed source-runtime acceptance fixture is a verification/reproducibility
  risk, not evidence that customer merge behavior is correct in all server-side
  cases. It must be resolved before feature completion.
- Production lock-provider behavior and actual FT-004 OAuth callback invocation
  remain outside FT-003 scope; neither changes this verdict.

## How This Could Still Be Wrong

- The compiled browser runtime can mask a divergence in the source-runtime
  canonical catalog/availability path used by backend acceptance scripts.
- Without a repeatable backend acceptance suite, a regression in foreign-owner
  denial, compensation, or journal replay could escape the browser flow.

## Failure / Blocker

- Status: blocked
- Where: `apps/backend/src/scripts/smoke-cart-merge-acceptance.ts` fixture setup
- Expected: documented local canonical setup supplies a sellable variant and the
  real Medusa/PostgreSQL acceptance suite executes.
- Observed: fixture setup aborts with `TASK-025 requires a sellable canonical
  Medusa variant` after successful canonical seed; product-detail smoke also
  cannot resolve the seeded product.
- Likely category: verification
- Recommended next action: reconcile the source `medusa exec` canonical
  catalog/availability path with the compiled Store runtime, add a regression
  proving the documented seed is sufficient, then rerun the failed backend gate
  and this feature-level `/red-verify`.
- Requires replan: no

## Recommendation

Do not promote FT-003 or REQ-006 through REQ-008 to `verified`. Resolve
`.memory-bank/bugs/FT-003-backend-acceptance-fixture-reproducibility.md`, then
repeat feature-level semantic verification.
