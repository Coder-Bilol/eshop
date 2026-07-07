---
description: Scope and installed-route audit evidence for TASK-018.
status: complete
---
# TASK-018 Scope And Route Audit

## Installed Medusa Contract

Read-only inspection of `@medusajs/medusa@2.16.0` confirmed:

- `POST /store/carts` -> `{ cart }`;
- `GET /store/carts/{id}` -> `{ cart }`;
- `POST /store/carts/{id}/line-items` -> `{ cart }`;
- `POST /store/carts/{id}/line-items/{line_id}` -> `{ cart }`;
- `DELETE /store/carts/{id}/line-items/{line_id}` ->
  `{ id, object, deleted, parent }`.

The implementation consumes these built-in routes directly and does not add a
custom backend cart CRUD facade.

## Write Scope

Implementation writes are limited to:

- `apps/storefront/lib/cart.ts`;
- `apps/storefront/src/cart-client.test.cjs`;
- `apps/storefront/src/test-runner.cjs`;
- the TASK-018 changelog section.

Required operational artifacts were added under `.protocols/TASK-018/` and
`.tasks/TASK-018/`.

- Forbidden scope touched: no.
- Cart UI added: no.
- Authenticated merge or OAuth added: no.
- Checkout/order/payment behavior added: no.
- Existing unrelated dirty worktree changes overwritten: no.
- `git diff --check` for TASK-018 paths: PASS; only existing line-ending
  normalization warnings were reported.
- Authoritative task status after `/execute`: `ready`.
