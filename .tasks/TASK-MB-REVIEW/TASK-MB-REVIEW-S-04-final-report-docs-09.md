---
description: Security/safety review report for FT-006 checkout delivery methods.
status: complete
---
# TASK-MB-REVIEW S-04 Security Review

REVIEW_REPORT
- role: Security reviewer
- task_id: TASK-MB-REVIEW
- stage_id: S-04
- scope: FT-006 checkout delivery methods, authenticated validation, tariff source, recovery, evidence privacy, and downstream no-mutation boundary.
- mode: read-only docs/code/evidence review

## Verdict

APPROVE. No blocking security, safety, OWASP, or Constitution contradiction was found for the reviewed FT-006 surface.

## Evidence Checked

- Governing policy: `.memory-bank/constitution.md`, `.memory-bank/invariants.md`, `.memory-bank/spec-backbone.md`, `.memory-bank/spec-index.md`, `.memory-bank/architecture/system-architecture.md`.
- FT-006 design: `.memory-bank/features/FT-006-checkout-delivery-methods.md`, `.memory-bank/tech-specs/FT-006-checkout-delivery-methods.md`, `.memory-bank/architecture/checkout-delivery-runtime.md`, `.memory-bank/contracts/checkout-delivery-api.md`, `.memory-bank/domains/checkout-delivery-data.md`, `.memory-bank/states/checkout-delivery-validation.md`.
- Shared security/contracts: `.memory-bank/contracts/auth-session-security.md`, `.memory-bank/contracts/api-guidelines.md`, `.memory-bank/states/order-payment-inventory.md`.
- Planning/runtime evidence: `.memory-bank/tasks/plans/IMPL-FT-006.md`, task records `TASK-046`..`TASK-049`, final verification/semantic reports for `TASK-046`, `TASK-047`, `TASK-048`, `TASK-049`, and `.tasks/FT-006/FT-006-S-RED-VERIFY-final-report-docs-01.md`.
- Selective source/runtime inspection: `apps/backend/src/api/store/checkout/route.ts`, `validators.ts`, `apps/backend/src/checkout/validation.ts`, `apps/backend/src/workflows/checkout/validate-checkout.ts`, storefront checkout client/state/form, and `.tasks/TASK-049/playwright/checkout-browser-report.json`.

## Security Findings

- Actor ownership: PASS. FT-006 requires Medusa customer auth, derives the actor from `req.auth_context`, rejects unexpected body keys such as client-supplied `customer_id`, and removes `customer_id` from the public snapshot. TASK-047/TASK-049 evidence covers guest `401`, bearer/session `200`, and client identity rejection.
- Input normalization and limits: PASS. Backend normalization uses NFKC, whitespace collapse, trim, email lowercasing, server-side bounded lengths, field allowlisting, stable delivery/payment ID allowlists, conditional address validation, and safe email syntax validation. Client-side normalization exists only as UX help and is not authoritative.
- Sanitized errors: PASS with one accepted residual limitation. Syntactically valid request/workflow failures map to stable sanitized envelopes, including `delivery_method_unavailable`. Malformed JSON parser responses remain standard Medusa-owned by explicit operator decision and are documented as out of FT-006 closure scope.
- PII/secrets/evidence: PASS. Specs forbid real PII/secrets. Final evidence states synthetic-only data, no production values, no cookies/tokens/provider payloads, sanitized browser artifacts, and the checked browser JSON omits request field values.
- Tariff tampering: PASS. Client cannot submit tariff amount. Backend resolves selected delivery against Medusa Admin / Shipping Options, accepts only RUB safe integer tariffs, fails closed on missing/invalid/ambiguous tariff data, and evidence proves no hardcoded runtime fallback or silent substitution.
- False order/payment success: PASS. FT-006 validate workflow returns transient handoff only. TASK-047/TASK-049 evidence reports unchanged orders/payment collections/reservation counts and source-boundary scans with no FT-006 order, inventory, payment, or provider calls. Later pending-order UI/code is FT-007 scope and does not invalidate FT-006's no-success claim.
- Unavailable recovery: PASS. Specs and evidence require exact `422 delivery_method_unavailable`, retry or explicit alternative selection, no stale tariff authority, and no silent replacement.
- OWASP risks: PASS for the reviewed surface. Access control, input validation, error disclosure, sensitive data exposure, insecure design, security logging exposure, and SSRF/open-redirect/provider-token classes are either directly guarded or not applicable to FT-006. No direct DB/provider/browser-authoritative storage path was found.

## Constitution Check

- No contradiction with KISS/no overengineering: FT-006 uses one Store validation boundary and existing Medusa/Admin Shipping Options rather than a new tariff registry, delivery provider, queue, service, or custom admin.
- No contradiction with API -> Workflows -> Modules or no Medusa Core modification: reviewed implementation uses route -> workflow -> checkout helpers and standard Medusa boundaries.
- No contradiction with security/privacy/payment correctness: auth, checkout mutation, tariff truth, no order/payment success, and evidence privacy are explicitly specified and verified.
- No contradiction with tier/evidence rules: T3 TASK-047 and TASK-049 have PASS, semantic-pass, `HUMAN_CHECKPOINT: done`, and `ROLLBACK_RECOVERY_NOTE: present`; T2 TASK-046 and TASK-048 have functional PASS evidence and feature-level semantic-pass exists.

## Residual Risks

- LOW: Malformed JSON response normalization is intentionally deferred to standard Medusa parser behavior. This is documented and operator-approved, but future public API hardening should revisit it if uniform error envelopes become mandatory for parser-level failures.
- LOW: FT-006 depends on current Medusa auth middleware and Shipping Options projection shape. Future Medusa upgrades should rerun TASK-047/TASK-049 security and runtime gates.

VERDICT: APPROVE
