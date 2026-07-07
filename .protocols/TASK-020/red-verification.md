---
description: TASK-020 adversarial semantic verification.
status: complete
---
# TASK-020 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Scope

- Task: `TASK-020`
- Tier: `T3`
- Mode: manual per-task `/red-verify`
- Verified at: `2026-07-07`
- Functional `/verify`: PASS on 2026-07-07 after duplicate target-line repair
- Task status change: none; `/red-verify` does not close this T3 task.

## Top Substance Risks

No blocking substance risks remain for TASK-020 after the duplicate target-line
repair.

Previously found risk:

- TASK-019 and the SDD aggregate target lines by `variant_id`, while the earlier
  TASK-020 lifecycle rejected duplicate target same-variant lines.

Current resolution:

- TASK-020 now validates target before-state by aggregate Product Variant ID
  quantity plus planned anchor-line presence.
- Lifecycle evidence creates duplicate target same-variant lines through Medusa
  `addToCartWorkflow`, proves post-soft-delete failure compensation restores the
  aggregate target state, and proves successful merge reaches exact final
  aggregate quantity.

## False-Success / Purpose Fit Assessment

The implementation now serves TASK-020's purpose: a planned merge either commits
exact target quantities with the source consumed or restores both carts to their
pre-merge state.

The latest lifecycle evidence covers the prior false-success risk:

- `targetDuplicateVariantLinesMerged: true`
- exact aggregate target quantity after duplicate-line merge
- aggregate target quantity restored during compensation
- pricing/tax/promotion totals matching a reference Medusa workflow cart

## Anti-Goal And Scope Assessment

- No Store merge route was added; TASK-021 owns HTTP/auth.
- No OAuth, checkout, order, inventory reservation, payment, production data, or
  provider integration was added.
- No Medusa Core/table modification was found.
- Runtime source disposition uses `softDeleteCarts`; source hard-delete and
  source line clearing were not found.
- Target mutation remains inside Medusa core `addToCartWorkflow` plus forced
  `refreshCartItemsWorkflow`.

## Weak-Context Questions

No weak-context question blocks this task-level semantic verdict.

Feature-level questions remain outside TASK-020:

- TASK-021 must still prove authenticated route ownership, journal-first replay,
  stable errors, and concurrency responses.
- Later FT-003 acceptance tasks must prove browser/storefront integration.

## Hidden Assumptions

- Medusa `addToCartWorkflow` compensation remains the supported mechanism for
  reversing target mutations.
- The immutable TASK-019 plan is the only input to this lifecycle; HTTP actor
  derivation and replay are TASK-021 scope.

Both assumptions are consistent with the linked task split and verified evidence.

## Cross-Boundary Impact

- TASK-019 -> TASK-020 contract is now coherent: both use aggregate
  `variant_id` quantities for same-variant source/target lines.
- TASK-020 -> TASK-021 handoff is safe at lifecycle level: route/API work can
  call a workflow that handles duplicate target variant lines, source
  soft-delete, restore-first compensation, and exact aggregate quantities.
- FT-003 remains incomplete until downstream API, UI, handoff, and acceptance
  tasks pass.

## Architectural Concerns

No architectural drift found:

- no new service, queue, cache, or deployment unit;
- no duplicate cart CRUD API;
- no direct storefront/database boundary;
- API -> Workflow -> Module direction is preserved.

## State/Data Consistency Concerns

No blocking state/data concerns found:

- source and target are revalidated under sorted locks;
- target quantities are asserted after core workflow mutation;
- source is soft-deleted only after target mutation;
- failure after source soft-delete restores the source before target
  compensation;
- failed immutable plan retry completes without double-counting;
- stock conflict leaves both carts active and unchanged.

## Operational Concerns

- Current lock behavior is acceptable: Medusa `acquireLockStep` has compensation
  release, and the explicit release step exists on success.
- No production data, secrets, or irreversible migration is introduced by
  TASK-020.
- `ROLLBACK_RECOVERY_NOTE: present` is credible and points to concrete automatic
  and manual recovery boundaries.
- At red-verification time, `HUMAN_CHECKPOINT: done` was still absent, so final
  T3 closure was not allowed yet even though the semantic gate passed.

## Future Maintenance Cost

The repair reduces maintenance cost by making planner and lifecycle semantics
consistent. The remaining complexity is justified by current T3 requirements:
exact quantities, soft-delete source disposition, restore-first compensation,
retry safety, and core workflow pricing/tax/promotion refresh.

## How This Could Still Be Wrong

- A future Medusa version could change `addToCartWorkflow` duplicate-line or
  compensation semantics. Current evidence is valid for the installed Medusa
  runtime and should be protected by the TASK-020 lifecycle integration suite.
- TASK-021 could still wrap this lifecycle incorrectly at the HTTP/auth boundary;
  that is outside TASK-020 and must be verified separately.

## Counterproposal / Escalation Path

No TASK-020 rework is recommended.

Closure follow-up completed during manual `/mb-sync`:

HUMAN_CHECKPOINT: done

TASK-020 was closed as `done` by `GENERAL` after explicit user instruction on
2026-07-07. No dependent task was promoted by this red-verification or sync.
