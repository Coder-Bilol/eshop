# TASK-006 Context

## Task

- Task: `TASK-006`
- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-006.task.json`
- Packet: `.memory-bank/packets/TASK-006.packet.json`
- Packet status read during execute: `ready`
- Execute owner: `ROLE: GENERAL`
- Date: 2026-06-24

## Goal Interpretation

Purpose: expose backend catalog read behavior needed by the storefront without duplicating catalog truth.

Success outcome: backend catalog reads prove browse, category, search, filter, empty result, and pagination semantics against seeded local catalog data.

Anti-goals:
- Do not implement FT-002 product detail behavior.
- Do not add external search infrastructure.
- Do not add cart, checkout, payment, or auth behavior.

Allowed write scope:
- `apps/backend/src/**`
- `apps/backend/test/**`
- `apps/backend/package.json`

Forbidden scope:
- Medusa Core modifications
- external search service
- cart/order/payment/auth implementation

Stop conditions:
- Native Medusa APIs cannot satisfy required filter semantics and no thin facade can be scoped safely.
- Endpoint contract would conflict with API guidelines.
- Verification cannot prove filters/search against seeded backend data.

## Authoritative Context Used

- `AGENTS.md`
- `.memory-bank/constitution.md`
- `.memory-bank/mbb/index.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/index.md`
- `.memory-bank/roles/general.md`
- `.memory-bank/tasks/index.json`
- `.memory-bank/tasks/TASK-006.task.json`
- `.memory-bank/packets/TASK-006.packet.json`
- `.memory-bank/features/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/tasks/plans/IMPL-FT-001.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/domains/core-domain.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`
- `.protocols/FT-001/plan.md`
- `.protocols/FT-001/decision-log.md`
- `.memory-bank/commands/execute.md`

## Boundary Notes

Linked boundary/contracts:
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`

Responsibility boundary:
- Backend/PostgreSQL owns catalog query truth.
- Storefront-facing reads use a thin read-only catalog facade because the current foundation has local seeded catalog tables and no implemented native Medusa catalog API surface for the required MVP filters yet.
- The facade exposes stable handles/SKUs and does not expose internal database identifiers.

Boundary drift risk: low. Changes are limited to backend source, backend tests, and backend package script registration. No external search, cart, auth, payment, order, or Medusa Core changes were introduced.

## Preflight Result

- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-006`.
- Tier is `T2`.
- Task status is `planned`, not `done`, `failed`, or `blocked`.
- Dependency `TASK-005` is `done`.
- Linked SDD specs exist and are concrete.
- Packet context is present and semantically consistent with the task/specs.
- `node scripts/mb-doctor.mjs --strict` passed before implementation with the expected `TASK-006` ready-candidate warning.
- No semantic contradiction found between task, packet, feature, implementation plan, API guidelines, and SDD specs.
