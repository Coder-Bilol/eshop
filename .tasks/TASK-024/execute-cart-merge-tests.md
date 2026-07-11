COMMAND: npm --workspace apps/storefront run test -- cart-merge
EXIT_CODE: 0


> @eshop/storefront@0.1.0 test
> node src/test-runner.cjs cart-merge

{
  "suite": "cart-merge",
  "status": "ok",
  "dataSource": "store-cart-merge-contract-shaped-fixtures",
  "assertions": [
    "post-auth merge sends credentials: include with an empty request body",
    "client never sends destination cart or customer identity",
    "validated merged, transferred, and already_merged responses adopt the backend-selected target reference",
    "conflict, forbidden, in-progress, stale, invalid-response, and server failures retain the source reference",
    "stale consumed-source recovery can happen only through authenticated merge replay",
    "cart provider exposes provider-agnostic post-auth handoff without OAuth provider logic"
  ]
}
{
  "command": "storefront:test",
  "status": "ok",
  "suites": [
    "cart-merge"
  ]
}
