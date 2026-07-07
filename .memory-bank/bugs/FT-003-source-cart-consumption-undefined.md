---
description: Active FT-003 decomposition blocker for undefined source-cart disposition after a successful merge.
status: archived
owner: verify
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/features/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/contracts/cart-api-data-contract.md
  - .memory-bank/states/cart-ownership-merge.md
  - .memory-bank/tasks/TASK-019.task.json
  - .memory-bank/tasks/TASK-022.task.json
---
# FT-003 Source Cart Consumption Is Undefined

## Summary

FT-003 defines a successful merge into an existing customer cart as
`merged_consumed`, but does not define an executable disposition for the source
Medusa cart after its quantities have been copied to the target.

The durable merge journal makes another call to the custom merge endpoint
idempotent. It does not, by itself, stop the existing Medusa Store retrieve,
add, update, or remove routes from continuing to operate on the old source cart
ID.

## Impact

The current decomposition can produce a superficially correct merge while the
old source cart remains active and mutable. An old tab or retained browser
reference could continue using that cart, and newly added source quantities
would not be covered by the already-completed merge journal.

This leaves cart-consumption, duplicate-use prevention, recovery, and observable
verification behavior undefined at a no-data-loss boundary.

## Evidence

- `.memory-bank/states/cart-ownership-merge.md` names `merged_consumed` as a
  workflow/journal semantic without defining a core-cart mutation or Store-route
  guard.
- `.memory-bank/contracts/cart-api-data-contract.md` defines idempotent replay of
  the custom merge endpoint, but no behavior for standard Store CRUD calls made
  with the consumed source cart ID.
- `.memory-bank/tasks/TASK-019.task.json` verifies replay and compensation but
  does not require evidence that the source cart cannot remain a second active
  cart after success.
- `.memory-bank/tasks/TASK-022.task.json` likewise has no post-merge source-cart
  rejection, redirection, invalidation, or terminal-state assertion.

## Required Resolution

The feature-design portion is resolved: after an existing-target merge, the
source is soft-deleted through the Medusa Cart Module; compensation restores it;
completed replay is journal-first.

Before execution, rerun `/prd-to-tasks FT-003` so the implementation plan, task
records, and packets inherit the repaired contract. The refreshed decomposition
must cover:

- durable source state after success;
- behavior of retrieve/add/update/remove requests using the old source ID;
- replay behavior after source disposition;
- failure and compensation ordering;
- browser behavior for stale tabs/references;
- integration and E2E evidence proving quantities cannot be reused or lost.

Update the linked state, API/data, and feature specs first, then update affected
TASK records and refresh their Execution Packets.

## Design Resolution

Completed by `/spec-improve FT-003` on 2026-07-02.

- Source disposition: Medusa Cart Module `softDeleteCarts`.
- Compensation: Medusa Cart Module `restoreCarts`.
- Source contents: preserved; no hard delete or line clearing.
- Replay order: completed journal before source-cart retrieval.
- Ordinary consumed-source Store CRUD: not found.
- No-target transfer: source remains the active target and is not soft-deleted.

## Task Decomposition Resolution

Completed by `/prd-to-tasks FT-003` on 2026-07-03.

- TASK-020 owns target mutation, source soft-delete, restore compensation, and
  journal completion ordering.
- TASK-021 owns journal-first authenticated replay and consumed-source API
  behavior.
- TASK-025 owns real Medusa/PostgreSQL acceptance for Store not-found, replay,
  and injected restore compensation.
- TASK-026 owns real-browser stale-source and authenticated target recovery.
- TASK-017..TASK-026 packets are ready and hash-matched.

The blocker is resolved and archived.
