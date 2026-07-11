---
description: Focused cart view test evidence for TASK-023.
status: complete
---
# TASK-023 Cart View Test Evidence

- Command: `npm --workspace apps/storefront run test -- cart-view`
- Result: PASS
- Suite: `cart-view`

Verified assertions:

- layout provides cart state without hiding stale-reference detection;
- cart page renders the cart view;
- cart view renders backend cart items and totals only from response state;
- cart view exposes loading, empty, stale, validation, conflict, and backend
  failure states;
- cart view drives absolute quantity update and remove through TASK-022 state
  functions;
- product detail sends only a valid selected Medusa Product Variant ID into
  guest-cart add;
- FT-002 disabled selection guards remain in place;
- cart UI source does not store browser-authoritative cart payloads or add
  auth/checkout/payment scope.

Final runner summary:

```json
{
  "command": "storefront:test",
  "status": "ok",
  "suites": ["cart-view"]
}
```

