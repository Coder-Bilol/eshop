---
description: Read-only functional verification report for TASK-047 after remediation.
status: complete
---
# TASK-047 Functional Verification Report

REVIEW_REPORT
- role: Reviewer
- task_id: TASK-047
- tier: T3
- mode: scheduler-read-only
- functional_verdict: FAIL
- findings:
  - HIGH: Malformed JSON does not use the required shared sanitized envelope. The
    standard body parser raises before `POST` can call `sendCheckoutError`; the
    installed Medusa error handler returns HTTP 500 with native `{code,type,message}`
    and message `An unknown error occurred.`, instead of the contract's HTTP 400
    `{error:{code,message,details}}` response for malformed JSON.
    - Evidence: `.memory-bank/contracts/checkout-delivery-api.md:63-81`,
      `.memory-bank/contracts/api-guidelines.md:38-66`,
      `node_modules/@medusajs/framework/dist/http/middlewares/bodyparser.js:14-22`,
      `node_modules/@medusajs/framework/dist/http/middlewares/error-handler.js:13-87`;
      compiled Express probe with body `{bad}` returned `500 {code:"unknown_error",type:"unknown_error",message:"An unknown error occurred."}`.
    - Required action: add a supported route-scoped parser/error mapping that
      preserves the standard customer auth boundary and returns sanitized 400
      checkout errors; add a real malformed-body assertion.
  - MEDIUM: The remediation smoke proves the authenticated handler path through a
    real local Express route with a synthetic Medusa session, while the bearer path
    was independently proven at the compiled standard middleware. A single actual
    Medusa server request carrying a session cookie or bearer token through the
    checkout handler was not captured.
    - Evidence: `apps/backend/src/scripts/smoke-checkout-delivery.ts:331-390`,
      compiled middleware probe returned customer session and customer bearer
      `next`, and rejected a user bearer; remediation report records only the local
      Express boundary.
    - Required action: after the parser fix, capture one real Medusa HTTP checkout
      request for the supported session/bearer path with synthetic data and the
      configured publishable-key boundary.
- evidence_checked:
  - Authoritative `.memory-bank/tasks/index.json`, `TASK-047.task.json`, and
    canonical `TASK-047.packet.json`; raw task SHA-256 matches packet
    `source_task_hash`, packet is `ready`, task tier is `T3`, and task remains
    `in_progress`.
  - Full current `.protocols/TASK-047/`, linked FT-006/auth/security/runtime,
    API/data/state/testing specs, implementation plan, remediation evidence, and
    prior functional/semantic reports.
  - `npm --workspace apps/backend run test:integration -- checkout-delivery-options`:
    PASS; Admin Shipping Options source, stable IDs, 0/500/700 RUB, and fail-closed
    unavailable projection.
  - `npm --workspace apps/backend run test:integration -- checkout-delivery`:
    PASS; remediated 401 envelope, session HTTP route, actor-derived ownership,
    normalization/limits, conditional address, payment IDs, unavailable 422,
    sanitized handler errors, cleanup failure handling, and no-mutation assertions.
  - `npm --workspace apps/backend run typecheck`: PASS; `node scripts/mb-lint.mjs`:
    PASS; `node --check apps/backend/test/run-integration.cjs`: PASS;
    `npm --workspace apps/backend run build`: PASS.
  - Source inspection confirms client identity/tariff/order/provider-payment fields
    are rejected, actor type is checked, Admin tariffs are read without fallback,
    and checkout route/workflow has no order, inventory, reservation, payment, or
    provider mutation boundary.
  - Cleanup inspection confirms every owned deletion is attempted, failures are
    recorded with sanitized labels, and the smoke fails after all attempts.
- satisfied_scope:
  - Previous auth-envelope defect: fixed for native unauthenticated middleware 401;
    real local HTTP smoke returns `401 checkout_auth_required`.
  - Actor ownership: session customer and bearer customer contexts are accepted by
    standard middleware; wrong actor and client-selected identity are rejected.
  - Normalization, limits, conditional address, stable options/payment IDs, Admin
    tariffs, unavailable recovery, sanitized route errors, privacy, and mutation
    isolation: PASS in fresh sequential smoke evidence.
- risks_or_questions:
  - Backend-specific lint is unavailable because `apps/backend/package.json` has
    no `lint` script; this is not the functional blocker.
  - Evidence is synthetic/local only and contains no production data, credentials,
    tokens, provider payloads, or real customer PII.
- marker_status:
  - HUMAN_CHECKPOINT: pending
  - ROLLBACK_RECOVERY_NOTE: pending
- scheduler_recommendation: Keep TASK-047 `in_progress`; do not mark done, promote
  dependents, or run `/mb-sync`. Resolve the malformed-JSON envelope defect, add
  the requested full runtime evidence, then rerun both verification passes.

VERDICT: FAIL
