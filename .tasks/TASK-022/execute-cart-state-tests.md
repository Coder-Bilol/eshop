---
description: Focused cart state test evidence for TASK-022.
status: complete
---
# TASK-022 Cart State Test Evidence

- Command: `npm --workspace apps/storefront run test -- cart-state`
- Result: PASS
- Suite: `cart-state`

Verified assertions:

- first valid add lazily creates a cart and persists only the opaque cart ID;
- add, retrieve, absolute update, and remove adopt backend cart responses;
- reload restores from `eshop.cart.v1` without cached cart payloads;
- malformed and not-found references are cleared without reconstructing
  contents;
- loading, empty, validation, stock conflict, and backend failure states are
  deterministic;
- backend failures keep the opaque reference available for retry.

Final runner summary:

```json
{
  "command": "storefront:test",
  "status": "ok",
  "suites": ["cart-state"]
}
```

