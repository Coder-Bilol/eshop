# TASK-037 Workflow Integration Evidence

- Command: `npm --workspace apps/backend run test:integration -- wishlist-workflows`
- Result: PASS through real Medusa Module and canonical Product query graph.
- Add creates one exact item/projection; repeat add returns `created: false` and the
  same projection.
- Concurrent adds converge without a second row.
- Remove is customer/product scoped and repeated remove returns `removed: false`.
- Hidden rows are omitted from projection listing; missing product add rejects.
- Out-of-stock visible product projection remains present with `is_available: false`.
- Synthetic customer/product rows are cleaned at the start and end of the smoke.

LOCAL VERDICT: PASS
