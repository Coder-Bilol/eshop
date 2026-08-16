---
description: Execution context for TASK-049 final FT-006 runtime acceptance harness.
status: in_progress
---
# TASK-049 Context

## Task and packet

- Task: `TASK-049`, tier `T3`, role `Implementer`.
- Authoritative record: `.memory-bank/tasks/TASK-049.task.json`.
- Packet: `.memory-bank/packets/TASK-049.packet.json`, `status: ready`.
- Feature: `FT-006 Checkout Delivery Methods`.
- Dependencies: `TASK-047`, `TASK-048`, and `TASK-034` are `done` in the
  authoritative task records.

## Goal Interpretation

- Purpose: replace unit-only confidence with real local backend and browser
  evidence for the complete authenticated FT-006 runtime.
- Success outcome: a real Medusa/PostgreSQL/backend/storefront flow proves
  authenticated entry, Admin-owned delivery/tariff truth, validation and
  recovery, transient downstream handoff, no FT-006 mutation, privacy, and
  cleanup.
- Anti-goals: no production checkout/auth/parser/UI changes; no Medusa Core,
  FT-007 order/inventory, FT-009 provider, live provider, production data, or
  browser-authoritative bypass.
- Allowed write scope: the packet six runtime/package/changelog paths, plus
  this task's `.protocols/TASK-049/` and `.tasks/TASK-049/` operational evidence.
- Forbidden scope: auth provider/session behavior, direct browser DB/module
  access, live providers, production secrets/data, task status/packet/dependents,
  `/verify`, `/red-verify`, markers, and `/mb-sync`.
- Stop conditions: unavailable local runtime, untruthful mutation evidence,
  cleanup that cannot be guaranteed, sensitive evidence, or a required public
  contract change.

## Normative inputs read

- `AGENTS.md`, `.memory-bank/constitution.md`, `.memory-bank/mbb/index.md`,
  `.memory-bank/spec-backbone.md`, `.memory-bank/spec-index.md`,
  `.memory-bank/index.md`, `.memory-bank/roles/worker.md`.
- `.agents/skills/mb-execute/SKILL.md`, `.memory-bank/commands/execute.md`,
  `.memory-bank/workflows/tier-policy.md`.
- `.memory-bank/features/FT-006-checkout-delivery-methods.md`,
  `.memory-bank/tech-specs/FT-006-checkout-delivery-methods.md`,
  `.memory-bank/architecture/checkout-delivery-runtime.md`,
  `.memory-bank/contracts/checkout-delivery-api.md`,
  `.memory-bank/contracts/api-guidelines.md`,
  `.memory-bank/contracts/boundary-map.md`,
  `.memory-bank/domains/checkout-delivery-data.md`,
  `.memory-bank/states/checkout-delivery-validation.md`,
  `.memory-bank/states/customer-auth-session.md`,
  `.memory-bank/states/order-payment-inventory.md`,
  `.memory-bank/contracts/auth-session-security.md`,
  `.memory-bank/testing/index.md`, `.memory-bank/invariants.md`,
  `.memory-bank/analysis/brainstorming/BR-002.md`, and
  `.memory-bank/tasks/plans/IMPL-FT-006.md`.
- `.protocols/FT-006/plan.md` and `.protocols/FT-006/decision-log.md`.
- TASK-047 backend route/acceptance evidence and TASK-048 storefront protocol
  evidence as dependency source of truth.

## Boundary notes

- Backend acceptance uses compiled Medusa HTTP, standard session/bearer
  authentication, PostgreSQL mutation counts, and synthetic Admin Shipping
  Options fixtures. It does not call the browser or production providers.
- Browser acceptance uses the existing local Google provider double and real
  Medusa callback/session cookie, then exercises the real storefront form and
  `POST /store/checkout` HTTP boundary. No Playwright route mock or direct DB/
  module access is used from the page.
- The standard Medusa body parser remains framework-owned. Malformed-JSON
  normalization is not implemented or asserted as an application decision.

## Preflight result

- Passed: task/index/packet/spec/dependency presence and scope reconciliation.
- Passed: target dirty files were existing TASK-047 changes; edits are additive.
- No implementation blocker found.
