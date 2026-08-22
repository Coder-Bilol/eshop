# Eshop Deployment Handoff

## Runtime Policy

- Local development and local verification run without Docker.
- Production deployment on the VPS runs through Docker Compose.
- Docker Desktop is not required for local development. Production images are
  built directly on the VPS.
- Build exactly one application image at a time: backend first, then storefront.
  Never run both image builds concurrently.
- The first backend build attempt exhausted host capacity and the VPS rebooted.
  Monitor every image build with `sar` and stop it if sustained memory, swap, or
  disk pressure makes the host unstable.
- The current SSH path may close a session after about 10 minutes. Run long
  backend builds through `nohup` with a persistent log as documented below.

## Current VPS Defaults

These are the default production server assumptions for the current deployment:

```text
Operating system: AlmaLinux 9.8
CPU:              1 vCPU
RAM:              about 1.7 GiB
Disk:             30 GB
Swap:             2.0 GiB
Docker Engine:    29.6.1
Docker Compose:   v5.3.1
```

Do not treat 2 vCPU / 2 GB RAM as the baseline for this project. A later VPS
upgrade is a capacity decision, not a prerequisite for following this runbook.

## Current DNS

```text
Provider:     Cloudflare
Record type:  A
Name:         eshop.natureonzoom.win
Target IP:    79.133.183.183
Proxy status: DNS only
TTL:          Auto
```

The current deployment uses one public domain:

```text
https://eshop.natureonzoom.win
```

Caddy routes backend paths to Medusa and all other paths to the Next.js
storefront. The storefront-owned OAuth completion page `/auth/complete` is an
explicit exception to the backend `/auth*` route.

Current edge status, verified on 2026-08-04:

```text
Caddy:        active and enabled
Firewall:     HTTP and HTTPS allowed in the public zone
HTTP:         redirects to HTTPS
HTTPS:        public storefront returns 200
Backend:      public /health returns 200
OAuth return: public /auth/complete returns 200 from storefront
Certificate:  Let's Encrypt, valid through 2026-10-23
```

## Repository Artifacts

The repository contains the production deployment artifacts:

```text
.dockerignore
apps/backend/Dockerfile
apps/storefront/Dockerfile
compose.production.yml
```

The committed Compose file uses locally loaded image names:

```text
eshop-backend:production
eshop-storefront:production
```

If a registry is introduced later, replace those two image lines once with the
selected registry paths.

## Local Verification

Run these on the local Windows machine without Docker:

```powershell
npm --workspace apps/backend run typecheck
npm --workspace apps/storefront run typecheck
npm --workspace apps/backend run build
$env:NEXT_PUBLIC_MEDUSA_BACKEND_URL='https://eshop.natureonzoom.win'
$env:NEXT_PUBLIC_STOREFRONT_URL='https://eshop.natureonzoom.win'
$env:NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY='<PRODUCTION_PUBLISHABLE_KEY>'
$env:NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID='<PRODUCTION_SALES_CHANNEL_ID>'
npm --workspace apps/storefront run build
node scripts/mb-lint.mjs
```

Backend build can take a long time on the current VPS. Docker image verification
is performed on the VPS after each sequential build.

## Connect

Connect as `eshop` from the local machine:

```powershell
ssh -i C:\Users\ADMIN\.ssh\eshop_vps_ed25519 eshop@79.133.183.183
```

### SSH Access Policy And Provider Blocker

The current checkpoint records password authentication enabled for `root`.
Per operator policy, this setting must remain enabled; do not create an SSH
drop-in, disable root password/keyboard-interactive authentication, reload
`sshd`, or otherwise alter live SSH access.

The VPS provider currently blocks server access while resolving its own errors,
so the live policy cannot be changed or re-verified from this workspace. Treat
this as an external production-readiness blocker. No local runbook text is an
authorization to modify the server. Any future provider-supported compensating
control requires a new explicit operator decision and provider access.

## VPS Build Monitoring

Install and enable `sysstat` once as `root`:

```bash
dnf install -y sysstat
systemctl enable --now sysstat
systemctl start sysstat-collect.service
systemctl list-timers --all 'sysstat*'
```

Monitor the host from additional SSH sessions while an image build is running:

```bash
sar -r 2
sar -S 2
sar -q 2
sar -d 2
```

The commands show RAM, swap, process queue/load, and disk activity respectively.
Stop the active `docker build` with `Ctrl+C` if swap remains close to full, the
host stops responding normally, or disk wait remains saturated. Historical
samples for the current day are available without the interval argument:

```bash
sar -r
sar -S
sar -q
sar -d
```

### Detached Backend Build

The backend dependency layer can take more than 40 minutes on the current VPS,
while an SSH session may close after about 10 minutes. Start backend builds
detached and write progress to a persistent log; no additional script is needed:

```bash
cd /opt/eshop/app
BUILD_REV=$(git rev-parse --short HEAD)
BUILD_LOG=/opt/eshop/backend-build-${BUILD_REV}.log

if docker image inspect eshop-backend:production >/dev/null 2>&1 && \
   ! docker image inspect eshop-backend:pre-${BUILD_REV} >/dev/null 2>&1; then
  docker tag eshop-backend:production eshop-backend:pre-${BUILD_REV}
fi

nohup env DOCKER_BUILDKIT=1 docker build \
  --pull \
  --progress=plain \
  --platform linux/amd64 \
  --label org.opencontainers.image.revision=${BUILD_REV} \
  --tag eshop-backend:production \
  --file apps/backend/Dockerfile \
  . >"${BUILD_LOG}" 2>&1 < /dev/null &
BUILD_PID=$!
printf 'backend build pid=%s log=%s\n' "${BUILD_PID}" "${BUILD_LOG}"
```

Follow the build from any SSH session:

```bash
BUILD_REV=$(git -C /opt/eshop/app rev-parse --short HEAD)
BUILD_LOG=/opt/eshop/backend-build-${BUILD_REV}.log
tail -f "${BUILD_LOG}"
```

The build is complete only after the log ends with a successful image export and
the inspect output contains the expected revision:

```bash
tail -n 30 "${BUILD_LOG}"
docker image inspect --format '{{.Id}} {{json .Config.Labels}}' \
  eshop-backend:production
```

If monitoring shows sustained unsafe pressure, stop only the recorded build PID.
After reconnecting, locate it with
`pgrep -af 'docker build.*eshop-backend:production'`; do not start a second build
while the first PID still exists.

## Production Secrets

Create these files under `/opt/eshop/secrets` with mode `600`:

```text
postgres.env
backend.env
storefront.env
```

Minimum `/opt/eshop/secrets/postgres.env`:

```dotenv
POSTGRES_DB=eshop
POSTGRES_USER=eshop
POSTGRES_PASSWORD=<RANDOM_DATABASE_PASSWORD>
```

Minimum `/opt/eshop/secrets/backend.env`:

```dotenv
NODE_ENV=production
PORT=9000
DATABASE_URL=postgres://eshop:<RANDOM_DATABASE_PASSWORD>@postgres:5432/eshop
STORE_CORS=https://eshop.natureonzoom.win
ADMIN_CORS=https://eshop.natureonzoom.win
AUTH_CORS=https://eshop.natureonzoom.win
MEDUSA_FILE_URL=https://eshop.natureonzoom.win/static
JWT_SECRET=<RANDOM_SECRET>
COOKIE_SECRET=<RANDOM_SECRET>
NODE_OPTIONS=--max-old-space-size=256
GOOGLE_OAUTH_CLIENT_ID=fake_google_oauth_client_id_NOT_REAL
GOOGLE_OAUTH_CLIENT_SECRET=fake_google_oauth_client_secret_NOT_REAL
VK_ID_CLIENT_ID=fake_vk_id_client_id_NOT_REAL
VK_ID_SERVICE_TOKEN=fake_vk_id_service_token_NOT_REAL
YOOKASSA_MODE=mock
YOOKASSA_SHOP_ID=fake_yookassa_shop_id_NOT_REAL
YOOKASSA_SECRET_KEY=fake_yookassa_secret_key_NOT_REAL
YOOKASSA_WEBHOOK_SECRET=fake_yookassa_webhook_secret_NOT_REAL
EMAIL_PROVIDER=mock
SMTP_HOST=fake-smtp-host-not-real.local
SMTP_PORT=1025
SMTP_USER=fake_smtp_user_NOT_REAL
SMTP_PASSWORD=fake_smtp_password_NOT_REAL
```

Minimum `/opt/eshop/secrets/storefront.env`:

```dotenv
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://eshop.natureonzoom.win
NEXT_PUBLIC_STOREFRONT_URL=https://eshop.natureonzoom.win
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_fake_not_real_replace_with_medusa_publishable_key
NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=sc_fake_not_real_replace_with_medusa_sales_channel_id
NODE_OPTIONS=--max-old-space-size=192
```

Generate random secrets with:

```bash
openssl rand -hex 32
```

Values containing `fake`, `NOT_REAL`, or `not-real` are placeholders. Replace
them before enabling the corresponding production feature. `NEXT_PUBLIC_*`
values are embedded during storefront image build, so rebuild the storefront
image after changing them.

### Product Media Storage

Product images use Medusa's Local File Provider. The provider URL is public, but
the files themselves stay on the VPS in a host directory mounted into the
backend container:

```text
/opt/eshop/media -> /app/apps/backend/.medusa/server/static
```

Before the first backend restart after enabling the mount, preserve any files
from the current container and initialize the host directory:

```bash
sudo install -d -o 1000 -g 1000 /opt/eshop/media
docker cp eshop-backend-1:/app/apps/backend/.medusa/server/static/. /opt/eshop/media/
sudo chown -R 1000:1000 /opt/eshop/media
```

Back up `/opt/eshop/media` together with the PostgreSQL backup before a
production update. Product image URLs previously saved as
`http://localhost:9000/static/...` must be re-uploaded or migrated to
`https://eshop.natureonzoom.win/static/...` after the public route is enabled.

Treat the PostgreSQL dump and a versioned `/opt/eshop/media` archive as one
recovery set, copy both to the configured external backup target, and record the
matching timestamps. A restore that contains uploaded product media must restore
both members and verify the `/static` URLs before application traffic resumes.

`apps/backend/medusa-config.ts` explicitly sets
`databaseDriverOptions.connection.ssl` to `false`. PostgreSQL is reached only
through the private Compose network, where TLS is not enabled. Do not remove
this setting while `DATABASE_URL` uses the internal `postgres` hostname.

## First Deployment

Run as `eshop` after repository access is available:

Clone the GitHub repository exactly into `/opt/eshop/app`. Do not clone into
`/opt/eshop`: that parent directory contains deployment-owned subdirectories
such as `/opt/eshop/secrets` and `/opt/eshop/backups`.

```bash
git clone <REPOSITORY_URL> /opt/eshop/app
cd /opt/eshop/app
git checkout <PRODUCTION_BRANCH_OR_TAG>
```

If resuming a partially completed deployment, first check whether the backend
image for the selected checkout already exists:

```bash
docker image inspect eshop-backend:production >/dev/null
```

If the image is absent, or if `/opt/eshop/app` was changed to a new commit after
the image was built, use the **Detached Backend Build** procedure above. Do not
start the storefront build until the backend log confirms successful export and
the host has returned to normal resource usage:

```bash
docker image inspect --format '{{.Id}} {{json .Config.Labels}}' \
  eshop-backend:production
```

Start PostgreSQL, wait for its health check, run migrations, and start the
backend. The migration-only container needs a larger heap than the normal
backend runtime, so override `NODE_OPTIONS` only for this command:

```bash
docker compose -f compose.production.yml up -d --no-deps postgres
docker compose -f compose.production.yml ps postgres

docker compose -f compose.production.yml run --rm --no-deps \
  -e NODE_OPTIONS=--max-old-space-size=768 \
  --workdir /app/apps/backend/.medusa/server \
  backend /app/node_modules/.bin/medusa db:migrate

docker compose -f compose.production.yml up -d backend
curl -fsS http://127.0.0.1:9000/health
```

On a newly created empty database, create the required `Москва` / `RUB` Medusa
region through the existing Medusa Admin or CLI. Then run the verified
idempotent catalog seed:

```bash
docker compose -f compose.production.yml run --rm backend npm run seed:medusa:catalog
```

Copy the seed output values `publishable_api_key` and `sales_channel_id` into
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` and
`NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID` in
`/opt/eshop/secrets/storefront.env`. Both values are public storefront
configuration. Do not run a different or unverified seed script.

Only after the backend build, database initialization, and public Medusa values
are configured, build the storefront image on the VPS. Continue monitoring with
`sar` and do not run another image build concurrently:

```bash
docker build --platform linux/amd64 \
  --tag eshop-storefront:production \
  --file apps/storefront/Dockerfile \
  --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<PRODUCTION_PUBLISHABLE_KEY> \
  --build-arg NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=<PRODUCTION_SALES_CHANNEL_ID> \
  .
docker image inspect eshop-storefront:production >/dev/null
docker compose -f compose.production.yml up -d storefront
```

Verify local services on the VPS:

```bash
docker compose -f compose.production.yml ps
curl -fsS http://127.0.0.1:9000/health
curl -fsSI http://127.0.0.1:3000/
```

## Caddy, Firewall, and TLS

This configuration is active on the current VPS. The original package Caddyfile
was preserved as `/etc/caddy/Caddyfile.backup-20260725-111004` before the first
production activation. The configuration replaced during the OAuth callback
route correction is preserved as
`/etc/caddy/Caddyfile.backup-20260804-071458`.

Create `/etc/caddy/Caddyfile`:

```caddyfile
eshop.natureonzoom.win {
    handle /auth/complete {
        reverse_proxy 127.0.0.1:3000
    }

    @medusa path /static* /store* /admin* /auth* /app* /health

    handle @medusa {
        reverse_proxy 127.0.0.1:9000
    }

    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

Then validate and enable Caddy:

```bash
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable --now caddy
```

Open HTTP and HTTPS in addition to SSH:

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

Verify TLS:

```bash
curl -fsSI https://eshop.natureonzoom.win/
curl -fsS https://eshop.natureonzoom.win/health
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'https://eshop.natureonzoom.win/auth/complete?provider=google&status=success'
```

The OAuth callback check must return `200`. Keep `/auth/complete` before the
general backend `/auth*` handler: this page belongs to storefront, while the
remaining `/auth*` endpoints belong to Medusa.

## Migration Procedure

Always run migrations from the exact backend image that will be started after
the deployment. The image must include the explicit internal PostgreSQL
`ssl=false` setting from `apps/backend/medusa-config.ts`.

Before every later migration, keep PostgreSQL running, stop the application
containers to free RAM, and create a database backup. Copy the backup to the
configured external storage before changing the schema:

```bash
cd /opt/eshop/app
docker compose -f compose.production.yml stop storefront backend
docker compose -f compose.production.yml ps postgres

mkdir -p /opt/eshop/backups
chmod 700 /opt/eshop/backups
docker compose -f compose.production.yml \
  exec -T postgres pg_dump -U eshop -Fc eshop \
  > /opt/eshop/backups/eshop-$(date +%Y%m%d-%H%M%S).dump
```

Run Medusa from the compiled production directory. Do not use the normal
backend heap limit of `256 MB`: it is sufficient for the HTTP runtime but caused
the migration CLI to fail with heap OOM on this VPS.

```bash
docker compose -f compose.production.yml run --rm --no-deps \
  -e NODE_OPTIONS=--max-old-space-size=768 \
  --workdir /app/apps/backend/.medusa/server \
  backend /app/node_modules/.bin/medusa db:migrate
```

The command applies module migrations, syncs Medusa links, and runs Medusa
migration scripts. It does not start the backend HTTP server. After a successful
run, execute the same command once more: all modules and links must report that
the database is already up to date. Only then start the application containers
and verify their health checks.

If a migration fails, keep PostgreSQL and `eshop_postgres_data` intact, save the
full migration and PostgreSQL logs, and fix the cause before an idempotent retry.
Never use `docker compose down -v`, never delete the named volume, and never run
region creation or catalog seed as an attempted migration recovery. A code/image
rollback does not reverse an already applied database migration; restore a
backup only after an explicit recovery decision.

## Update

Before every update, create a database dump and a media archive, then copy both
members of the recovery set to external storage:

```bash
mkdir -p /opt/eshop/backups
chmod 700 /opt/eshop/backups

BACKUP_STAMP=$(date +%Y%m%d-%H%M%S)
docker compose -f /opt/eshop/app/compose.production.yml \
  exec -T postgres pg_dump -U eshop -Fc eshop \
  > /opt/eshop/backups/eshop-${BACKUP_STAMP}.dump
tar -C /opt/eshop -czf \
  /opt/eshop/backups/media-${BACKUP_STAMP}.tar.gz media
```

Update the repository, stop the application containers to release memory, then
build backend and storefront sequentially on the VPS. Keep PostgreSQL running,
monitor each build with `sar`, and never start both builds concurrently:

```bash
cd /opt/eshop/app
git fetch --prune
git checkout <PRODUCTION_BRANCH_OR_TAG>
git pull --ff-only

docker compose -f compose.production.yml stop storefront backend

# Rebuild backend with the Detached Backend Build procedure above and wait for
# successful export before continuing.

docker build --platform linux/amd64 \
  --tag eshop-storefront:production \
  --file apps/storefront/Dockerfile \
  --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<PRODUCTION_PUBLISHABLE_KEY> \
  --build-arg NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=<PRODUCTION_SALES_CHANNEL_ID> \
  .

docker compose -f compose.production.yml run --rm --no-deps \
  -e NODE_OPTIONS=--max-old-space-size=768 \
  --workdir /app/apps/backend/.medusa/server \
  backend /app/node_modules/.bin/medusa db:migrate
docker compose -f compose.production.yml up -d backend storefront
```

## Rollback

Application rollback without a registry means returning the repository to the
previous known-good commit/tag, rebuilding both images sequentially on the VPS
under `sar` monitoring, and starting them again:

```bash
cd /opt/eshop/app
git checkout <PREVIOUS_GOOD_COMMIT_OR_TAG>

docker compose -f compose.production.yml stop storefront backend

# Rebuild backend with the Detached Backend Build procedure above and wait for
# successful export before continuing.

docker build --platform linux/amd64 \
  --tag eshop-storefront:production \
  --file apps/storefront/Dockerfile \
  --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<PRODUCTION_PUBLISHABLE_KEY> \
  --build-arg NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=<PRODUCTION_SALES_CHANNEL_ID> \
  .
docker compose -f compose.production.yml up -d backend storefront
```

Application rollback does not roll back database migrations. Restore a database
backup only after an explicit recovery decision.

## Operational Checks

```bash
systemctl --failed
docker compose -f /opt/eshop/app/compose.production.yml ps
docker compose -f /opt/eshop/app/compose.production.yml logs --tail=100 backend
docker compose -f /opt/eshop/app/compose.production.yml logs --tail=100 storefront
docker compose -f /opt/eshop/app/compose.production.yml logs --tail=100 postgres
docker stats --no-stream
free -h
df -h /
docker system df
```
