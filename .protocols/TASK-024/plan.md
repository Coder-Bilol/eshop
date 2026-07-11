---
description: TASK-024 execution plan.
status: active
---
# TASK-024 Plan

## Goal Interpretation
- Purpose: Provide the security-sensitive provider-agnostic handoff FT-004 invokes after authentication.
- Success outcome: Successful authenticated merge atomically adopts the recorded backend-selected target, while every failure remains recoverable.
- Anti-goals: Do not implement Google OAuth, VK ID, login UI, callback routes, backend merge semantics, checkout, order, inventory reservation, or payment.
- Allowed write scope: `apps/storefront/lib/cart-merge.ts`, `apps/storefront/components/cart-provider.tsx`, `apps/storefront/src/cart-merge.test.cjs`, `apps/storefront/src/test-runner.cjs`, `.memory-bank/changelog.md`.
- Forbidden scope: OAuth provider implementation or credentials, backend merge semantics, checkout, order, inventory reservation, payment.
- Stop conditions: Merge response cannot prove the backend-selected target; provider-specific auth decisions are required; failure handling would discard or expose cart/customer state.

## Boundary Notes
- Linked boundary/contracts: cart API/data contract, cart access/security contract, cart ownership/merge state, FT-003 SDD hub.
- Responsibility boundary: Storefront may send the authenticated merge request, include `credentials: include`, preserve only the opaque cart reference, and adopt only the backend-selected target from a validated success response.
- Boundary drift risk: Client must not send destination cart ID, customer ID, OAuth provider details, auth tokens in payload/storage, or infer customer identity from browser state.

## Implementation Plan
1. Add a narrow storefront cart merge client/handoff module.
2. Ensure the merge request is `POST /store/carts/{source_cart_id}/merge` with `x-publishable-api-key`, `credentials: include`, and an empty JSON body.
3. Validate success response before writing the returned target cart ID to `eshop.cart.v1`.
4. Preserve the source cart reference on all merge failures, including conflict, forbidden, in-progress, stale/not-found, network, and server errors.
5. Expose a provider-level method that FT-004 can call without provider-specific OAuth logic.
6. Register and implement focused storefront tests for request shape, target switch, replay, and failure preservation.

## Intended Local Gates
- `npm --workspace apps/storefront run test -- cart-merge`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff
- `/execute` will not close the task, run `/verify`, run `/red-verify`, run `/mb-sync`, or promote dependents.
- Scheduler or explicit standalone owner must run `/verify TASK-024`, per-task `/red-verify TASK-024`, record T3 human/recovery markers, and then sync/close if appropriate.
