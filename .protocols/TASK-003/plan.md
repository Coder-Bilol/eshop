# TASK-003 Plan

## Implementation Plan

1. Add root local runtime npm scripts:
   - `check:local-env`
   - `dev:local`
   - `dev:local:check`
   - `dev:local:watch`
   - `smoke:local`
2. Add Windows-native local runtime helper scripts under `scripts/**`.
3. Add root and storefront `.env.example` templates and extend backend `.env.example` with local-only placeholder provider settings.
4. Make `.gitignore` explicitly ignore real root/app `.env` files while keeping `.env.example` templates trackable.
5. Update README with Windows-native local development commands and Docker boundary.
6. Run packet gates and record evidence under `.tasks/TASK-003/`.

## Intended Local Gates

- `npm run check:local-env`
- `npm run dev:local`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`
- `node --check` for new runtime scripts
- `git check-ignore .env apps/backend/.env apps/storefront/.env`

## MB-SYNC Handoff

`/execute` does not own closure or `/mb-sync`. After `/verify TASK-003` passes and the closure owner updates task status, `/mb-sync` should record the completed Windows-native local runtime work in Memory Bank/changelog as needed.
