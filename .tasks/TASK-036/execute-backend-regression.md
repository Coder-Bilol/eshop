# TASK-036 Backend Regression Evidence

| Command | Result |
|---|---|
| `npm --workspace apps/backend run smoke:catalog` | PASS; five products, filters/search/pagination and canonical product IDs. |
| `npm --workspace apps/backend run smoke:product-detail` | PASS; variants, selection, availability, price/media and canonical product ID. |

The response change is additive. Existing handles, categories, attributes, prices,
variants, and selection fields remain unchanged.

LOCAL VERDICT: PASS
