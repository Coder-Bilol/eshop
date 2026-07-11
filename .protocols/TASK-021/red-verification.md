---
description: TASK-021 adversarial semantic verification.
status: complete
---
# TASK-021 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Scope

- Task: `TASK-021`
- Tier: `T3`
- Mode: manual per-task `/red-verify`
- Verified at: `2026-07-08`
- Functional `/verify`: PASS on 2026-07-08
- Task status change: none; `/red-verify` does not close this T3 task.

## Top Substance Risks

No blocking substance risks remain for TASK-021.

Hostile risks checked:

- route could accept client-selected customer or destination;
- route could replay a consumed source before checking journal ownership;
- route could require consumed source retrieval before replay and therefore
  duplicate or lose merge state;
- route could expose foreign cart details through errors;
- route could mutate carts directly instead of delegating to the TASK-019 and
  TASK-020 boundaries;
- local tests could pass while the implementation violates FT-003 anti-goals.

Current evidence does not support those failures.

## False-Success / Purpose Fit Assessment

TASK-021's purpose is to expose the security-sensitive HTTP boundary around the
completed merge lifecycle. The implementation fits that purpose:

- `POST /store/carts/:id/merge` is registered behind customer authentication
  middleware.
- The source cart ID is path-derived.
- The authenticated customer ID is read from Medusa auth context.
- The request body must be empty; client `target_cart_id`, `customer_id`, and
  other authority fields are rejected.
- Completed journal replay is resolved before source-cart retrieval and checks
  `journal.customer_id` against the current actor before returning the target.
- Non-replay mutation goes through TASK-019 planning and TASK-020 lifecycle.

The latest `cart-merge-api` integration evidence covers transfer, merge,
journal-first replay, no duplicate replay, foreign replay denial, pending
journal in-progress response, and stock conflict no-mutation behavior.

## Anti-Goal And Scope Assessment

- OAuth providers or login UI: not implemented.
- Duplicate Store cart CRUD facade: not added.
- Client-selected destination/customer: rejected by strict empty-body
  validation and absent from planning inputs.
- Storefront behavior: not touched.
- Medusa Core modification: not touched.
- Production data/secrets: not used.
- Runtime route files contain no direct cart line mutation, source soft-delete,
  restore, hard-delete, or source-clear operation.

## Weak-Context Questions

No weak-context question blocks this task-level semantic verdict.

Non-blocking follow-up boundaries:

- TASK-024/TASK-026 still need to prove storefront handoff/reference switching.
- FT-004 owns live OAuth/provider callback integration.
- Full HTTP-server session/cookie/CSRF behavior is downstream auth integration
  work; TASK-021 proves the route contract with Medusa customer-auth middleware
  registration and synthetic actor context.

## Hidden Assumptions

- Medusa `authenticate("customer", ["session", "bearer"])` remains the correct
  customer-auth middleware for this Store route.
- Medusa route discovery continues to resolve
  `apps/backend/src/api/store/carts/[id]/merge/route.ts` as
  `/store/carts/:id/merge`.
- TASK-020 lifecycle remains the owner of target mutation, source disposition,
  compensation, and immutable journal completion.

These assumptions are consistent with the linked task split and current
integration evidence.

## Cross-Boundary Impact

- TASK-019 -> TASK-021: planning remains actor-scoped and destination is
  backend-selected.
- TASK-020 -> TASK-021: lifecycle is reused instead of reimplemented at the
  route layer.
- TASK-021 -> TASK-024/TASK-026: response outcomes and stable errors are
  suitable for frontend handoff and final acceptance, but those downstream
  tasks still need their own evidence.
- FT-003 remains incomplete until the remaining cart state/UI/handoff and
  acceptance tasks pass.

## Architectural Concerns

No architectural drift found:

- no new service, queue, cache, broker, deployment unit, or custom event
  contract;
- no Store cart CRUD duplication;
- no direct storefront/database boundary;
- no Medusa Core/table modification;
- API -> Workflow -> Module direction is preserved.

## State/Data Consistency Concerns

No blocking state/data concern found:

- replay reads the completed journal before source retrieval;
- replay validates the journal customer before target retrieval/return;
- replay returns `already_merged` without re-entering mutation;
- pending journal returns `cart_merge_in_progress`;
- stock conflict leaves source and target quantities unchanged;
- source soft-delete/restore and target mutation remain owned by TASK-020;
- no route-level hard-delete, source clearing, or cart-line mutation was found.

## Operational Concerns

ROLLBACK_RECOVERY_NOTE: present

HUMAN_CHECKPOINT: done

- The rollback/recovery note is credible: TASK-021 adds only the API boundary
  and smoke coverage; disabling the route leaves existing TASK-020 journal/cart
  recovery semantics intact.
- The local evidence uses the installed Medusa runtime with PostgreSQL-backed
  carts/journals.
- Local logs show the in-memory locking module; production lock-provider
  behavior should remain covered by later production/deploy work, not by this
  task.
- The exact human checkpoint marker was recorded during manual closure sync.

## Future Maintenance Cost

The implementation keeps maintenance cost bounded:

- the route is thin and delegates domain logic to planning/workflow layers;
- stable public errors are centralized in the route;
- strict empty-body validation avoids a future public API surface for
  destination/customer selection;
- the direct handler integration test is intentionally narrow but exercises the
  key boundary semantics without introducing live OAuth/provider dependencies.

## How This Could Still Be Wrong

- A future Medusa auth API change could alter where customer actor identity is
  stored on the request. Typecheck and future route tests should catch this.
- A production lock provider could surface lock timeouts differently from the
  local in-memory path; final deploy/runtime work should verify production lock
  behavior if this route is deployed.
- TASK-024/TASK-026 could still mishandle frontend reference switching or error
  recovery even though TASK-021's backend boundary is semantically sound.

## Counterproposal / Escalation Path

No TASK-021 rework is recommended.

Closure follow-up completed during manual `/mb-sync`:

TASK-021 was closed as `done` by `GENERAL` after explicit user approval on
2026-07-09. No dependent task was promoted by this red-verification or sync.
