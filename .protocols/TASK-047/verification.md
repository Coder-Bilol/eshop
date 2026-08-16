---
description: Scheduler-owned functional verification evidence for TASK-047.
status: complete
---
# Verification — TASK-047

## What was verified

- Feature: FT-006 Checkout Delivery Methods.
- REQ IDs: REQ-013, REQ-014, REQ-015, REQ-016, REQ-017.
- Tier: T3.
- Mode: scheduler-owned, read-only functional verification.
- Current task status was preserved as `in_progress`; this pass did not close,
  fail, block, or promote any task.

## Verification basis

- Authoritative task index and record: `.memory-bank/tasks/index.json`,
  `.memory-bank/tasks/TASK-047.task.json`.
- Canonical packet: `.memory-bank/packets/TASK-047.packet.json`.
- Packet precondition: `status: ready`; raw task SHA-256 equals packet
  `source_task_hash` (`sha256:7925cc8f4842afc77e65d66ab6732be54283fa32ad9cf554486aba4686d62a23`).
- Protocol context: `.protocols/TASK-047/context.md`, `plan.md`,
  `progress.md`, and `handoff.md`.
- Normative FT-006 inputs: feature hub, tech spec, runtime architecture,
  checkout API/data/state contracts, auth-session security contract, API
  guidelines, testing strategy, and FT-006 planning/decision protocol.
- Operator decision applied: the standard Medusa body parser remains in use;
  malformed JSON parser-response normalization is deferred and is not a
  TASK-047 closure gate. No historical malformed-JSON FAIL was resurrected.

## Acceptance criteria checklist

- [x] Authenticated Medusa customer actor is required and client authority is
  rejected.
  - Method: real compiled Medusa HTTP matrix plus source inspection.
  - Command: `npm --workspace apps/backend run test:integration -- checkout-delivery`
  - Evidence: `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`
    and the fresh rerun output below.
  - Result: with a synthetic publishable key, guest returned `401
    checkout_auth_required`; synthetic customer bearer and Medusa session cookie
    returned `200`. A real request containing `customer_id` returned sanitized
    `400 checkout_invalid_request`. Successful public snapshots omitted
    `customer_id`. Production middleware still delegates to standard
    `authenticate("customer", ["session", "bearer"])`.

- [x] Input normalization, safe limits, required fields, conditional address,
  and optional comment are enforced.
  - Method: deterministic checkout smoke assertions and source inspection.
  - Command: `npm --workspace apps/backend run test:integration -- checkout-delivery`
  - Result: normalization precedes limits; normalized 120-character `name`
    succeeds while 121 characters returns `422 checkout_validation_failed` with
    `{fields:{name:"too_long"}}`; pickup succeeds without address; courier
    without address returns `422` with `{fields:{address:"required"}}`; comment
    is normalized and optional.
  - Evidence: `apps/backend/src/checkout/validation.ts:66-118`,
    `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`.

- [x] Only the stable delivery and payment IDs are accepted.
  - Method: deterministic integration smoke over all configured options and
    payment IDs.
  - Commands:
    - `npm --workspace apps/backend run test:integration -- checkout-delivery`
    - `npm --workspace apps/backend run test:integration -- checkout-delivery-options`
  - Result: delivery IDs are `pickup`, `city_courier`, `transport_company` in
    that order; payment IDs are `card`, `sbp`, `sberpay`; unsupported payment
    input is a sanitized `422 checkout_validation_failed`.
  - Evidence: fresh command output and
    `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`.

- [x] Current configured Admin/Shipping Options tariffs are used and unavailable
  options fail closed without substitution.
  - Method: sequential Admin/Shipping Options regression, checkout smoke, and
    deterministic tariff projection check.
  - Commands:
    - `npm --workspace apps/backend run test:integration -- checkout-delivery-options`
    - `npm --workspace apps/backend run test:integration -- checkout-delivery`
    - `node -r ts-node/register -e "...projectShippingOptionTariff invalid/valid assertions..."`
  - Result: Admin `type.code` plus linked Admin `price_set` produced `0/500/700
    RUB`; removing `transport_company` produced `available:false`, `tariff:null`,
    `fallback:false`; checkout returned `422 delivery_method_unavailable` with
    no substitution. Six invalid tariff configurations returned `null`, while a
    valid `50000` minor-unit RUB price projected successfully.
  - Evidence: `apps/backend/src/checkout/delivery-options.ts:42-124`,
    `apps/backend/src/checkout/delivery-tariffs.ts:32-77`, fresh command output,
    and `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`.

- [x] Success is a transient FT-007/FT-009 handoff and performs no order,
  inventory, payment, or provider mutation.
  - Method: compiled Medusa HTTP before/after counts, read-only container proxy,
    source mutation scan, and route/workflow inspection.
  - Command: `npm --workspace apps/backend run test:integration -- checkout-delivery`
  - Result: `orders`, `paymentCollections`, and `reservationItems` remained
    unchanged at `0 -> 0`; smoke reported `providerRequest:false`,
    `orderMutation:false`, `inventoryMutation:false`, and `paymentMutation:false`.
    The workflow only reads Shipping Options/price links and returns a transient
    snapshot plus selected payment ID.
  - Evidence: fresh compiled HTTP output, `apps/backend/src/api/store/checkout/route.ts:39-65`,
    `apps/backend/src/workflows/checkout/validate-checkout.ts:52-93`, and
    `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`.

- [x] Syntactically valid request/workflow errors are sanitized.
  - Method: real HTTP ownership rejection plus deterministic validation and
    unavailable-error assertions.
  - Result: public errors use `{error:{code,message,details}}`; no raw Medusa
    error, customer identity, token, credential, provider payload, or synthetic
    PII appeared in asserted error bodies. Malformed JSON parser behavior was
    intentionally not exercised because it is framework-owned and explicitly
    deferred by operator decision.
  - Evidence: `apps/backend/src/api/store/checkout/route.ts:87-180`,
    `apps/backend/src/api/middlewares.ts:48-103`, fresh smoke output, and
    `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`.

## Fresh deterministic evidence

The following checks were run during this verification pass:

| Check | Result |
|---|---|
| `npm --workspace apps/backend run test:integration -- checkout-delivery` | PASS; compiled Medusa HTTP route/middleware/route-loader/session/workflow/Admin boundary, guest/bearer/session matrix, ownership rejection, validation, sanitization, and no mutation. |
| `npm --workspace apps/backend run test:integration -- checkout-delivery-options` | PASS; Admin source, linked price-set tariffs, stable IDs/order, `0/500/700 RUB`, unavailable/no-fallback. |
| `npm --workspace apps/backend run typecheck` | PASS. |
| `node --check apps/backend/test/run-integration.cjs` | PASS. |
| `node scripts/mb-lint.mjs` | PASS (`131 files`). |
| `git diff --check` | PASS; only pre-existing line-ending warnings were emitted. |
| tariff fail-closed deterministic check | PASS; six invalid configurations rejected, valid RUB price accepted. |

The two integration suites were run sequentially because the local datastore
is shared; parallel execution is not valid evidence for these synthetic
fixtures.

## Regression / non-goals

- [x] Standard Medusa body parser remains production-owned; no route-scoped
  parser or malformed-JSON adapter was added. The only `express.json()` match is
  in the local smoke harness, not production middleware.
- [x] No Medusa Core, auth provider/session creation, downstream FT-007 order or
  inventory persistence, FT-009 provider integration, external delivery
  provider, production data, secret, credential, token, or real customer PII
  was touched or used.
- [x] Fixture cleanup is unconditional and failure-observable: all owned
  deletion attempts are tried, sanitized labels are recorded, and the smoke
  fails after the complete cleanup sequence if any deletion fails.
- [x] Session cleanup and compiled-server termination are attempted in `finally`
  paths; the real smoke completed cleanup successfully.
- [x] Runtime edits are within the refreshed packet scope. `delivery-options.ts`
  and `delivery-tariffs.ts` are the TASK-046 dependency source consumed by
  TASK-047, not a TASK-047 scope expansion.

## Quality gates evidence

- Backend typecheck: PASS.
- Integration/runtime: PASS on the real compiled Medusa HTTP matrix.
- Admin/Shipping Options regression: PASS.
- Memory Bank lint: PASS.
- Dispatcher syntax: PASS.
- Diff hygiene: PASS.
- Backend lint: unavailable; `apps/backend/package.json` has no `lint` script.
  This is a recorded unavailable gate, not a failed functional check.
- Existing implementation build evidence: PASS in
  `.tasks/TASK-047/TASK-047-S-execute-remediation-final-report-code-04.md`.

## T3 scheduler markers

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present

The scheduler recorded the closure checkpoint after the operator explicitly
confirmed the parser decision and instructed the orchestrator to update the
card and continue. Recovery is to restore the last reviewed TASK-047 runtime
patch without changing the standard Medusa parser, then rerun the sequential
checkout/options suites, typecheck, `mb-lint`, `/verify`, and `/red-verify`.

`/red-verify` was not run, per operator instruction. These pending scheduler
items do not invalidate this functional `/verify` PASS, but they prevent T3
closure eligibility in the scheduler until supplied together with the required
semantic pass.

## Verdict

VERDICT: PASS

## Scheduler recommendation

Keep `TASK-047` `in_progress`/closure-pending. Preserve the authoritative task
status, packet, and dependent tasks in this pass. Scheduler next steps are to
run the required per-task `/red-verify`, obtain the exact T3 markers above as
`done`/`present`, then decide closure and perform `/mb-sync`; this verifier does
not close, fail, block, promote, or synchronize task state.
