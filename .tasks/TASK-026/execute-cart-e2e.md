---
description: TASK-026 real browser cart acceptance command evidence.
status: complete
---
# TASK-026 Cart Browser Acceptance

COMMAND: `npm --workspace apps/storefront run test:e2e -- cart`

EXIT_CODE: 0

RESULT: PASS

## Verified Flow

- Compiled local Medusa backend and canonical PostgreSQL catalog started.
- Playwright opened a valid product-detail variant in the storefront.
- User-visible selected state was `Variant is available` for
  `CR-STL-BLK-160-300`.
- Clicking `Add to cart` creates a real guest cart through Medusa Store API.
- The browser reference contains only `{ version, cart_id }`.
- Absolute quantity update and line removal are reflected from backend cart truth.
- Reload and a new browser context restore the guest cart from the opaque
  reference.
- Synthetic local emailpass bearer auth merges the source quantity `2` into an
  existing compatible target quantity `3`; backend selects the target and returns
  exact quantity `5`.
- Ordinary Store retrieval of the consumed source returns HTTP 404.
- Authenticated replay returns `already_merged` with quantity `5`, without a
  second increment.

## Artifacts

- `.tasks/TASK-026/playwright/real-medusa-trace.zip`
- `.tasks/TASK-026/playwright/cart-guest-persistence.png`
- `.tasks/TASK-026/playwright/cart-new-context-restore.png`
- `.tasks/TASK-026/playwright/cart-auth-merge.png`
- `.tasks/TASK-026/playwright/cart-replay.png`

## Cleanup

- Runner released the local backend and storefront ports after success.
