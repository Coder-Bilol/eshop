---
description: Feature-level adversarial semantic verification for FT-002.
status: complete
---
# FT-002 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Prior Concern Resolution

The media-contract and missing-SKU concerns were reproduced and resolved:

1. Media DTO: resolved. Canonical backend normalization emits trimmed
   `string[]` URLs, matching the existing storefront `ProductDetail.media`
   contract and direct `img.src` consumption.
2. Image-free false success: resolved. The local canonical seed now contains
   an explicit image-bearing product and idempotently reconciles only fixture
   media declared for that product.
3. Browser rendering: resolved. Real compiled-Medusa E2E verifies the Store
   response URL, DOM `src`, and successful image load with
   `complete && naturalWidth > 0`.
4. Missing SKU: resolved. A variant without a non-empty SKU can remain
   inventory-available for diagnostics, but is non-sellable with reason
   `missing_sku` and cannot produce a valid cart-action handoff.

## Top Substance Risks

No feature-completion blocker remains.

- The media contract is maintained manually rather than generated from a
  shared schema. The new backend integration, storefront contract test, and
  real-runtime browser assertion make future drift observable.
- The fixture media URL is intentionally local and relative. Production media
  storage is outside this local-seed repair, while the wire contract remains a
  normal URL string in either environment.

## False Success / Purpose Fit

FT-002 now solves the buyer and system problem through the real boundary:

- canonical Medusa Product Variant, Pricing, Inventory, and Product Image data
  owns product-detail truth;
- missing, impossible, unavailable, valid, default-SKU, and cart-boundary
  failure states pass;
- image-bearing product detail crosses Medusa Query and Store API without
  runtime shape loss;
- handoff uses an opaque Medusa Product Variant ID, a usable SKU, and quantity
  one;
- durable cart persistence remains correctly outside FT-002.

The previous image-free false-success path is covered rather than waived.

## Anti-goals And Scope

- No Medusa Core, durable cart, auth, checkout, order, payment, inventory
  reservation, production data, production migration, or live-provider
  behavior was introduced.
- Storefront remains HTTP-only; backend/PostgreSQL remains authoritative.
- Seed reconciliation touches only fixture products that explicitly declare
  media and does not clear arbitrary images from other products.

## Weak-context Questions

No unanswered question can reasonably change this verdict. Production media
storage/provider selection and durable cart behavior remain later concerns and
were not used as proof.

## Hidden Assumptions

- Later FT-003 cart work revalidates the opaque Medusa variant ID and stock.
- Production media remains representable as a URL string.
- A missing SKU is invalid for this project's Variant/SKU handoff semantics.

These assumptions align with the existing FT-002 spec and are now executable
where FT-002 owns them.

## Cross-boundary Impact

- FT-001 continues to use canonical Medusa catalog ownership.
- FT-003 receives a stable Medusa variant ID and cannot inherit a stringified
  missing SKU from FT-002.
- Medusa Admin-added product images can cross the same normalized URL-string
  boundary without the prior `[object Object]` rendering defect.

## Architectural, State, Operational, And Maintenance Assessment

- Architecture: Medusa workflows, Query, Store middleware, and HTTP ownership
  boundaries are preserved.
- State/data consistency: inventory-backed availability stays a pre-check;
  missing SKU affects sellability without mutating inventory state.
- Operational behavior: the canonical seed passed twice without duplicates;
  E2E started compiled Medusa, enforced the publishable key, and released all
  ports.
- Maintenance cost: one small normalization rule and one explicit fixture
  reconciliation replace an implicit cross-boundary shape assumption.

## How This Could Still Be Wrong

Future backend response changes could drift from storefront types if the
image-bearing tests are removed or bypassed. Future cart work could also ignore
the current sellability guard. Both failures are now observable through
existing integration/browser evidence and must remain regression gates.

## Counterproposal / Escalation

No further remediation is required for FT-002 semantic completion. Keep the
image-bearing canonical product and missing-SKU assertion as regression
coverage. `/mb-sync` records FT-002 and EP-001 as `verified`.

## Fresh Evidence

- Canonical seed: PASS twice, `products_created: 0`, no duplicate inventory.
- Backend product-detail integration: PASS through `medusa-query-graph`.
- Missing-SKU normalization assertion: PASS.
- Backend and storefront typechecks: PASS.
- Storefront product-detail unit/contract suite: PASS.
- Real product-detail E2E: PASS through compiled Medusa, canonical PostgreSQL,
  publishable-key middleware, Microsoft Edge, loaded SVG media, Medusa variant
  ID handoff, and released ports.
- `.tasks/FT-002/repair-real-medusa-e2e.stdout.txt`
- `.tasks/TASK-016/playwright/real-medusa-trace.zip`
- `.tasks/TASK-016/playwright/product-detail.png`
- `node scripts/mb-doctor.mjs --strict`: PASS, 0 errors and 0 warnings.
