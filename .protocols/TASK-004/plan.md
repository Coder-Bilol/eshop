# TASK-004 Plan

## Implementation Plan

1. Add `.memory-bank/runbooks/local-development.md` with Windows setup, start, smoke, stop, port conflict, and explicit local-only reset behavior.
2. Update `smoke:local` output so it points developers and agents to the runbook and evidence location.
3. Add a README pointer to the durable runbook.
4. Record Memory Bank changelog entry for the runbook/smoke handoff.
5. Run packet gates and store execution evidence under `.tasks/TASK-004/`.

## Intended Local Gates

- `npm run smoke:local`
- `npm run check:local-env`
- `node scripts/mb-lint.mjs`
- `node --check scripts/smoke-local.cjs`
- runbook coverage check for required sections

## MB-SYNC Handoff

`/execute` does not close `TASK-004`. After `/verify TASK-004` passes and closure ownership is explicit, `/mb-sync` should reconcile task state, changelog, and queue readiness.
