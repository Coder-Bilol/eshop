---
description: Execution context for TASK-021 authenticated cart merge API.
status: complete
---
# TASK-021 Context

## Task

- Task ID: `TASK-021`
- Tier: `T3`
- Current task status during `/execute`: `planned`
- Dependency: `TASK-020`
- Dependency state at preflight: `done`
- Packet: `.memory-bank/packets/TASK-021.packet.json`
- Packet status at preflight: `ready`
- Packet hash at preflight:
  `sha256:702d3ee113ae910e1f8d374e5655df8adbcb267ec463d238907f4421bda1c256`

## Objective

Expose an authenticated Store API boundary for guest cart merge:

- authenticate a customer on `POST /store/carts/:id/merge`;
- derive the source cart only from the route parameter;
- derive the customer only from Medusa auth context;
- reject client-supplied merge authority fields;
- call the existing TASK-019 planner and TASK-020 lifecycle workflow;
- return stable success and error envelopes;
- preserve journal-first idempotent replay semantics.

## Normative Inputs

- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/workflows/tier-policy.md`

## Allowed Write Scope Used

- `apps/backend/package.json`
- `apps/backend/src/api/middlewares.ts`
- `apps/backend/src/api/store/carts/[id]/merge/route.ts`
- `apps/backend/src/api/store/carts/[id]/merge/validators.ts`
- `apps/backend/src/scripts/smoke-cart-merge-api.ts`
- `apps/backend/test/run-integration.cjs`
- `.memory-bank/changelog.md`
- `.protocols/TASK-021/**`
- `.tasks/TASK-021/**`

## Forbidden Scope

- OAuth provider configuration or credentials: not touched.
- Storefront behavior: not touched.
- Medusa Core modification: not touched.
- Production data: not used.

