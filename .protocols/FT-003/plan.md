---
description: Planning protocol for FT-003 feature design and task decomposition.
status: complete
---
# FT-003 Planning Protocol

## Goal

Complete feature-level SDD for guest cart persistence and authenticated cart
merge, then produce an implementation plan, schema-backed tasks, and required
Execution Packets.

## Done Criteria

- Existing global specs are reused and no duplicate global architecture/API/state
  sources are created.
- Architecture, component, API, event, data boundary, persistence, state, and
  security/access areas are concrete or explicitly `not_applicable`.
- REQ-006, REQ-007, and REQ-008 are covered by executable task slices.
- Previous oversized merge and all-in-one verification tasks are split into
  bounded planning, lifecycle, API, UI, backend acceptance, and browser slices.
- Existing-target source soft-delete, journal-first replay, Store not-found, and
  restore compensation are present in tasks and packets.
- Every T2/T3 task has a canonical packet with a source task hash.
- Memory Bank lint passes and strict doctor is the next execution gate.

## Quality Gates

- `node scripts/mb-lint.mjs`
- schema/index/task/packet consistency
- required packet hash verification
- `/mb-doctor` before `/execute`

## Scope Notes

- Reuse Medusa 2.16 Cart Module, Store cart routes, core cart workflows, and
  PostgreSQL persistence.
- Add only the missing authenticated merge contract and durable idempotency
  journal.
- Use ten bounded TASK-017..TASK-026 slices across W1/W2/W3.
- Preserve existing user changes and the earlier FT-003 red-verification
  readiness report.
