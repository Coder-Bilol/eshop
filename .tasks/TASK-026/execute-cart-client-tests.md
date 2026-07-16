---
description: TASK-026 focused storefront cart client test evidence.
status: complete
---
# TASK-026 Cart Client Tests

COMMAND: `npm --workspace apps/storefront run test -- cart-client`

EXIT_CODE: 0

RESULT: PASS

- Implicit first-cart creation resolves the user-selected Москва/RUB region.
- Missing or ambiguous default-region fixtures return a stable recoverable error.
- Explicit caller cart context remains unchanged.
- Cart reference storage remains only `{ version, cart_id }` and contains no
  cart payload, customer identity, token, total, price, or availability data.
