# TASK-007 Context

## Task

- Task: `TASK-007`
- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-007.task.json`
- Packet: `.memory-bank/packets/TASK-007.packet.json`
- Packet status read during execute: `ready`
- Execute owner: `ROLE: GENERAL`
- Date: 2026-06-24

## Goal Interpretation

Purpose: make the backend catalog contract usable through the buyer-facing storefront.

Success outcome: buyer can browse products, categories, search, required filters, selected state, and pagination in the storefront.

Anti-goals:
- Do not implement add-to-cart or product detail selection.
- Do not create a custom admin surface.
- Do not hardcode seeded catalog data into UI code.

Allowed write scope:
- `apps/storefront/app/**`
- `apps/storefront/src/**`
- `apps/storefront/components/**`
- `apps/storefront/lib/**`
- `apps/storefront/package.json`

Forbidden scope:
- backend catalog contract changes not covered by `TASK-006`
- product detail/add-to-cart behavior
- hardcoded catalog source data

Stop conditions:
- Storefront cannot consume the backend catalog contract.
- UI work requires changing FT-001 API semantics.
- Verification cannot show categories and required filters are usable.

## Authoritative Context Used

- `AGENTS.md`
- `.memory-bank/commands/execute.md`
- `.memory-bank/constitution.md`
- `.memory-bank/mbb/index.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/index.md`
- `.memory-bank/roles/general.md`
- `.memory-bank/tasks/index.json`
- `.memory-bank/tasks/TASK-007.task.json`
- `.memory-bank/packets/TASK-007.packet.json`
- `.memory-bank/tasks/TASK-006.task.json`
- `.memory-bank/features/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/plans/IMPL-FT-001.md`
- `.memory-bank/workflows/tier-policy.md`
- `.protocols/FT-001/plan.md`
- `.protocols/FT-001/decision-log.md`

## Boundary Notes

Linked boundary/contracts:
- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/architecture/system-architecture.md`

Responsibility boundary:
- Storefront fetches catalog data through the backend Store catalog API.
- Backend/PostgreSQL remains the catalog source of truth.
- Storefront may define labels and display order for filter controls, but available values come from backend response metadata.
- Storefront keeps only URL query/UI state; it does not write catalog, cart, order, payment, auth, or admin state.

Boundary drift risk: moderate because this is a frontend/backend contract consumer. Mitigation: do not change backend contract, test against a mocked backend catalog response, and keep product data out of UI source.

## Preflight Result

- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-007`.
- Tier is `T2`.
- Task status is `planned`, not `done`, `failed`, or `blocked`.
- Dependency `TASK-006` is `done`.
- Linked SDD specs exist and are concrete.
- Packet context is present and semantically consistent with the task/specs.
- No semantic contradiction found between task, packet, feature, implementation plan, API guidelines, and SDD specs.
