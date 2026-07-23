# Production Deployment Handoff

Last verified: 2026-07-23

## Scope Status

The PostgreSQL deployment phase is complete. The full application deployment is
not complete.

- PostgreSQL is running and healthy on the production VPS.
- Medusa migrations are applied and an idempotent second run succeeded.
- Backend and storefront application services are not running.
- Region creation and catalog seed were not run.
- No production application traffic is enabled yet.

Use [DEPLOYMENT.md](DEPLOYMENT.md) as the authoritative runbook. This file is the
current-session handoff and records the exact state from which work should
continue.

## VPS Snapshot

```text
Host:              79.133.183.183
Deployment user:   eshop
Repository:        /opt/eshop/app
Server commit:     5a47a9d (clean checkout)
Secrets directory: /opt/eshop/secrets
Compose file:      /opt/eshop/app/compose.production.yml
```

Current Docker state:

| Item | Verified state |
|---|---|
| PostgreSQL container | `eshop-postgres-1`, running, healthy, zero restarts |
| PostgreSQL image | `postgres:16.10-alpine` |
| Host port | None; `5432/tcp` exists only inside Docker |
| Data storage | Named volume `eshop_postgres_data` mounted at `/var/lib/postgresql/data` |
| Compose network | `eshop_default` |
| Database | `eshop`, accepts connections |
| Schema | 141 public tables, including the custom `cart_merge` table |
| Backend service | Not created or started |
| Storefront service | Not created or started |
| Temporary migration containers | Removed |

Existing application images:

```text
eshop-backend:production
sha256:d82b18f754ad59b42319eb2c2f5e74b7131edf34ea7255ad5e7e671041c55017

eshop-storefront:production
sha256:f3cbb5523708b96404e1d10eaa6bf089fcb391f5bf721bc1adae93edc808081a
```

The current backend image predates the repository `ssl=false` fix. Do not start
it as the production backend.

## Completed Work

1. Validated `compose.production.yml`: PostgreSQL has a healthcheck, no `ports`
   section, and uses a named volume.
2. Confirmed production env files exist under `/opt/eshop/secrets` with mode
   `600`; no secret value is included in this handoff.
3. Started only the PostgreSQL Compose service.
4. Confirmed PostgreSQL is healthy and accepts connections.
5. Ran Medusa core, custom `cartMerge`, link-table, and migration-script
   migrations.
6. Ran the full migration command a second time; it exited successfully with the
   schema already up to date.
7. Verified 141 public tables. Region and product counts remain zero because
   region creation and catalog seed were intentionally not run.
8. Removed all one-off migration containers while preserving PostgreSQL and its
   named volume.

HUMAN_CHECKPOINT: done

ROLLBACK_RECOVERY_NOTE: present

This was an empty first-deployment database. Failed migration attempts preserved
the named volume and were retried idempotently. No destructive volume operation,
region creation, catalog seed, or migration rollback was used.

## Migration Findings

Two issues were diagnosed during the first migration:

1. The normal backend heap limit of `256 MB` is too small for the Medusa migration
   CLI on this VPS. Migration-only containers must override it with
   `NODE_OPTIONS=--max-old-space-size=768`.
2. Medusa 2.16 creates a separate migration-lock database connection. With the
   Docker hostname `postgres`, it attempted SSL against the internal PostgreSQL
   service, where TLS is not enabled, and waited indefinitely.

The repository fix is in `apps/backend/medusa-config.ts`:

```ts
databaseDriverOptions: {
  connection: {
    ssl: false,
  },
},
```

The successful first migration used the same option as a temporary one-off
runtime override because the existing backend image did not contain the fix.
Future migrations must use a rebuilt image containing the committed setting.

## Local Repository State

Deployment-related local changes awaiting a dedicated commit:

```text
DEPLOYMENT.md
DEPLOYMENT_process.md
DEPLOYMENT_HANDOFF.md
apps/backend/medusa-config.ts
.memory-bank/changelog.md (deployment hunk only)
```

The worktree also contains unrelated in-progress `TASK-032` changes. Do not stage
or commit the entire worktree as one deployment commit.

No `*.env` file is tracked by Git. Real production values remain only under
`/opt/eshop/secrets` on the VPS.

## Verification Evidence

```text
container state: running
health status: healthy
restart count: 0
published PostgreSQL host port: none
pg_isready: accepting connections
database name: eshop
public table count: 141
named volume: eshop_postgres_data
```

Local checks passed:

```text
npm --workspace apps/backend run typecheck
node scripts/mb-lint.mjs
git diff --check
git ls-files -- '*.env'  # no output
```

## Current Blocker

The VPS backend image must be rebuilt from a committed revision containing the
explicit internal PostgreSQL `ssl=false` configuration. Until then, do not start
the backend application service. This does not block PostgreSQL.

The storefront image contains fake public Medusa values. It must be rebuilt only
after the initial region and verified catalog seed provide real values.

## Next Safe Sequence

1. Commit and push only the intended deployment changes.
2. Fast-forward `/opt/eshop/app` to that exact commit.
3. Rebuild only `eshop-backend:production` under live `sar` monitoring.
4. Run the documented migration command with the rebuilt image and confirm that
   the database is already up to date.
5. Start the backend only after a separate explicit deployment step.
6. Create the initial region, run catalog seed, replace storefront public values,
   rebuild storefront, and start it as later steps.

## Safety Rules

- Never run `docker compose down -v`.
- Never delete `eshop_postgres_data` as a migration recovery action.
- Never expose PostgreSQL through a host `ports` mapping.
- Never use region creation or catalog seed to recover a failed migration.
- Keep PostgreSQL running while rebuilding application images.
- Back up the database before every later migration or application update.
- A code or image rollback does not reverse an applied database migration.
- Do not start the old backend image that lacks the SSL setting.

## Read-Only Resume Checks

```bash
git -C /opt/eshop/app status --short
git -C /opt/eshop/app rev-parse --short HEAD
docker compose -f /opt/eshop/app/compose.production.yml ps --all
docker compose -f /opt/eshop/app/compose.production.yml \
  exec -T postgres pg_isready -U eshop -d eshop
docker inspect --format \
  '{{.State.Status}} {{.State.Health.Status}} {{json .NetworkSettings.Ports}}' \
  eshop-postgres-1
```
