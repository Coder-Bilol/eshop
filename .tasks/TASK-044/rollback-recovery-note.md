---
description: Rollback and recovery evidence for TASK-044 acceptance fixture retention.
status: present
---
# TASK-044 Rollback / Recovery

## Normal Recovery

- The retention phase writes the browser actor into the existing private state file before
  creating rows, so an interruption during setup leaves enough bounded state for the
  existing cleanup phase to remove the browser-owned rows.
- If a local run is interrupted after `write` or `browser-setup`, rerun the same local
  Medusa acceptance cleanup phase with its existing run ID/state-file pair. Cleanup
  deletes only state-owned wishlist rows, synthetic customers where supported, synthetic
  products, categories, and inventory fixtures.
- Recovery uses no production credentials, production data, live provider, browser token,
  cookie, or session value.

## Implementation Rollback

- If the acceptance handoff regresses, revert only the TASK-044 acceptance script and
  changelog entry, then rerun the pre-existing TASK-041 wishlist acceptance and the
  relevant workflow/API checks.
- No production wishlist/auth/catalog behavior, database schema, migration, storefront,
  or authentication transport rollback is required.
- TASK-044 remains `in_progress`; closure markers and scheduler decisions are owned by
  the next workflow owner and were intentionally not emitted by this worker.
