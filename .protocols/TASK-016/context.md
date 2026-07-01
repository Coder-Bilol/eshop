---
description: TASK-016 execution context.
status: active
---
# TASK-016 Context

- Tier: `T2`
- Mode: manual `/execute`
- Dependency: `TASK-015` is `done` with `VERDICT: PASS`
- Feature: `FT-001`, with FT-002 product-detail coverage

## Goal Interpretation

Replace the test-only browser backend with deterministic Playwright evidence
through the actual Medusa Store runtime and canonical local PostgreSQL data.

## Boundaries

- Store requests use the seeded publishable API key and its sales channel.
- Browser evidence covers catalog, filtering/search, product detail,
  availability, and variant-ID handoff.
- No second backend harness, production data, cart persistence, order,
  payment, or auth behavior.
