# TASK-MB-REVIEW Request

## Scope

Final scheduler review after TASK-001 through TASK-053 reached `done`, FT-007
feature red-verify returned `semantic-pass`, and `/mb-sync` reconciled durable
state.

## Mode

- Autopilot scheduler terminal gate.
- Fresh-context stages S-01 through S-05.
- No task implementation or lifecycle mutation is authorized during review.

## Inputs

- Governing Constitution, MBB index, spec backbone/index, architecture/contracts/states/testing.
- PRD, requirements RTM, epics/features, implementation plans.
- Indexed JSON task queue and canonical packets.
- TASK-052/TASK-053 functional, semantic, browser/backend, cleanup, sync, and FT-007 feature-review evidence.
- Current `mb-lint` and strict `mb-doctor` results.

## Blocking concerns

- Constitution, architecture, security, privacy, or public-contract contradiction.
- RTM/lifecycle drift, especially FT-007 verified versus EP-003 planned for FT-008.
- Non-terminal/malformed queue, stale required packet, unresolved semantic concern, missing T3 closure evidence, or unsafe dependency status.
- Broken links/frontmatter/router/spec routing or operational artifacts represented as durable source of truth.
- Open P0/P1 issue or any reviewer `REJECT`.

## Expected result

Each stage writes `TASK-MB-REVIEW-S-0X-final-report-docs-02.md` with exact
`VERDICT: APPROVE` or `VERDICT: REJECT`. Final aggregation requires every stage
to approve before autopilot can declare `SUCCESS`.
