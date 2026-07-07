# TASK-017 Migration Scope Evidence

Inspected:

```text
apps/backend/src/modules/cart-merge/migrations/Migration20260704060621.ts
```

Result:

```text
creates_cart_merge=true
unique_source=true
customer_status_index=true
target_index=true
touches_core_cart_table=false
```

The migration creates/drops only the custom `cart_merge` table and its indexes.
It does not alter Medusa Core cart or line-item tables.
