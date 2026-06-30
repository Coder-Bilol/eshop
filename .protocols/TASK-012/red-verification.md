---
description: TASK-012 adversarial semantic verification.
status: active
---
# TASK-012 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Top Substance Risks
- Helper tests pass happy path but allow ambiguous/impossible combinations.
- Helper silently turns product detail pre-check into final stock authority.
- T1 local helper changes backend contract semantics.

## False-Success / Purpose Fit
Evidence covers missing, impossible, ambiguous, unavailable, valid, single/default SKU, and multi-variant-one-sellable cases. That directly targets the semantic risk of accepting an invalid SKU.

## Anti-Goal And Scope Assessment
No backend contract change, durable cart, or cart merge behavior was introduced.

## Weak Context Questions
- Helper operates on contract-shaped fixtures; browser proof is provided later by TASK-013/TASK-014.

## Hidden Assumptions
- `requires_selection` and option dimensions from backend are trusted as product detail contract inputs.

## Cross-Boundary Impact
Positive local guard for storefront behavior; no cross-boundary drift.

## Architectural Concerns
No drift.

## State/Data Consistency Concerns
No durable state. Availability is used only to block local handoff.

## Operational Concerns
None significant.

## Future Maintenance Cost
Low. Pure helper is easy to test and maintain.

## How This Could Still Be Wrong
If backend sends new option semantics, helper tests must be extended.

## Counterproposal / Escalation Path
No replan.
