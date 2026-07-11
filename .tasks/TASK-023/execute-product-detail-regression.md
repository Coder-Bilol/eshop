---
description: Product detail regression evidence for TASK-023.
status: complete
---
# TASK-023 Product Detail Regression Evidence

- Command: `npm --workspace apps/storefront run test -- product-detail`
- Result: PASS
- Suite: `product-detail`

Verified assertions:

- FT-002 missing, impossible, ambiguous, unavailable, default-SKU, and
  no-variant selection behavior remains covered;
- valid cart handoff still includes product handle, selected variant/SKU,
  quantity, and validation state;
- product detail source now calls guest-cart add through `useCart()` with
  `payload.selected_variant_id`;
- add-to-cart remains disabled unless `selectionResult.canAddToCart` is true.

Final runner summary:

```json
{
  "command": "storefront:test",
  "status": "ok",
  "suites": ["product-detail"]
}
```

