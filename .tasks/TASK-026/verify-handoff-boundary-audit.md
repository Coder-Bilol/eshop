---
description: Independent TASK-026 audit of the browser merge handoff boundary.
status: complete
---
# TASK-026 Verify Handoff Boundary Audit

## Required Behavior

- The FT-003 UX contract requires successful authenticated merge to switch the
  stored reference atomically to the returned target before rendering the merged
  result.
- TASK-026 purpose is buyer-visible acceptance evidence for guest persistence and
  the post-auth merge handoff.
- `CartProvider.mergeAfterAuthentication()` is the storefront handoff exposed by
  TASK-024. It calls `mergeAuthenticatedCartReference()` and restores provider
  state after a successful result.

## Observed Browser Harness Path

- `verifyCart()` calls `mergeCartInBrowser()` in
  `apps/storefront/e2e/run-real-medusa-e2e.cjs`.
- `mergeCartInBrowser()` calls raw browser `fetch` for
  `POST /store/carts/{source_cart_id}/merge` with a bearer token.
- After the response, `verifyCart()` calls `writeBrowserCartReference()` directly
  to place the returned target ID in `localStorage`.
- Replay repeats the same raw request and direct storage write.

## Missing Storefront Path

- The E2E runner contains no call to `mergeAfterAuthentication()`.
- The E2E runner contains no call to `mergeAuthenticatedCartReference()` or
  `createStoreCartMergeClient()`.
- It therefore does not exercise the production handoff's response validation,
  reference write, or provider state restore.

## Conclusion

- Browser acceptance of guest cart creation, mutation, and reference recovery:
  PASS.
- Backend route merge/replay observed from browser context: PASS.
- Buyer-visible post-auth storefront handoff: FAIL, not exercised.
- This is a functional blocker for TASK-026 verification, recorded in
  `.memory-bank/bugs/TASK-026-browser-merge-handoff-bypass.md`.

## Remediation Reverification

- `CartProvider` now registers an E2E-only event trigger only when
  `NEXT_PUBLIC_E2E_CART_HANDOFF=true`.
- Trigger handling calls the existing `mergeAfterAuthentication()` function and
  returns the source/target/outcome/replay values plus restored provider state.
- The runner installs a synthetic bearer wrapper only for E2E merge fetches,
  dispatches the provider trigger, and asserts the returned target reference and
  provider state.
- The runner creates a stale browser context from pre-merge storage, dispatches
  the same trigger there, and asserts `already_merged` replay adopts the target
  without duplicate quantity.
- `mergeCartInBrowser()` and `writeBrowserCartReference()` are absent from the
  remediated runner.

## Reverification Conclusion

- Buyer-visible post-auth storefront handoff: PASS.
- Original blocker: resolved; see
  `.memory-bank/bugs/TASK-026-browser-merge-handoff-bypass.md`.
