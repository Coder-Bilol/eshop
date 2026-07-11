# Eshop Deployment Handoff

## Before First Deployment

Prepare:

- repository URL and production branch/tag;
- registry URL and credentials;
- storefront and API works directly with static IP of the VPS;
- production environment values;
- external destination for PostgreSQL backups.

The repository must provide and locally verify:

```text
.dockerignore
apps/backend/Dockerfile
apps/storefront/Dockerfile
compose.production.yml
```

Use fixed base-image versions and stable registry tags:

```text
<REGISTRY>/eshop-backend:production
<REGISTRY>/eshop-storefront:production
```

## Connect

Connect as `eshop` from the local machine:

```powershell
ssh -i C:\Users\ADMIN\.ssh\eshop_vps_ed25519 eshop@<SERVER_IP>
```

## Production Secrets

Create these files under `/opt/eshop/secrets` with mode `600`:

```text
postgres.env
backend.env
storefront.env
```

Minimum backend values:

```dotenv
NODE_ENV=production
PORT=9000
DATABASE_URL=postgres://eshop:<PASSWORD>@postgres:5432/eshop
STORE_CORS=https://shop.example.ru
ADMIN_CORS=https://api.example.ru
AUTH_CORS=https://shop.example.ru,https://api.example.ru
JWT_SECRET=<RANDOM_SECRET>
COOKIE_SECRET=<RANDOM_SECRET>
```

Generate secrets with `openssl rand -hex 32`. Add OAuth, YooKassa, and SMTP
variables only when their features are production-ready. `NEXT_PUBLIC_*` values
are embedded during storefront image build, so changing them requires a rebuild.

## First Deployment

Run as `eshop` after the repository and images are available:

```bash
git clone <REPOSITORY_URL> /opt/eshop/app
cd /opt/eshop/app
git checkout <PRODUCTION_BRANCH_OR_TAG>

docker login <REGISTRY>
docker compose -f compose.production.yml pull

docker compose -f compose.production.yml up -d postgres
docker compose -f compose.production.yml run --rm backend npm run db:migrate:medusa
docker compose -f compose.production.yml up -d backend storefront
```

Seed only a newly created empty database and only with a verified idempotent
seed script.

Verify local services:

```bash
docker compose -f compose.production.yml ps
curl -fsS http://127.0.0.1:9000/health
curl -fsSI http://127.0.0.1:3000/
```

## Caddy, Firewall, and TLS

After DNS is ready, the server administrator configures `/etc/caddy/Caddyfile`:

```caddyfile
api.example.ru {
    reverse_proxy 127.0.0.1:9000
}

shop.example.ru {
    reverse_proxy 127.0.0.1:3000
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
curl -fsSI https://shop.example.ru/
curl -fsS https://api.example.ru/health
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

Update application images:

```bash
cd /opt/eshop/app
git fetch --prune
git checkout <PRODUCTION_BRANCH_OR_TAG>
git pull --ff-only

docker compose -f compose.production.yml pull backend storefront
docker compose -f compose.production.yml stop storefront backend
docker compose -f compose.production.yml run --rm backend npm run db:migrate:medusa
docker compose -f compose.production.yml up -d backend storefront
```

## Rollback

Return the registry `production` tag to the previous images, then run:

```bash
cd /opt/eshop/app
docker compose -f compose.production.yml pull backend storefront
docker compose -f compose.production.yml up -d backend storefront
```

Application rollback does not roll back database migrations; restore a database
backup only after an explicit recovery decision.

## Operational Checks

```bash
systemctl --failed
docker compose -f /opt/eshop/app/compose.production.yml ps
docker stats --no-stream
free -h
df -h /
docker system df
```
