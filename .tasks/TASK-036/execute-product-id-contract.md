# TASK-036 Product ID Contract Evidence

- Command: `npm --workspace apps/backend run test:integration -- wishlist-product-id`
- Result: PASS.
- Real canonical catalog smoke returned five products whose top-level IDs use Medusa
  `prod_` identity.
- Real product-detail smoke returned the canonical Medusa product ID independently of
  variant IDs.
- Source boundary: existing Medusa query graph; no copied or derived identity.

LOCAL VERDICT: PASS
