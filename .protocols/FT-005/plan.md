---
description: Planning protocol for FT-005 wishlist design and task decomposition.
status: complete
---
# FT-005 Planning Protocol

## Goal

Complete feature-level SDD for authenticated product favorites, PostgreSQL
persistence, ownership-safe Store API, and storefront wishlist UX, then create an
implementation plan, schema-backed tasks, and required packets.

## Done Criteria

- Product-level identity, record uniqueness, ownership, unavailable-product
  behavior, API idempotency, UI states, and guest behavior are concrete.
- Existing catalog/product and FT-004 auth boundaries are reused.
- REQ-009 is covered by bounded storage, projection, workflow, API, state/UI, and
  backend/browser acceptance tasks.
- Every T2/T3 task has a canonical packet with matching source hash.
- Memory Bank lint and strict doctor pass before execution handoff.

## Quality Gates

- `node scripts/mb-lint.mjs`
- schema/index/task/packet consistency
- required packet hash verification
- strict `/mb-doctor` before `/execute`

## Scope Notes

- Store one row per customer/product in a custom Wishlist Module.
- Do not create guest persistence, variant favorites, sharing, or cleanup jobs.
- Reuse FT-004 session/customer state and current catalog product truth.
