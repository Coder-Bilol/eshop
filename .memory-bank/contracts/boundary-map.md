---
description: Lightweight responsibility and scope boundary notes for decomposition, implementation, and verification.
status: active
owner: spec-init
last_updated: 2026-06-18
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/constitution.md
---
# Boundary Map

## Purpose
- Keep lightweight boundary notes that help agents avoid crossing ownership, responsibility, or write-scope lines during decomposition and task execution.
- Use this file as an existing contract/spec input when task records need `purpose`, `success_outcome`, `anti_goals`, `runtime_context.allowed_write_scope`, `runtime_context.forbidden_scope`, or `runtime_context.stop_conditions`.

## Boundary Notes
| Boundary | Purpose | Direction | Owner | Known Constraints | Questions |
|---|---|---|---|---|---|
| Storefront | Buyer-facing catalog, cart, login-before-payment, checkout, return/waiting result pages. | Next.js -> Medusa APIs | Storefront / buyer UX | No custom admin replacement; checkout must require login before payment. | Exact UI layout later. |
| Medusa Extensions | Product/cart/order/workflow/module extension boundary. | API -> Workflows -> Modules | Backend | Do not modify Medusa Core; keep KISS. | Exact Medusa extension points later. |
| Auth Providers | Google OAuth and VK ID login. | External provider -> auth/customer identity | Auth module/integration | Security/privacy and T3 task routing likely. | Provider credentials and callback setup later. |
| ЮKassa Payments | Payment creation, return state, authoritative webhook status. | Store/backend <-> ЮKassa | Payment module/integration | Webhook is source of truth; repeated events must be idempotent. | Local/staging webhook URLs and credentials. |
| Inventory Reservation | Reserve/release/finalize stock around pending-payment order. | Order workflow -> inventory | Backend workflow/module | 72-hour pending timeout; no data loss. | Exact Medusa stock reservation model later. |
| Email Notifications | Pending order, payment success/error, order status change emails. | Order/payment events -> email provider | Notification module/integration | Email provider not selected. | Provider/config later. |
| Medusa Admin Operations | Operator sees order contacts/products/delivery/payment/order status/amount/payment method. | Backend state -> Medusa Admin | Operations | Medusa Admin is MVP operations surface. | Field visibility/customization later. |

## Runtime Context Hints
- Allowed write scope hints: future implementation tasks should keep storefront, backend modules/workflows, integration modules, and local Docker config scoped per feature/task.
- Forbidden scope hints: no Medusa Core modifications, no microservices, no external delivery-provider integration, no fiscalization implementation in MVP.
- Stop condition hints: stop on unclear payment/compliance obligations, source-of-truth conflict, secret/prod/deploy ambiguity, or design that would require changing Constitution.

## Update Rules
- Keep entries evidence-backed and short.
- Do not add endpoint lists, OpenAPI details, request/response schemas, auth policy, error-code design, or implementation pseudocode here.
- Do not create new task fields for boundaries; link this file through existing task fields such as `source_artifacts`, `normative_inputs`, `constraints`, `invariants`, or `verification_targets`, and copy executable scope into `runtime_context` when needed.
