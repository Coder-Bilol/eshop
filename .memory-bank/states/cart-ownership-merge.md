---
description: FT-003 cart ownership and merge lifecycle, transitions, guards, retry, and recovery.
status: active
owner: spec-improve
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/states/order-payment-inventory.md
  - .memory-bank/contracts/cart-access-security.md
  - .memory-bank/domains/cart-merge-data.md
---
# Cart Ownership And Merge State Specification

## Cart Lifecycle

Feature-local states refine the global `guest-owned`, `customer-owned`, and
`merged` states:

- `guest_active`: incomplete cart with no customer ID.
- `customer_active`: incomplete cart owned by the authenticated customer.
- `merge_pending`: source/target locked and journal plan is pending.
- `merged_consumed`: source was merged into another cart, is soft-deleted in the
  Medusa Cart Module, and the completed journal points to the active target.
- `completed`: Medusa cart has `completed_at`; not mutable or mergeable.

`merge_pending` and `merged_consumed` are workflow/journal semantics; they do not
require modifying Medusa core status enums.

## Journal Lifecycle

```text
none -> pending -> completed
               \-> failed -> pending (guarded retry)
```

## Allowed Transitions

| From | To | Trigger | Guards |
|---|---|---|---|
| none | `guest_active` | First valid add/create flow. | Store scope/region valid. |
| `guest_active` | `guest_active` | Add/update/remove. | Medusa validation succeeds. |
| `guest_active` | `customer_active` | Authenticated merge with no compatible target. | Actor authenticated; source unowned; transfer succeeds. |
| `guest_active` + `customer_active` | `merge_pending` | Merge command. | Actor owns target; carts active/compatible; locks held. |
| `merge_pending` | `merged_consumed` + `customer_active` | Plan applied and source soft-deleted. | All quantities valid; target durable; source soft-delete succeeds; journal completed. |
| `merge_pending` | original active states | Failure/compensation. | Target restored; journal failed. |
| any active cart | `completed` | Later checkout/order flow. | Outside FT-003. |

## Guards

- Authenticated actor is required for every merge transition.
- Foreign-owned source is forbidden.
- Destination is backend-selected from actor-owned active compatible carts.
- Completed source/destination is forbidden.
- Compatibility requires equal region, currency, and sales channel.
- Plan uses Medusa Variant IDs and positive integer quantities.
- Inventory/sellability validation occurs before success and through Medusa core
  item workflows.
- Locks are acquired in sorted cart-ID order and released after completion or
  compensation.
- Completed journal replay does not re-enter mutation steps.
- Completed journal replay resolves before source-cart retrieval and therefore
  remains valid after source soft-delete.
- Ordinary Store retrieve/add/update/remove operations cannot transition a
  `merged_consumed` source because it resolves as not found.

## Concurrency And Retry

- Concurrent add/update on a locked source/target must serialize or fail
  explicitly; it cannot race to a silent lost update.
- Concurrent merge requests for one source converge on the unique journal.
- A response lost after commit is replayed as `already_merged`.
- `pending` lock contention returns `cart_merge_in_progress`.
- Retry of `failed` is allowed only after recovery guards confirm the plan and
  cart states remain compatible.

## Forbidden Transitions

- Guest cart directly becoming another customer's cart without authenticated
  actor validation.
- Client selecting target/customer IDs.
- Completed cart returning to active.
- Partial line mutations reported as success.
- Stock conflict producing truncated quantity.
- Replayed merge adding source quantities again.
- Reusing a `merged_consumed` source through ordinary Store cart operations.
- Browser cache/local storage changing backend ownership state.

## Recovery

- Before any target mutation, preserve the immutable before/after plan.
- After target mutations succeed, soft-delete the source; only then mark the
  journal completed.
- On failure after source soft-delete, restore the source first, then compensate
  target mutations in reverse order.
- If compensation cannot prove restoration, return failure, retain the journal
  and evidence, and block automated retry until manual investigation.
- Never delete either core cart as part of ordinary merge recovery.
- Never hard-delete the source during success; soft-delete is the reversible
  terminal state for an existing-target merge.
