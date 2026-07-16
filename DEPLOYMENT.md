# Eshop Deployment Handoff

## Runtime Policy

- Local development and local verification run without Docker.
- Production deployment on the VPS runs through Docker Compose.
- Docker Desktop is not required for local development, but production images
  require an external Docker-capable build host.
- Do not build application images on the current 1 vCPU / 1.7 GiB VPS. The
  first backend build attempt exhausted host capacity and the VPS rebooted.
- Until a registry is selected, transfer externally built `linux/amd64` image
  archives to the VPS and load them with `docker load`.

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
storefront.

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

Backend build can take a few minutes. Verify Docker images on the external build
host before transferring them to the VPS.

## Connect

Connect as `eshop` from the local machine:

```powershell
ssh -i C:\Users\ADMIN\.ssh\eshop_vps_ed25519 eshop@79.133.183.183
```

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
JWT_SECRET=<RANDOM_SECRET>
COOKIE_SECRET=<RANDOM_SECRET>
NODE_OPTIONS=--max-old-space-size=256
GOOGLE_OAUTH_CLIENT_ID=fake_google_oauth_client_id_NOT_REAL
GOOGLE_OAUTH_CLIENT_SECRET=fake_google_oauth_client_secret_NOT_REAL
VK_ID_CLIENT_ID=fake_vk_id_client_id_NOT_REAL
VK_ID_CLIENT_SECRET=fake_vk_id_client_secret_NOT_REAL
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

On an external Docker-capable build host, check out the same production commit,
build the backend for `linux/amd64`, and export it:

```bash
docker build --platform linux/amd64 \
  --tag eshop-backend:production \
  --file apps/backend/Dockerfile \
  .
docker save --output eshop-backend-production.tar eshop-backend:production
```

Transfer the archive to the VPS, then load it:

```bash
docker load --input /opt/eshop/eshop-backend-production.tar
```

Start PostgreSQL, run migrations, and start the backend:

```bash
docker compose -f compose.production.yml up -d postgres
docker compose -f compose.production.yml run --rm backend npm run db:migrate:medusa
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

Build the storefront image on the external host only after those values are
configured. Export it, transfer it to the VPS, then load and start it:

```bash
docker build --platform linux/amd64 \
  --tag eshop-storefront:production \
  --file apps/storefront/Dockerfile \
  --build-arg NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_STOREFRONT_URL=https://eshop.natureonzoom.win \
  --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<PRODUCTION_PUBLISHABLE_KEY> \
  --build-arg NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=<PRODUCTION_SALES_CHANNEL_ID> \
  .
docker save --output eshop-storefront-production.tar eshop-storefront:production

docker load --input /opt/eshop/eshop-storefront-production.tar
docker compose -f compose.production.yml up -d storefront
```

Verify local services on the VPS:

```bash
docker compose -f compose.production.yml ps
curl -fsS http://127.0.0.1:9000/health
curl -fsSI http://127.0.0.1:3000/
```

## Caddy, Firewall, and TLS

Create `/etc/caddy/Caddyfile`:

```caddyfile
eshop.natureonzoom.win {
    handle /store* {
        reverse_proxy 127.0.0.1:9000
    }

    handle /admin* {
        reverse_proxy 127.0.0.1:9000
    }

    handle /auth* {
        reverse_proxy 127.0.0.1:9000
    }

    handle /app* {
        reverse_proxy 127.0.0.1:9000
    }

    handle /health {
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
caddy validate --config /etc/caddy/Caddyfile
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
```

## Update

Before every update, create a database backup and copy it to external storage:

```bash
mkdir -p /opt/eshop/backups
chmod 700 /opt/eshop/backups

docker compose -f /opt/eshop/app/compose.production.yml \
  exec -T postgres pg_dump -U eshop -Fc eshop \
  > /opt/eshop/backups/eshop-$(date +%Y%m%d-%H%M%S).dump
```

Update the repository, then load application images built from that exact commit
on the external build host:

```bash
cd /opt/eshop/app
git fetch --prune
git checkout <PRODUCTION_BRANCH_OR_TAG>
git pull --ff-only

docker compose -f compose.production.yml stop storefront backend
docker load --input /opt/eshop/eshop-backend-production.tar
docker load --input /opt/eshop/eshop-storefront-production.tar

docker compose -f compose.production.yml run --rm backend npm run db:migrate:medusa
docker compose -f compose.production.yml up -d backend storefront
```

## Rollback

Application rollback without a registry means returning the repository to the
previous known-good commit/tag, loading image archives built from that exact
commit, and starting them again:

```bash
cd /opt/eshop/app
git checkout <PREVIOUS_GOOD_COMMIT_OR_TAG>

docker compose -f compose.production.yml stop storefront backend
docker load --input /opt/eshop/eshop-backend-previous.tar
docker load --input /opt/eshop/eshop-storefront-previous.tar
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
