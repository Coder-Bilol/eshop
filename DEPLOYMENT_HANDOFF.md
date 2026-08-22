# Production Deployment Handoff

Last verified: 2026-08-04

## Scope Status

The infrastructure runtime is online, but the storefront is not yet
production-ready for catalog use.

Security status: production readiness is also blocked because the last verified
effective SSH policy permits password authentication for `root`. Per operator
policy this setting must remain enabled. The VPS provider currently blocks server
access while resolving provider-side errors; no live SSH change or re-verification
is possible from this workspace.

- PostgreSQL is running and healthy on the production VPS.
- Medusa migrations are applied and an idempotent second run succeeded.
- Backend image was rebuilt successfully from revision `99b92f4`.
- PostgreSQL, backend, and storefront services are running and healthy.
- Caddy serves the public domain over HTTPS and redirects HTTP to HTTPS.
- Caddy routes storefront OAuth completion `/auth/complete` to Next.js before
  the general Medusa `/auth*` handler.
- Region creation and catalog seed were not run.
- Storefront public Medusa values are still fake placeholders.

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
| Backend service | Running and healthy on `127.0.0.1:9000` |
| Storefront service | Running and healthy on `127.0.0.1:3000` |
| Temporary migration containers | Removed |

Public edge state:

| Item | Verified state |
|---|---|
| Domain | `https://eshop.natureonzoom.win` |
| Caddy | Active and enabled |
| Firewall | Public HTTP/HTTPS enabled; PostgreSQL remains private |
| HTTP | `308` redirect to HTTPS |
| HTTPS storefront | External `200` |
| HTTPS backend health | External `200` with `{"status":"ok","service":"eshop-backend"}` |
| OAuth completion page | External `200` from storefront |
| TLS certificate | Let's Encrypt; valid through 2026-10-23 |
| Caddy rollback | `/etc/caddy/Caddyfile.backup-20260804-071458` for the OAuth route correction |

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
12. Started PostgreSQL, backend, and storefront; all three report `healthy`.
13. Installed and validated the production Caddy reverse-proxy configuration.
14. Permanently opened only HTTP/HTTPS in the public firewalld zone.
15. Enabled Caddy, obtained a Let's Encrypt certificate, and verified the public
    storefront and backend health endpoint externally.
16. Corrected `/auth/complete` routing from backend to storefront, validated and
    reloaded Caddy, and verified the public callback returns `200`.

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
backend/storefront containers: running and healthy
public storefront: HTTPS 200
public backend /health: HTTPS 200
public storefront /auth/complete: HTTPS 200
Caddy: active and enabled
firewall: HTTP/HTTPS allowed
```

Local checks passed:

```text
npm --workspace apps/backend run typecheck
node scripts/mb-lint.mjs
git diff --check
git ls-files -- '*.env'  # no output
```

## Remaining Blockers

The VPS provider access block and the operator SSH policy are external blockers.
Do not disable root password authentication or attempt live SSH changes. Revisit
only after provider access is restored and the operator explicitly defines an
allowed compensating control.

The storefront image contains fake public Medusa values. It must be rebuilt only
after the initial region and verified catalog seed provide real values.

The database still contains zero regions and zero products. The public website
is reachable, but catalog behavior is not production-ready until those steps are
completed.

## Next Safe Sequence

1. Wait for the VPS provider to restore server access and resolve its errors.
2. Create the initial region and run the verified catalog seed only after the
   external production-readiness blockers are resolved.
3. Replace storefront public values with the seed output.
4. Rebuild and restart only storefront, then verify catalog behavior through the
   public HTTPS domain.

## Safety Rules

- Never run `docker compose down -v`.
- Never delete `eshop_postgres_data` as a migration recovery action.
- Never expose PostgreSQL through a host `ports` mapping.
- Do not change SSH access under the current operator policy. Any future change
  requires a new explicit decision after provider access is restored.
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
