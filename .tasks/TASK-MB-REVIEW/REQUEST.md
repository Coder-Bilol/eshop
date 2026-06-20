# TASK-MB-REVIEW Request

## Scope

Review Memory Bank after `/prd` decomposition and before mandatory `/spec-design`.

## Mode

- Interactive/manual flow.
- High-risk product surface due to auth, payments, payment webhooks, order lifecycle, inventory reservation, customer data, and compliance risk.

## Review Inputs

- `.memory-bank/constitution.md`
- `.memory-bank/prd.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/product.md`
- `.memory-bank/requirements.md`
- `.memory-bank/epics/`
- `.memory-bank/features/`
- `.memory-bank/contracts/boundary-map.md`
- `.memory-bank/states/lifecycle-map.md`
- `.memory-bank/domains/core-domain.md`
- `.memory-bank/invariants.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/index.json`

## Blocking Concerns To Check

- Constitution contradictions.
- Broken PRD -> REQ -> EP -> FT traceability.
- Missing mandatory `/spec-design` gate or feature SDD gate notes.
- Misleading task/autonomous readiness before `/spec-design`.
- Security/privacy/payment correctness gaps that should block progression to design.
- MBB/frontmatter/link/router issues.

## Expected Output

Each reviewer writes:

`.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-<STAGE_ID>-final-report-docs-01.md`

with `VERDICT: APPROVE` or `VERDICT: REJECT`.
