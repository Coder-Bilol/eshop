---
description: Scheduler-mode functional verification report for TASK-047.
status: complete
---
# TASK-047 Functional Verification Report

REVIEW_REPORT
- role: Reviewer
- task_id: TASK-047
- tier: T3
- mode: scheduler
- functional_verdict: FAIL
- findings:
  - HIGH: The standard Medusa authentication middleware short-circuits an unauthenticated POST before the route handler and returns `{"message":"Unauthorized"}`. The FT-006 contract requires the shared `{error:{code,message,details}}` envelope and stable `checkout_auth_required` for HTTP 401. The direct route smoke does not observe this middleware response.
    - Evidence: `apps/backend/src/api/middlewares.ts:68-71`; runtime middleware probe with no session/bearer; `.memory-bank/contracts/checkout-delivery-api.md:63-81`.
    - Required action: add a supported route/framework response mapping that preserves standard customer authentication while returning the checkout sanitized envelope, then verify it through the real middleware boundary.
  - MEDIUM: The integration smoke calls `POST` directly and injects `auth_context`; it statically checks middleware registration but does not execute a request through the route matcher and standard middleware with a real session/bearer. The authenticated actor and handler are therefore tested separately, not as one HTTP boundary.
    - Evidence: `apps/backend/src/scripts/smoke-checkout-delivery.ts:348-363`, `:376-394`.
    - Required action: add a through-middleware authenticated/unauthenticated request assertion or provide equivalent framework-level evidence.
  - MEDIUM: Smoke fixture cleanup suppresses every cleanup failure with `catch(() => undefined)`. A failed cleanup can leave duplicate stable Shipping Options, service zones, stock locations, or synthetic customers and contaminate later tariff-availability evidence.
    - Evidence: `apps/backend/src/scripts/smoke-checkout-delivery.ts:313-330`.
    - Required action: make cleanup failures observable and add deterministic recovery/cleanup verification before accepting the integration evidence.
- evidence_checked:
  - `.memory-bank/tasks/index.json`, `.memory-bank/tasks/TASK-047.task.json`, and `.memory-bank/packets/TASK-047.packet.json`; packet hash was independently recomputed and matched, packet status is `ready`, task tier is `T3`, task status remains `in_progress`.
  - Full `.protocols/TASK-047/` context, plan, progress, local gate record, and handoff; prior execute STOP_REPORT and final execute evidence.
  - Linked FT-006 feature, runtime, API, data, validation-state, auth-session-security, API-guidelines, testing, and implementation-plan specs.
  - `npm --workspace apps/backend run test:integration -- checkout-delivery` -> PASS with synthetic validation, tariff, unavailable-method, error, and no-mutation assertions.
  - `npm --workspace apps/backend run test:integration -- checkout-delivery-options` -> PASS with Admin Shipping Options, linked price-set, stable-ID/order, tariff, and no-fallback assertions.
  - `npm --workspace apps/backend run typecheck` -> PASS; `node scripts/mb-lint.mjs` -> PASS; `git diff --check` -> PASS.
  - Source inspection confirms actor-derived workflow ownership, input allowlisting, normalization before limits, conditional address, stable payment IDs, Admin tariff resolution, sanitized route errors, and no order/inventory/payment/provider mutation calls in the route/workflow.
  - Runtime standard Medusa middleware probe: no auth -> HTTP 401 native `message` body; valid customer bearer -> `next` with customer actor context; non-customer actor -> HTTP 401.
- risks_or_questions:
  - Parser-level malformed JSON handling was not independently proven against the shared checkout error envelope.
  - Backend lint is unavailable because `apps/backend/package.json` has no lint script; this is not the functional blocker.
  - Evidence is synthetic/local only; no production data, credentials, tokens, provider payloads, or real customer PII were used.
- marker_status:
  - HUMAN_CHECKPOINT: pending
  - ROLLBACK_RECOVERY_NOTE: pending
- scheduler_recommendation: Keep TASK-047 `in_progress`; do not mark done, promote dependents, or run `/mb-sync`. Resolve the HIGH finding and the evidence/cleanup findings, rerun functional verification, and require a passing per-task semantic review before T3 closure.

VERDICT: FAIL
