# TASK-MB-REVIEW S-01 — Architecture Review (FT-008, report set 17)

## Verdict

`REJECT`. The remediated FT-008 architecture is coherent on payment-profile
ownership, lifecycle precedence, C4 routing, native Admin authority, and the
conditional FT-009 boundary, but its declared complete protected-metadata
boundary omits two workflow-owned order metadata keys already persisted by
FT-007. This is a blocking data-integrity/security contract gap before
TASK-054 may start.

## Blocking findings

### B-01 — BLOCKER: the protected workflow metadata set is not complete

**Evidence**

- `apps/backend/src/workflows/checkout/create-pending-order.ts:237-255` writes
  `checkout_reservation_item_ids` and `checkout_reservation_line_ids` into the
  native `Order.metadata` object in the `ft-007-persist-pending-order-metadata`
  step.
- `.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md:146-155`,
  `.memory-bank/contracts/order-lifecycle-admin-api.md:199-209`, and
  `.memory-bank/domains/order-lifecycle-admin-data.md:53-65` call their list the
  complete workflow-owned/protected set, but omit both reservation-linkage
  keys.
- TASK-055, TASK-056, TASK-057, and `IMPL-FT-008` require testing every
  protected key *from the data/contract specs*. Because the authoritative list
  is incomplete, those acceptance checks can pass while the generic Admin
  metadata editor/API is still allowed to change or delete two FT-007-owned
  values.

**Why blocking**

This directly contradicts the stated FT-008 security boundary and D-012
(`complete workflow metadata set`). It also conflicts with Constitution V/VII/VIII:
order/inventory evidence is high-risk, data preservation is non-negotiable, and
execution must not rely on an undocumented assumption that the omitted keys are
irrelevant. Whether these arrays remain operational controls or only durable
reservation traceability, they are server-written workflow metadata and cannot
silently fall outside a boundary advertised as complete.

**Required remediation**

Choose and document one path, then synchronize all derivative artifacts:

1. If the keys remain part of FT-007 data, add them to the FT-007 data contract
   and every FT-008 protected-set definition; extend TASK-055/056/057 acceptance
   to prove built-in editor and direct Admin API change/deletion are rejected or
   preserved for both keys.
2. If the keys are obsolete, explicitly remove their writer and define safe
   compatibility/cleanup handling for existing orders before claiming that the
   smaller set is complete.

Refresh affected packets/hashes, rerun strict doctor/lint, and repeat S-01 after
the selected contract is explicit. Do not solve this by UI-only hiding.

## Non-blocking architecture observations

### N-01 — Clarify installed Medusa terminology for the full-refund predicate

The cumulative predicate is otherwise consistent across the hub, runtime,
contract, data, state, shared lifecycle, plan, and tasks: it binds all payments
to the same payment collection, requires positive captured value, uses current
authoritative raw totals/currency precision, preserves partial-refund state,
and re-evaluates duplicate/out-of-order events.

However, the installed Medusa 2.16 `CaptureDTO` and `RefundDTO` have no
`successful`/`completed` status field
(`node_modules/@medusajs/types/dist/payment/common.d.ts:337-404`). The native
refund workflow persists the refund and only then emits `PaymentEvents.REFUNDED`
(`node_modules/@medusajs/core-flows/dist/payment/workflows/refund-payment.js:116-148`).
Before implementing TASK-054, define “successful captures” and “completed
refunds” as persisted native capture/refund records (or the corresponding
`raw_captured_amount` / `raw_refunded_amount` aggregates), not as nonexistent
status values. TASK-054 already has a correct stop condition if authoritative
totals or precision cannot support the predicate, so this precision issue does
not independently change the verdict.

## Evidence checked and passed

- **Personal-request compatibility:** FT-006 and FT-007 accept/persist only
  `personal_request` for new checkout. Existing `card|sbp|sberpay` values are
  consistently preserved as legacy offline-request labels and are never used as
  provider/payment proof. Current backend and storefront validation also expose
  only `personal_request`.
- **Conditional FT-009 scope:** system architecture, shared lifecycle, testing,
  FT-006/007/008 specs, FT-009 feature, and D-013 consistently make webhook
  idempotency, simulated provider events, and return-page behavior FT-009-only.
  FT-008 is native-Admin-driven and has no provider call.
- **Cancellation/refund precedence:** authoritative native cancellation remains
  `canceled`; cancellation-origin refund cannot overwrite it; FT-007 expiry
  origin/reason/cleanup survives; partial standalone refunds preserve the
  current logical state; completed-order correction routes through native
  refund/return.
- **Concurrency and authority:** one canonical
  `order-lifecycle:${order_id}` lock is required before authoritative re-read
  and native mutation for expiry and every supported Admin operation, with the
  projector reacquiring it. Native Admin auth/RBAC authorizes the operation;
  the event bus is notification, not actor or commit proof. Inability to wrap
  the complete installed native handler is an explicit TASK-055 stop condition,
  not permission to modify Medusa Core.
- **Native Admin mechanism:** installed package versions are pinned to Medusa
  2.16. The dashboard source confirms `metadata` and payment/fulfillment
  relations in `DEFAULT_FIELDS`, `showMetadata`/`showJSON`, the native metadata
  editor, and `sdk.admin.paymentCollection.markAsPaid(..., { order_id })`.
- **C4, boundaries, and ADR:** navigation remains Product (L1) -> EP-003 (L2)
  -> FT-008 (L3) -> IMPL/TASK (L4). FT-007/008/009/010 ownership is explicit.
  The accepted single-file KISS architecture strategy treats authoritative SDD
  specs as decision records; a separate ADR is therefore not missing. D-001
  through D-013 preserve rationale and consequences without introducing a
  parallel architecture.
- **Constitution:** no microservice, custom Admin replacement, parallel order
  store, Medusa Core edit, client-authoritative payment/status, or speculative
  FT-009 implementation is proposed. The sole blocking Constitution concern is
  the incomplete protected-set contract in B-01.
- **Readiness diagnostics:** `node scripts/mb-lint.mjs` passed (144 files).
  `node scripts/mb-doctor.mjs --strict` passed with 0 errors and 0 warnings.
  These structural gates do not detect B-01's semantic omission.

## Risks or questions

- TASK-055's supported full-handler wrapper remains an intentional preflight
  risk. The documented fail-closed stop condition is sufficient for starting
  the earlier pure-model work only after B-01 is remediated; it is not evidence
  that the wrapper is already feasible.
- No other blocking C4, boundary, ADR, lifecycle, native Admin, FT-009 scope, or
  Constitution contradiction was found in the reviewed surface.

VERDICT: REJECT
