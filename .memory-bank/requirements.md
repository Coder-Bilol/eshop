---
description: Requirements (REQ IDs) and traceability matrix for the MVP internet shop.
status: active
owner: prd
last_updated: 2026-08-21
source_of_truth:
  - .memory-bank/prd.md
---
# Requirements

## Status Model

- Document `status`: `draft|active|deprecated|archived`
- RTM `Lifecycle`: `planned|implemented|verified`

## REQ List

- REQ-001: The storefront must list home goods products, including curtain rods and related categories.
- REQ-002: The storefront must support product categories.
- REQ-003: The storefront must support search and moderate filters: category, price, color, material, size/length, product type, and mounting method.
- REQ-004: Product cards must support product variants/SKU by color, size, length, and material.
- REQ-005: Product detail pages must allow choosing a valid variant/SKU before add-to-cart when variants exist.
- REQ-006: Buyers must be able to create and update a cart before registration/login.
- REQ-007: Guest cart state must persist between browser sessions.
- REQ-008: On login, guest cart must merge with existing user cart and sum identical variants/SKU.
- REQ-009: Wishlist/favorites must be available only to authenticated users.
- REQ-010: The product must support Google OAuth login.
- REQ-011: The product must support VK ID login.
- REQ-012: Buyers may browse and build a cart as guests, but must be authenticated before payment.
- REQ-013: Checkout must collect name, email, and required phone.
- REQ-014: Checkout must collect delivery city, address, comment, and selected delivery method.
- REQ-015: Checkout must offer pickup, city courier, and transport-company delivery without external provider integration.
- REQ-016: Delivery price must use fixed tariffs by selected delivery method.
- REQ-017: Checkout must collect selected payment method.
- REQ-018: The system must create an order before payment with status `pending_payment`.
- REQ-019: Pending-payment orders must reserve inventory.
- REQ-020: Pending-payment orders must allow payment retry.
- REQ-021: Pending-payment orders must expire/cancel after 72 hours if payment is not completed.
- REQ-022: The order lifecycle must support `pending_payment -> paid -> processing -> completed/canceled/refunded`.
- REQ-023: ЮKassa payment must support cards, СБП, and SberPay.
- REQ-024: ЮKassa webhook must be the source of truth for payment status.
- REQ-025: Repeated webhook events must be handled idempotently without duplicate orders or invalid status transitions.
- REQ-026: Return page after payment must show waiting/result state and must not be authoritative payment confirmation.
- REQ-027: The system must send email notifications for pending order, successful payment, payment error, and order status change.
- REQ-028: Medusa Admin must show contacts, products, delivery data, payment status, order status, total amount, and payment method.
- REQ-029: Operators must be able to use Medusa Admin as the MVP order operations surface.
- REQ-030: The project must provide a Windows 10 native local development path for storefront/backend/database without requiring Docker containers.

## Out Of Scope

- Medusa Core modifications.
- Microservices and enterprise abstractions.
- 1С, СДЭК/Boxberry, bonuses/loyalty, marketplace, B2B, mobile app, SMS confirmation.
- External delivery-provider calculation/tracking.
- Fiscalization/receipt implementation in MVP.
- Custom admin panel replacing Medusa Admin.

## Traceability

| REQ | Epic | Feature | Test | Lifecycle |
|---|---|---|---|---|
| REQ-001 | EP-001 | FT-001 | e2e: catalog browse | verified |
| REQ-002 | EP-001 | FT-001 | e2e: category browse | verified |
| REQ-003 | EP-001 | FT-001 | integration/e2e: filters/search | verified |
| REQ-004 | EP-001 | FT-002 | unit/integration: variant model | verified |
| REQ-005 | EP-001 | FT-002 | e2e: variant add-to-cart | verified |
| REQ-006 | EP-002 | FT-003 | e2e: guest cart update | verified |
| REQ-007 | EP-002 | FT-003 | e2e: cart persistence | verified |
| REQ-008 | EP-002 | FT-003 | unit/integration: cart merge | verified |
| REQ-009 | EP-002 | FT-005 | e2e: authenticated wishlist | verified |
| REQ-010 | EP-002 | FT-004 | integration/e2e: Google OAuth | verified |
| REQ-011 | EP-002 | FT-004 | integration/e2e: VK ID | verified |
| REQ-012 | EP-002 | FT-004 | e2e: login before payment | verified |
| REQ-013 | EP-003 | FT-006 | e2e: checkout contact fields | verified |
| REQ-014 | EP-003 | FT-006 | e2e: delivery data fields | verified |
| REQ-015 | EP-003 | FT-006 | integration/e2e: delivery methods | verified |
| REQ-016 | EP-003 | FT-006 | unit: fixed tariff calculation | verified |
| REQ-017 | EP-003 | FT-006 | e2e: payment method selection | verified |
| REQ-018 | EP-003 | FT-007 | integration: pending order creation | verified |
| REQ-019 | EP-003 | FT-007 | integration: inventory reservation | verified |
| REQ-020 | EP-004 | FT-009 | e2e: payment retry | planned |
| REQ-021 | EP-003 | FT-007 | unit/integration: 72h timeout | verified |
| REQ-022 | EP-003 | FT-008 | unit/integration: order lifecycle | planned |
| REQ-023 | EP-004 | FT-009 | integration: ЮKassa methods | planned |
| REQ-024 | EP-004 | FT-009 | integration: webhook source of truth | planned |
| REQ-025 | EP-004 | FT-009 | integration: webhook idempotency | planned |
| REQ-026 | EP-004 | FT-009 | e2e: return waiting/result state | planned |
| REQ-027 | EP-004 | FT-010 | integration: email events | planned |
| REQ-028 | EP-003 | FT-008 | integration/e2e: admin order visibility | planned |
| REQ-029 | EP-003 | FT-008 | e2e: operator order surface | planned |
| REQ-030 | EP-005 | FT-011 | smoke: Windows native local path | verified |

## RTM Reconciliation

- FT-011 reconciliation: TASK-001 through TASK-004 are `done`, and the final
  feature-level review records `SEMANTIC_VERDICT: semantic-pass`. REQ-030 and
  sole-feature EP-005 are therefore `verified`.
- Product Brief/PRD scope reconciliation: the unsupported Telegram identity-label
  delta was removed instead of being represented as an owner/user decision that
  was never recorded. The active RTM now contains the 30 requirements traceable
  to the Product Brief and clarified PRD.

- REQ-009 is `verified`: all indexed FT-005 tasks (TASK-035..TASK-042, TASK-044,
  TASK-045) are scheduler-closed, and the feature-level review returned
  `SEMANTIC_VERDICT: semantic-pass`, `verdict: APPROVE`, and no findings.
- Evidence navigation: [FT-005 feature review](../.tasks/FT-005/FT-005-S-RED-VERIFY-final-report-docs-01.md)
  and [FT-005 implementation plan](tasks/plans/IMPL-FT-005.md).
- No unrelated requirement lifecycle or document status taxonomy was changed by this
  reconciliation.

- FT-006 scheduler reconciliation: TASK-046 through TASK-049 are `done` with the
  source/projection, authenticated validation, storefront, and real runtime
  acceptance slices verified. The feature-level semantic gate returned
  `SEMANTIC_VERDICT: semantic-pass`; REQ-013 through REQ-017 and FT-006 are now
  `verified`. EP-003 remains `planned` because its downstream order/inventory
  features are not complete.
- Evidence navigation: [TASK-046 record](tasks/TASK-046.task.json),
  [TASK-047 record](tasks/TASK-047.task.json), [TASK-048 record](tasks/TASK-048.task.json),
  [TASK-049 record](tasks/TASK-049.task.json), [FT-006 feature review](../.tasks/FT-006/FT-006-S-RED-VERIFY-final-report-docs-01.md),
  [TASK-049 execute evidence](../.tasks/TASK-049/TASK-049-S-execute-final-report-code-01.md),
  [TASK-049 verification](../.tasks/TASK-049/TASK-049-S-VERIFY-final-report-docs-04.md),
  [TASK-049 semantic verification](../.tasks/TASK-049/TASK-049-S-RED-VERIFY-final-report-docs-02.md),
  [TASK-046 execute evidence](../.tasks/TASK-046/TASK-046-S-execute-final-report-code-02.md),
  [TASK-046 verification](../.tasks/TASK-046/TASK-046-S-verify-final-report-docs-01.md),
  [TASK-046 historical STOP_REPORT](../.tasks/TASK-046/TASK-046-S-execute-stop-report-code-01.md),
  [TASK-046 handoff](../.protocols/TASK-046/handoff.md),
  [TASK-046 progress](../.protocols/TASK-046/progress.md), and
  [TASK-046 sync report](../.tasks/TASK-046/TASK-046-S-MB-SYNC-final-report-docs-02.md).
- Historical blocker preserved: the initial provider/configuration scope conflict was
  resolved through the recorded owner-approved bounded expansion to
  `apps/backend/medusa-config.ts`; the final gates and independent verification then
  passed without changing the Admin-managed source boundary.

- FT-007 scheduler reconciliation: TASK-050 is `done` with functional `PASS`,
  semantic `semantic-pass`, packet readiness, and exact T3 checkpoint/recovery
  evidence. REQ-018 and REQ-019 are now `verified`; REQ-021 remains `planned`
  because timeout/cancellation work belongs to TASK-051/TASK-052. EP-003 remains
  `planned` and no dependent task promotion was performed.
- Evidence navigation: [TASK-050 record](tasks/TASK-050.task.json),
  [TASK-050 verification](../.tasks/TASK-050/TASK-050-S-VERIFY-final-report-docs-03.md),
  [TASK-050 semantic verification](../.tasks/TASK-050/TASK-050-S-RED-VERIFY-final-report-docs-03.md),
  [TASK-050 packet](packets/TASK-050.packet.json),
  [TASK-050 protocol verification](../.protocols/TASK-050/verification.md),
  [TASK-050 protocol semantic verification](../.protocols/TASK-050/red-verification.md),
  [TASK-050 handoff](../.protocols/TASK-050/handoff.md), and
  [TASK-050 integration log](../.tasks/TASK-050/pending-order-integration.log).

- TASK-051 scheduler reconciliation: the task is `done` with functional
  `VERDICT: PASS`, per-task `SEMANTIC_VERDICT: semantic-pass`, exact T3
  checkpoint/recovery markers, and real Medusa/PostgreSQL evidence for the
  72-hour expiry, native cancellation, reservation release, guarded no-ops,
  partial-cleanup retry, and repeated execution. REQ-021 is now `verified`.
  FT-007 remains `implemented`, not feature-complete, because TASK-052 still
  owns the storefront handoff and full runtime acceptance slice.
- Evidence navigation: [TASK-051 record](tasks/TASK-051.task.json),
  [verification](../.protocols/TASK-051/verification.md),
  [semantic verification](../.protocols/TASK-051/red-verification.md),
  [handoff](../.protocols/TASK-051/handoff.md), and
  [integration status](../.tasks/TASK-051/pending-order-expiry-integration-20260820-101621.status.json).

- FT-007 final reconciliation: TASK-052 and feature follow-up TASK-053 are
  `done` with functional `PASS`, per-task `semantic-pass`, exact T3 markers,
  matching final packets, and real compiled Medusa/PostgreSQL/Edge evidence.
  The final feature review returned `SEMANTIC_VERDICT: semantic-pass` after
  expired same-key replay was proven to return stable `409` with no replacement
  order/reservation. REQ-018, REQ-019, and REQ-021 remain `verified` and FT-007
  is now `verified`.
- Final evidence: [TASK-053 record](tasks/TASK-053.task.json),
  [functional verification](../.protocols/TASK-053/verification.md),
  [semantic verification](../.protocols/TASK-053/red-verification.md), and
  [feature review](../.tasks/FT-007/FT-007-S-RED-VERIFY-final-report-docs-02.md).
