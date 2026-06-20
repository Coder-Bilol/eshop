---
description: Pure SDD spec registry and planned-spec index.
status: active
owner: spec-design
last_updated: 2026-06-19
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/spec-backbone.md
---
# SDD Spec Index

## Purpose
- Keep a concise registry of existing and planned SDD specs.
- Read this index before creating new specs or doing serious T2/T3 work.
- Keep readiness, open design questions, backbone status, and routing handoffs in [.memory-bank/spec-backbone.md](spec-backbone.md).
- Feature `spec_design_status` lives in feature frontmatter, not in this index.

## Spec Registry
| Spec | Type | Path | Status | Owner command | Scope |
|---|---|---|---|---|---|
| Project Constitution | governance | [.memory-bank/constitution.md](constitution.md) | active | /constitution | Top governing policy. |
| Product Requirements Document | prd | [.memory-bank/prd.md](prd.md) | active | /write-prd | Clarified PRD source for decomposition. |
| User Scenarios | scenarios | [.memory-bank/user-scenarios.md](user-scenarios.md) | active | /spec-init | Primary actors, core scenarios, and decomposition implications. |
| Core Domain | domain | [.memory-bank/domains/core-domain.md](domains/core-domain.md) | active | /spec-init | Main entities, roles, rules, states, and lifecycles. |
| System Architecture | architecture | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | active | /spec-design | Global architecture backbone, source-of-truth, module, data-flow, storage, deployment, security, and testing guardrails. |
| API Guidelines | contract | [.memory-bank/contracts/api-guidelines.md](contracts/api-guidelines.md) | active | /spec-design | Shared HTTP API naming, auth, error, status, idempotency, CORS, upload, pagination, and compatibility rules. |
| FT-001 Catalog Browsing Filtering Search | feature_design | [.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md](tech-specs/FT-001-catalog-browsing-filtering-search.md) | active | /spec-improve FT-001 | Feature-local catalog query, filter, search, UX state, boundary, and verification design. |
| FT-002 Product Detail Variant Selection | feature_design | [.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md](tech-specs/FT-002-product-detail-variant-selection.md) | active | /spec-improve FT-002 | Feature-local product detail, variant/SKU selection, availability pre-check, cart-action handoff, and verification design. |
| Boundary Map | boundary_hints | [.memory-bank/contracts/boundary-map.md](contracts/boundary-map.md) | active | /spec-init | Responsibility and scope boundary notes. |
| Lifecycle Map | lifecycle_hints | [.memory-bank/states/lifecycle-map.md](states/lifecycle-map.md) | active | /spec-init | Initial lifecycle hints retained for traceability. |
| Order Payment Inventory State | state | [.memory-bank/states/order-payment-inventory.md](states/order-payment-inventory.md) | active | /spec-design | Authoritative order, payment, inventory reservation, cart ownership, and idempotency guardrails. |
| Invariants | invariants | [.memory-bank/invariants.md](invariants.md) | active | /spec-init | Decomposition-shaping MUST/NEVER rules. |
| Glossary | glossary | [.memory-bank/glossary.md](glossary.md) | draft | /spec-init or /spec-design | Shared vocabulary when needed. |
| Testing Index | testing | [.memory-bank/testing/index.md](testing/index.md) | active | /prd or /spec-design | Verification strategy and quality gates. |

## Planned Specs
| Area | Expected path | Needed by | Notes |
|---|---|---|---|
| feature_design | .memory-bank/tech-specs/FT-<NNN>-<slug>.md | /prd-to-tasks; /spec-improve for repair | Feature-local specs only when needed before or during task decomposition. |

## Broken / Missing Links
- None known as of 2026-06-19.

## Update Rules
- Keep this file as index/registry only: names, paths, statuses, owners, scopes, and broken links.
- Do not add global backbone status, backbone matrices, feature status maps, long hard rules, or open design question dumps here.
- Use [.memory-bank/spec-backbone.md](spec-backbone.md) for pre-PRD readiness, decomposition inputs, global backbone status, matrix, and handoffs.
- Use linked specs or ADRs for detailed decisions, rationale, contracts, state transitions, schemas, invariants, and testing rules.
