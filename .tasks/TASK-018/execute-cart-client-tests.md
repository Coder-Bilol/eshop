---
description: Focused cart client and browser reference test evidence for TASK-018.
status: complete
---
# TASK-018 Cart Client Test Evidence

- Command: `npm --workspace apps/storefront run test -- cart-client`
- Result: PASS
- Suite: `cart-client`

Verified assertions:

- create, retrieve, add, absolute update, and remove use installed Medusa Store
  cart route shapes;
- every request includes `x-publishable-api-key`;
- transport and HTTP failures map to stable application error codes;
- `eshop.cart.v1` stores only `version` and opaque `cart_id`;
- malformed, unsupported, empty, whitespace-padded, item-bearing, and
  token-bearing references are cleared;
- stale `404` references are cleared while temporary backend failures retain the
  reference;
- browser storage contains no items, totals, customer identity, auth tokens, or
  availability state.

Final runner summary:

```json
{
  "command": "storefront:test",
  "status": "ok",
  "suites": ["cart-client"]
}
```
