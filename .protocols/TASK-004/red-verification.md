---
description: TASK-004 adversarial semantic verification.
status: active
---
# TASK-004 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Top Substance Risks
- Smoke script claims local readiness without exercising backend persistence.
- Runbook normalizes destructive reset or production-like behavior.
- Later tasks overtrust smoke as proof of every feature boundary.

## False-Success / Purpose Fit
The smoke path verifies local env, backend migrate/seed, backend DB read/write smoke, backend typecheck, and storefront typecheck. The runbook documents setup/start/smoke/stop/port conflicts and local-only reset behavior. This fits TASK-004.

## Anti-Goal And Scope Assessment
Anti-goals hold: no live providers, no default destructive reset, no Docker local runtime, and no production credentials.

## Weak Context Questions
- Smoke does not start the full HTTP storefront/backend flow; this is acceptable because TASK-004 is local foundation, not feature E2E.

## Hidden Assumptions
- Feature tasks add their own HTTP/browser checks when needed.

## Cross-Boundary Impact
Positive: later tasks can use `smoke:local` as a base gate without claiming feature correctness.

## Architectural Concerns
No drift from KISS/local Windows-native architecture.

## State/Data Consistency Concerns
Local seed/read-write smoke is non-production and preserves data by default.

## Operational Concerns
Runbook covers local troubleshooting and warns against normal destructive reset.

## Future Maintenance Cost
Low. Smoke composition is transparent and easy to extend.

## How This Could Still Be Wrong
If teams start treating `smoke:local` alone as proof of business workflows, this would be false confidence. Existing task gates avoid that.

## Counterproposal / Escalation Path
No replan. Keep feature-level integration/e2e gates separate.
