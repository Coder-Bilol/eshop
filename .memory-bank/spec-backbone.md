---
description: Pre-PRD spec framing and global SDD backbone state.
status: active
owner: spec-design
last_updated: 2026-07-07
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/spec-index.md
  - .memory-bank/architecture/system-architecture.md
---
# SDD Spec Backbone

## Pre-PRD Spec Status
- Status: ready_for_prd
- Last updated: 2026-06-18
- Notes: Pre-PRD framing is prepared from `.memory-bank/prd.md` and linked framing specs. This framing remains valid after `/spec-design`.

## Decomposition Inputs
- User scenarios: authoritative; see [.memory-bank/user-scenarios.md](user-scenarios.md) and [.memory-bank/prd.md](prd.md).
- Domain model: authoritative; see [.memory-bank/domains/core-domain.md](domains/core-domain.md), [.memory-bank/states/order-payment-inventory.md](states/order-payment-inventory.md), and [.memory-bank/prd.md](prd.md).
- Constraints: authoritative; see [.memory-bank/constitution.md](constitution.md), [.memory-bank/invariants.md](invariants.md), and [.memory-bank/prd.md](prd.md).
- Non-goals: authoritative; see [.memory-bank/prd.md](prd.md) and [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md).
- Risks: authoritative; see [.memory-bank/prd.md](prd.md), [.memory-bank/analysis/product-brief.md](analysis/product-brief.md), and [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md).
- Boundary map: authoritative; see [.memory-bank/contracts/boundary-map.md](contracts/boundary-map.md), [.memory-bank/contracts/api-guidelines.md](contracts/api-guidelines.md), and [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md).
- Lifecycle map: authoritative; see [.memory-bank/states/lifecycle-map.md](states/lifecycle-map.md) and [.memory-bank/states/order-payment-inventory.md](states/order-payment-inventory.md).

## Open Design Questions
- YooKassa local/staging credentials and webhook URL/tunneling setup: non-blocking for global backbone; blocks payment/local-dev feature implementation until resolved.
- Fiscalization/receipt obligations before production launch: non-blocking for MVP implementation because fiscalization is out of scope; blocks production launch if legal/payment review requires receipts.
- Exact Medusa v2 extension points, status mapping, and stock reservation mechanics: non-blocking for global backbone; must be resolved during FT-007, FT-008, and FT-009 feature-level design in `/prd-to-tasks` or standalone `/spec-improve` repair.
- Email provider/configuration: non-blocking for global backbone; must be resolved before FT-010 implementation.
- Remote server deployment target: operational runbook exists in [DEPLOYMENT.md](../DEPLOYMENT.md) for AlmaLinux VPS, Docker Compose application containers, and host-level Caddy automatic HTTPS; actual production deploy work remains T3.

## Backbone Area Matrix
| Area | Status | Authoritative source | Notes |
|---|---|---|---|
| architecture_style | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | Modular monolith: Next.js storefront, Medusa v2 backend, PostgreSQL, Windows 10 native local runtime. |
| source_of_truth | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); [.memory-bank/constitution.md](constitution.md) | Decision and runtime source-of-truth hierarchy is fixed for downstream work. |
| module_boundaries | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); [.memory-bank/contracts/boundary-map.md](contracts/boundary-map.md) | API -> Workflows -> Modules; external integrations isolated. |
| user_scenarios | authoritative | [.memory-bank/user-scenarios.md](user-scenarios.md) | Scenario evidence is sufficient for backbone decisions. |
| constraints | authoritative | [.memory-bank/constitution.md](constitution.md); [.memory-bank/invariants.md](invariants.md); [.memory-bank/prd.md](prd.md) | KISS, no Medusa Core modification, high-tier routing for sensitive areas. |
| non_goals | authoritative | [.memory-bank/prd.md](prd.md); [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | MVP exclusions remain unchanged. |
| domain_model | authoritative | [.memory-bank/domains/core-domain.md](domains/core-domain.md); [.memory-bank/states/order-payment-inventory.md](states/order-payment-inventory.md) | Shared vocabulary and lifecycle guardrails are ready for feature-local design. |
| data_flow | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | Catalog, cart/login, checkout/order, payment webhook, notifications/admin flows documented. |
| storage | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); [.memory-bank/states/order-payment-inventory.md](states/order-payment-inventory.md) | PostgreSQL is the only durable store; browser state is non-authoritative. |
| api_contracts | authoritative | [.memory-bank/contracts/api-guidelines.md](contracts/api-guidelines.md); [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | Endpoint-level schemas remain feature-local. |
| event_message_contracts | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); [.memory-bank/states/order-payment-inventory.md](states/order-payment-inventory.md) | No custom event bus; HTTP webhooks and Medusa-local side effects only. |
| agent_io_contracts | not_applicable | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | not_applicable - product has no runtime AI/agent/chat I/O boundary. |
| security_safety | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); [.memory-bank/invariants.md](invariants.md); [.memory-bank/workflows/tier-policy.md](workflows/tier-policy.md) | Auth, payment, order, inventory, deploy, and compliance-sensitive work route high tier. |
| testing_strategy | authoritative | [.memory-bank/testing/index.md](testing/index.md); [.memory-bank/workflows/tier-policy.md](workflows/tier-policy.md); [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | Unit/integration/e2e and T2/T3 verification requirements are linked. |
| deployment | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); [.memory-bank/features/FT-011-windows-native-local-development.md](features/FT-011-windows-native-local-development.md); [DEPLOYMENT.md](../DEPLOYMENT.md) | Windows-native local development is designed; remote VPS deployment runbook uses Docker Compose application containers and host-level Caddy. Production deploy work remains T3. |
| risks | authoritative | [.memory-bank/prd.md](prd.md); [.memory-bank/analysis/product-brief.md](analysis/product-brief.md); [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md) | Non-blocking global risks are routed to feature-local design or production follow-up. |
| open_questions | authoritative | [.memory-bank/architecture/system-architecture.md](architecture/system-architecture.md); this file | Open questions are scoped and do not block global backbone completion. |

## Handoff To /prd
- Ready: complete
- Historical note: `/prd` decomposition has already produced requirements, epics, and features.
- Required reads for future PRD refresh: [.memory-bank/prd.md](prd.md), [.memory-bank/spec-index.md](spec-index.md), this file, [.memory-bank/user-scenarios.md](user-scenarios.md), [.memory-bank/domains/core-domain.md](domains/core-domain.md), [.memory-bank/contracts/boundary-map.md](contracts/boundary-map.md), [.memory-bank/states/lifecycle-map.md](states/lifecycle-map.md), and [.memory-bank/invariants.md](invariants.md).

## Handoff To /spec-design
- Global Backbone Status: complete
- Downstream readiness: global backbone no longer blocks `/prd-to-tasks`; feature-local design remains required inside `/prd-to-tasks`.
- Architecture artifact strategy: single-file global hub plus small contract/state guardrail specs.

## Global Backbone Status
- Status: complete
- Mode: standard_ai_first
- Architecture artifact strategy: single-file
- Not applicable areas:
  - agent_io_contracts: not_applicable - product has no runtime AI/agent/chat I/O boundary; agent execution artifacts stay in Memory Bank/task protocol files.
- Notes:
  - No meaningful production code exists yet, so `/map-codebase` is not required before this backbone.
  - Sensitive feature work remains T2/T3 as routed by task policy and feature-level design inside `/prd-to-tasks`.
  - Next manual routing: choose a feature and run `/prd-to-tasks FT-<NNN>`; use standalone `/spec-improve` only for repair/refresh.
