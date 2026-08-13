---
description: Sanitized local acceptance evidence for TASK-045 wishlist channel alignment.
status: captured
---
# TASK-045 Acceptance Evidence

## Runtime

- Boundary: real compiled Medusa backend, local PostgreSQL, long-lived Store API,
  Playwright browser, existing session-cookie/provider-double boundary, and acceptance-only
  Medusa execution phases.
- Fixture policy: synthetic local customers, categories, products, wishlist rows, and
  zero-stock inventory only. No production data or live provider was used.

## Channel Alignment

- The browser runner passed the actual seeded publishable key to local `write`, `read`,
  `browser-setup`, and `cleanup` phases through a child environment variable.
- The acceptance result reported `salesChannelResolution=publishable-key-query` and
  `fixtureSalesChannelAligned=true`; no key value or channel ID was emitted.
- The backend resolved the API key and its linked channel through Medusa `QUERY` graph
  (`api_key` with `sales_channels.id`), then stored only the selected channel ID in the
  private run state and revalidated it before browser setup.
- Visible, restored, and out-of-stock fixtures were linked to the selected channel. The
  channel-invisible fixture remained unlinked; unpublished and inactive-category fixtures
  retained their original hidden causes.

## Browser Projection

- Final command: `npm --workspace apps/storefront run test:e2e -- wishlist` - PASS.
- `publishableKeyBoundary`: missing-key HTTP `400`, actual-key HTTP `200`.
- Real browser Store API setup projection: `visibleRows=2`, restored present, out-of-stock
  present, and out-of-stock `is_available=false`.
- Retained synthetic rows: hidden `4`, restored `1`, out-of-stock `1`.
- Hidden lifecycle: four add attempts returned the same sanitized `404`, all hidden rows
  were omitted from list projection, and durable hidden rows remained private.
- Restored lifecycle: restored product was visible through the browser list with its
  current handle.
- Out-of-stock lifecycle: product remained visible and reported `is_available=false`.
- Browser customer isolation, guest non-persistence, merge-blocked wishlist independence,
  logout/session-expiry cleanup, and storage scan passed.
- Final browser output reported `processCleanup=ports-released` and `productionData=false`.

## Backend Retention And Regression

- Final `wishlist-acceptance` integration: PASS; existing TASK-041 write/read/cleanup and
  all 11 assertion groups remained green.
- Browser `read` phase passed in the same long-lived runtime before browser-positive
  assertions; no process restart or direct browser database/module bypass was used.
- Final unconditional cleanup reported `stateFound=true` and `cleanupComplete=true`.
