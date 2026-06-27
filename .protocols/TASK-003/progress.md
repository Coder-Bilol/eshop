# TASK-003 Progress

## Changes Made

- Added root local runtime scripts in `package.json`.
- Added `.env.example` with local-only root runtime defaults and provider placeholders.
- Added `apps/storefront/.env.example`.
- Extended `apps/backend/.env.example` with `PORT` and local-only OAuth/YooKassa/email placeholders.
- Extended `.gitignore` so root and app real `.env` files are ignored while `.env.example` remains trackable.
- Added `scripts/local-runtime.cjs` shared runtime helper.
- Added `scripts/check-local-env.cjs` for Windows/npm/PostgreSQL/env/gitignore preflight.
- Added `scripts/dev-local.cjs` for bounded non-interactive startup check and interactive watch mode.
- Added `scripts/smoke-local.cjs` for local PostgreSQL/backend/storefront smoke verification.
- Updated `README.md` with Windows-native local development commands and Docker boundary.

## Implementation Notes

- `npm run dev:local` runs a bounded startup check in non-interactive contexts so automated evidence does not hang.
- `npm run dev:local:watch` starts backend and storefront npm processes for interactive local development.
- PostgreSQL is verified through backend `db:check` and `smoke:db`; no Docker command is used.
- Real provider settings are placeholders and are not wired into live integration behavior.

## Scope Check

- Scope compliance: yes.
- Forbidden scope touched: no.
- Remote server deployment files added: no.
- Docker/Compose local runtime added: no.
- Real secrets added: no.
- Live provider integration behavior added: no.
