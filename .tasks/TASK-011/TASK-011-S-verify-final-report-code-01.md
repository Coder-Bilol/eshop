---
description: TASK-011 functional verification report.
status: active
---
# TASK-011 Verification Report

## Verdict

VERDICT: FAIL

- Mode: manual `/verify`
- Closure owner: `GENERAL`
- Task status written: no
- Recommended next status: `failed` or keep closure pending until the defect is fixed and `/verify TASK-011` passes.

## Passed Checks

- Required packet is usable and matched the task before verdict recording.
- Packet source hash was refreshed after verdict recording; final strict doctor passes.
- Full T2 protocol and linked authoritative SDD specs are present.
- `npm --workspace apps/backend run test:integration -- product-detail`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- Thin read-only facade is backend/PostgreSQL-backed and does not create cart, order, payment, auth, or inventory-reservation state.

## Failed Acceptance Check

The implementation derives default selection from `sellableVariants.length === 1`.
For a product with multiple backend-known variants where only one is currently
sellable, it sets `requires_selection: false` and auto-selects that SKU.

FT-002 allows automatic default selection only for a product without variants or
with one default variant. A multi-variant product must retain explicit selection
semantics even when only one variant is currently sellable.

## Evidence

- `.tasks/TASK-011/verify-mb-doctor-strict.txt`
- `.tasks/TASK-011/verify-backend-product-detail-integration.txt`
- `.tasks/TASK-011/verify-backend-typecheck.txt`
- `.tasks/TASK-011/verify-mb-lint.txt`
- `.tasks/TASK-011/verify-multi-variant-one-sellable.txt`
- `.memory-bank/bugs/TASK-011-multi-variant-default-selection.md`

## Required Fix

Base automatic default selection on the product having exactly one concrete
variant/default SKU, not on there being exactly one currently sellable variant.
Add an integration case with multiple variants where only one is sellable, then
rerun `/verify TASK-011`.
