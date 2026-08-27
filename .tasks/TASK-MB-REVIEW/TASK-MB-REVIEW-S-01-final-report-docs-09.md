---
description: S-01 architecture review report for FT-006 checkout delivery methods.
status: complete
---
# TASK-MB-REVIEW S-01 Architecture Review

- role: Architect reviewer
- scope: FT-006 C4/API-Workflows-Modules boundaries, source of truth, downstream handoffs, duplicate specs, Constitution compatibility
- mode: read-only review; no remediation or task-status mutation

## Verdict

No blocking architecture issue found for FT-006.

## Evidence

- Constitution/system boundary: `.memory-bank/constitution.md` requires KISS, no Medusa Core modification, API -> Workflows -> Modules, isolated integrations, and evidence before done. `.memory-bank/architecture/system-architecture.md` repeats the same modular-monolith/source-of-truth rules and keeps delivery-provider integration out of MVP scope.
- FT-006 design surface is routed, not duplicated: the feature hub points to exactly five FT-006 SDD docs: feature hub, runtime architecture, API contract, data spec, and validation-state spec. `.memory-bank/spec-index.md` registers those same five active FT-006 specs and does not register a competing FT-006 API/data/state source.
- C4 ownership is coherent: storefront owns form/display state only; Medusa backend owns normalization, actor validation, Shipping Options tariff lookup, transient validation result, and the API -> Workflow -> Module boundary. FT-006 explicitly owns no order, inventory, payment, provider, queue, custom delivery module, or durable checkout snapshot table.
- Source of truth is preserved: Medusa Admin / Shipping Options is the only delivery availability/tariff source; browser state is non-authoritative; client input cannot supply customer identity, tariff amount, order ID, or provider payment ID as authority.
- FT-004 -> FT-006 handoff is consistent: FT-004 owns OAuth/session and only `authenticated_ready` may render checkout continuation, while FT-006 still requires backend actor validation. This avoids treating the UI gate as authorization.
- FT-006 -> FT-007 handoff is consistent: FT-006 outputs a transient validated checkout snapshot. FT-007's pending-order contract re-normalizes/re-resolves delivery data, validates cart ownership, creates the native pending order, and owns reservation/idempotency/expiry. No FT-006 doc claims durable order ownership.
- FT-006 -> FT-009 handoff is bounded: FT-006 passes only stable payment IDs `card`, `sbp`, `sberpay`. FT-009 remains planned and owns YooKassa payment creation, webhook source of truth, provider authenticity, return page, retry, and idempotency. This is an explicit downstream boundary, not a missing FT-006 contract.
- Implementation plan alignment: `IMPL-FT-006` slices TASK-046 as Admin/Shipping Options projection, TASK-047 as authenticated backend validation/handoff, TASK-048 as UI continuation, and TASK-049 as real runtime acceptance. The plan repeats no-order/no-payment/no-provider anti-goals and keeps T2/T3 routing consistent with tier policy.
- Selective runtime evidence supports the architecture: TASK-047 semantic evidence reports actor-derived auth, API -> Workflow -> Module preservation, Admin/Shipping Options tariffs, fail-closed unavailable behavior, transient handoff only, and unchanged order/payment/reservation counts. TASK-049 final verification reports real compiled Medusa/PostgreSQL/storefront evidence with guest `401`, session/bearer `200`, Admin tariffs `0/500/700 RUB`, payment IDs, `422 delivery_method_unavailable`, unchanged order/payment-collection/reservation counts, and no FT-007/FT-009 implementation.
- Feature-level semantic evidence for FT-006 reports `semantic-pass` and confirms the four task slices compose without false success, ownership leak, parser replacement, order mutation, or payment-provider integration.

## Non-Blocking Notes

- FT-009 still lacks feature-level SDD decomposition and remains `lifecycle: planned`; that is acceptable for this S-01 FT-006 architecture review because FT-006 defines only semantic payment IDs and explicitly leaves provider/payment transport to FT-009.
- Malformed JSON parser response normalization is explicitly deferred to standard Medusa parser ownership; FT-006 covers syntactically valid JSON errors through the checkout boundary. This is recorded as residual low risk in semantic evidence, not an architecture blocker.

VERDICT: APPROVE
