---
description: Execution plan for TASK-021 authenticated cart merge API.
status: complete
---
# TASK-021 Plan

## Implementation Plan

1. Add route auth middleware for `POST /store/carts/:id/merge` using Medusa
   customer authentication.
2. Keep body validation inside the route so invalid request envelopes remain
   stable and task-owned.
3. Reject non-empty request bodies with `cart_merge_invalid_request`; the API
   does not accept `target_cart_id`, `customer_id`, or other client authority
   fields.
4. Resolve the actor from `req.auth_context.actor_id`; unauthenticated requests
   return `cart_merge_auth_required`.
5. Check completed merge journal before source cart retrieval:
   - find completed journal by `source_cart_id`;
   - verify journal `customer_id` matches the authenticated actor;
   - load the target cart only after that customer check;
   - return replay response with outcome `already_merged`.
6. For non-replay requests, load planner state, build the TASK-019 merge plan,
   and execute the TASK-020 lifecycle workflow.
7. Map planner and lifecycle failures to stable HTTP status/code pairs.
8. Add Medusa exec integration smoke for route-level behavior and register it
   in the backend integration runner.

## Stable Outcomes

- `transferred`: source cart becomes the authenticated customer's active cart
  when no target cart exists.
- `merged`: source cart is merged into the existing authenticated target cart.
- `already_merged`: completed source-cart journal is replayed without
  duplicating target quantities.

## Stable Error Boundary

- `cart_merge_auth_required`
- `cart_merge_invalid_request`
- `cart_not_found`
- `cart_merge_source_forbidden`
- `cart_merge_incompatible`
- `cart_merge_stock_conflict`
- `cart_merge_in_progress`
- `cart_merge_failed`

## Verification Plan

- `npm --workspace apps/backend run test:integration -- cart-merge-api`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- Regression check:
  `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle`
- Scope audit for forbidden provider/storefront/secret references.
- Runtime mutation audit for direct cart mutation outside the TASK-020 workflow
  boundary.

