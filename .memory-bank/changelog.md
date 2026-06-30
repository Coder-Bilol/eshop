---
description: Лог изменений Memory Bank.
status: active
---
# Changelog

## [2026-06-30] TASK-014 final verification and closure
- Verified: fresh manual `/verify TASK-014` passed Windows-native smoke, backend product-detail integration, storefront product-detail E2E, Memory Bank lint, and packet/spec gate checks.
- Closed: `TASK-014` as `done` with T2 closure ownership by GENERAL after executable evidence and prior per-task semantic-pass red-verification.
- Updated: RTM lifecycle for `REQ-004` and `REQ-005` to `verified`; `FT-002` lifecycle to `implemented`, with feature-level `/red-verify --feature FT-002` still required before treating the feature as semantically complete.

## [2026-06-30] Red-verify all indexed tasks
- Added: per-task `/red-verify` protocol and final report artifacts for `TASK-001` through `TASK-014`.
- Result: all indexed tasks received `SEMANTIC_VERDICT: semantic-pass` in per-task mode.
- Note: task statuses were not changed; `TASK-014` still requires `/verify TASK-014`, and feature-level red-verification remains separate for `FT-001`/`FT-002` completion.

## [2026-06-30] TASK-014 FT-002 integration and e2e execution
- Added: product-detail route coverage to the local E2E backend harness and a storefront Playwright E2E flow for FT-002 variant selection acceptance states.
- Verified: `TASK-014` `/execute` gates passed for Windows-native smoke, backend product-detail integration, storefront product-detail E2E, and Memory Bank lint.
- Note: `TASK-014` remains pending `/verify TASK-014`; FT-002 feature-level semantic completion remains a separate `/red-verify --feature FT-002` step after task closure.

## [2026-06-30] TASK-009 closure sync
- Synced: `TASK-009` remains closed as `done` with manual T2 `/verify` evidence and GENERAL closure ownership.
- Updated: RTM lifecycle for `REQ-001`, `REQ-002`, and `REQ-003` to `verified` from TASK-009 browser/integration evidence.
- Updated: `FT-001` lifecycle to `implemented`; feature-level `verified` remains pending `/red-verify --feature FT-001`.

## [2026-06-29] TASK-009 final verification
- Verified: fresh manual `/verify TASK-009` passed Windows-native smoke, backend catalog integration, storefront browser E2E, Memory Bank lint, strict doctor precheck, and Playwright artifact checks.
- Closed: `TASK-009` as `done` with T2 closure ownership by GENERAL after full protocol, packet/spec gate, seeded PostgreSQL-backed evidence, and REQ-001..REQ-003 coverage.
- Note: FT-001 feature-level semantic completion remains a separate `/red-verify --feature FT-001` step.

## [2026-06-28] TASK-009 FT-001 acceptance E2E
- Fixed: expanded TASK-009 scope and refreshed its packet so the storefront E2E script and dependency lockfile can be maintained.
- Added: Playwright browser coverage for catalog browse, category, search, all required filters, combined search and filters, empty results, and missing optional attributes.
- Verified: browser UI mirrors seeded PostgreSQL-backed catalog responses; Windows smoke, backend integration, storefront E2E, Memory Bank lint, and strict doctor pass.

## [2026-06-28] TASK-008 catalog edge-state verification
- Added: route-level catalog loading UI and local coverage for empty, backend-error, missing-attribute, and selected query states.
- Verified: pure catalog query-state normalization and href override behavior with deterministic unit assertions.
- Closed: `TASK-008` after storefront catalog tests, typecheck, Memory Bank lint, component trace evidence, and strict doctor passed.

## [2026-06-28] TASK-013 storefront product detail verification
- Added: backend-driven product detail route, responsive variant selector, loading/error/default-SKU states, and variant-aware product-card summaries.
- Verified: missing, impossible, and unavailable selections stay blocked; a valid SKU reaches the narrow product handle/SKU/quantity/validation handoff without cart persistence.
- Closed: `TASK-013` with manual T2 `VERDICT: PASS`; FT-002 remains incomplete pending TASK-014 and feature-level semantic verification.

## [2026-06-28] TASK-012 variant selection helper verification
- Added: pure storefront variant selection resolution for missing, impossible, unavailable, valid, and single/default SKU states.
- Verified: missing, impossible, ambiguous, unavailable, and multi-variant incomplete selections cannot become valid add-to-cart submissions.
- Closed: `TASK-012` with manual T1 `VERDICT: PASS`; `TASK-013` remains a scheduler promotion decision.

## [2026-06-25] TASK-010 product detail seed verification
- Added: backend product-detail seed smoke for multi-option variants, unavailable variant, and default SKU product.
- Fixed: reconciled TASK-010 scope to include `apps/backend/package.json` for the required `smoke:product-detail` npm gate.
- Verified: `TASK-010` after packet refresh with passing `db:seed`, `smoke:product-detail`, and Memory Bank lint evidence.

## [2026-06-24] W1 local foundation verification
- Verified: `TASK-004` with passing `smoke:local`, `check:local-env`, runbook coverage, and Memory Bank lint evidence.
- Closed: W1 task set `TASK-001`..`TASK-004` now has functional `/verify` PASS evidence and `done` task status.
- Note: FT-011 feature-level semantic verification remains separate before treating the whole feature as semantically complete.

## [2026-06-24] TASK-004 local smoke runbook
- Added: Windows-native local development runbook at `.memory-bank/runbooks/local-development.md`.
- Updated: `smoke:local` summary now links the local runbook and task evidence location.
- Documented: local setup, startup, smoke, stop, port conflicts, and explicit local-only reset behavior without Docker containers or production secrets.

## [2026-06-23] TASK-002 Windows PostgreSQL verification
- Added: backend `db:check` command for Windows-native local PostgreSQL preflight.
- Verified: `TASK-002` against local PostgreSQL 18.4 with passing `db:check`, `db:migrate`, `db:seed`, and `smoke:db` evidence.
- Updated: `TASK-002` task record to `done`, refreshed its execution packet hash, and archived the previous local PostgreSQL unavailable blocker.

## [2026-06-23] FT-011 Windows-native local runtime pivot
- Updated: PRD, product, requirements, EP-005, FT-011, global architecture backbone, spec registry, and FT-011 tech spec now require Windows 10 native local development instead of Docker Compose.
- Updated: FT-011 implementation plan, `TASK-001`..`TASK-004` source/spec references, `TASK-003`/`TASK-004` gates, and required packets to use local PostgreSQL and npm-based startup/smoke checks.
- Recorded: Docker is reserved only for a future remote server deployment path, which remains out of current local-foundation scope and must be designed separately as T3 deploy work.

## [2026-06-20] Global task wave classification
- Reclassified task `wave` values as global execution buckets: W1 foundation, W2 core implementation after foundation, and W3 polish/final cross-feature verification.
- Moved all FT-011 local foundation tasks into W1, moved FT-001/FT-002 core implementation tasks into W2, and kept edge/final verification tasks in W3.
- Relaxed FT-002 core start from `TASK-009` to `TASK-007`, while keeping final FT-002 verification after FT-001 final verification.

## [2026-06-20] FT-002 task decomposition
- Reused the active FT-002 product detail and variant selection tech spec for task decomposition.
- Added an implementation plan, schema-backed task records, and required execution packets for variant seed data, backend product detail contract, storefront variant selection helpers/UI, cart-action handoff, and integration/e2e verification.
- Sequenced FT-002 tasks after `TASK-009` so product detail work starts after the FT-011 local foundation and FT-001 catalog surfaces.

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
