---
description: Лог изменений Memory Bank.
status: active
---
# Changelog

## [2026-06-20] README product showcase rewrite
- Updated: root `README.md` now presents only the target product showcase, not the repository/spec status.
- Added: explicit killer features section focused on buyer value, cart merge, pending payment, YooKassa webhook correctness, and Medusa Admin visibility.

## [2026-06-20] README showcase
- Added: root `README.md` as a warm project showcase for the spec-first MVP internet shop.
- Documented: product vision, planned stack, feature map, core safety rules, Memory Bank navigation, and current project status without claiming executable app readiness.

## [2026-06-20] FT-001 task decomposition
- Reused the active FT-001 catalog browsing/filtering/search tech spec for task decomposition.
- Added an implementation plan, schema-backed task records, and required execution packets for catalog seed data, backend query/filter contract, storefront catalog UI, edge states, and integration/e2e verification.
- Sequenced FT-001 tasks after `TASK-004` so catalog implementation starts only after the FT-011 local executable foundation.

## [2026-06-20] FT-011 task decomposition
- Completed feature-level SDD design for `FT-011 Docker Compose Local Development`.
- Added an implementation plan, schema-backed task records, and required execution packets for the local development foundation.
- Explicitly included database initialization and project scaffold work in the generated task queue.

## [2026-06-20] PRD decomposition protocol alignment
- Verified: `.memory-bank/prd.md` functional requirements are decomposed into REQ-001..REQ-030, EP-001..EP-005, and FT-001..FT-011.
- Updated: feature SDD Design Gate notes now route the happy path through `/prd-to-tasks FT-<NNN>`, which owns feature-level SDD design before task slicing.
- Updated: shared routing notes in `spec-backbone.md`, `architecture/system-architecture.md`, `states/order-payment-inventory.md`, `spec-index.md`, and `skills/index.md` now keep standalone `/spec-improve` as repair/refresh only.
- Added: `.protocols/PRD-BOOTSTRAP/` audit plan and decision log for this check.

## [2026-06-19] Global SDD backbone gate
- Completed `/spec-design` with `standard_ai_first` mode and a single-file architecture artifact strategy.
- Added global architecture, API, and order/payment/inventory lifecycle guardrails.
- Updated SDD backbone and spec registry so downstream feature design can use authoritative global links.
- Completed `/spec-improve FT-001` with a feature-local catalog browsing/filtering/search tech spec and feature `spec_design_status: complete`.
- Completed `/spec-improve FT-002` with a feature-local product detail/variant selection tech spec and feature `spec_design_status: complete`.

## [2026-06-18] Product framing, PRD, and decomposition
- Ratified the Project Constitution with medium-scope, KISS-first, tier-based DoD, scoped autonomy, and critical non-negotiables.
- Added Product Brief, clarified PRD, pre-PRD SDD framing, domain, boundary, lifecycle, and invariant docs for the MVP internet shop.
- Decomposed the PRD into product, requirements, epics, features, RTM, and testing strategy docs.
- Added workflow router and synchronized spec registry statuses after the PRD review gate.
- Recorded operational review evidence under `.tasks/TASK-MB-REVIEW/`.

## [2026-06-16] Initial setup
- Created Memory Bank skeleton
- Seeded core docs (product, requirements, testing, task registry)
