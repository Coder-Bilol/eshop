# Production Deployment Handoff

Last verified: 2026-07-23

## Scope Status

The PostgreSQL deployment phase is complete. The full application deployment is
not complete.

- PostgreSQL is running and healthy on the production VPS.
- Medusa migrations are applied and an idempotent second run succeeded.
- Backend image was rebuilt successfully from revision `99b92f4`.
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
Image source commit: 99b92f4 (clean checkout during build)
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
sha256:89684d39af06a2d913940a5d212318fdaa9e2470aa8740de86ef9c113d399927

eshop-backend:pre-99b92f4
sha256:d82b18f754ad59b42319eb2c2f5e74b7131edf34ea7255ad5e7e671041c55017

eshop-storefront:production
sha256:f3cbb5523708b96404e1d10eaa6bf089fcb391f5bf721bc1adae93edc808081a
```

The production backend image is `linux/amd64`, carries OCI revision label
`99b92f4`, and contains the repository `ssl=false` fix. The `pre-99b92f4`
rollback image predates that fix.

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
9. Committed and pushed the database/deployment fix as `99b92f4`, then
   fast-forwarded the clean VPS checkout to that revision.
10. Preserved the previous backend image under `eshop-backend:pre-99b92f4`.
11. Rebuilt `eshop-backend:production` successfully through BuildKit and verified
    its image ID, platform, revision label, and completed export log.

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
runtime override because the old backend image did not contain the fix. The new
production image contains the committed setting and must be used for the next
idempotency check and subsequent application start.

## Local Repository State

Deployment configuration commit `99b92f4` is pushed to `origin/main` and was the
source revision for the successful backend image build. This post-build
documentation update records the result separately.

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
backend image: sha256:89684d39af06a2d913940a5d212318fdaa9e2470aa8740de86ef9c113d399927
backend platform: linux/amd64
backend revision label: 99b92f4
old backend image: eshop-backend:pre-99b92f4
backend/storefront containers: not created or started
```

Local checks passed:

```text
npm --workspace apps/backend run typecheck
node scripts/mb-lint.mjs
git diff --check
git ls-files -- '*.env'  # no output
```

## Remaining Blockers

Before starting the backend service, run the documented migration command once
with the rebuilt image and confirm that the existing schema is already up to
date. The backend image rebuild itself is no longer a blocker.

The storefront image contains fake public Medusa values. It must be rebuilt only
after the initial region and verified catalog seed provide real values.

## Next Safe Sequence

1. Run the documented migration command with the rebuilt image and confirm that
   the database is already up to date.
2. Start the backend only after a separate explicit deployment step.
3. Create the initial region, run catalog seed, replace storefront public values,
   rebuild storefront, and start it as later steps.

## Safety Rules

- Never run `docker compose down -v`.
- Never delete `eshop_postgres_data` as a migration recovery action.
- Never expose PostgreSQL through a host `ports` mapping.
- Never use region creation or catalog seed to recover a failed migration.
- Keep PostgreSQL running while rebuilding application images.
- Back up the database before every later migration or application update.
- A code or image rollback does not reverse an applied database migration.
- Do not retag `eshop-backend:pre-99b92f4` as production without an explicit
  rollback decision; it lacks the committed SSL setting.

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
