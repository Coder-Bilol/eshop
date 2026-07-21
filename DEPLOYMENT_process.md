# Eshop Deployment Process History

## Purpose

This file records deployment preparation history and the remaining work.

[DEPLOYMENT.md](DEPLOYMENT.md) is the authoritative handoff runbook. Use it for
future deployment commands.

The historical archive below preserves the detailed plan that existed before
the VPS preparation. It is evidence, not an operational instruction: several
of its values, paths, and commands are obsolete.

## Current Checkpoint

Preparation started on 2026-07-11. The current server state was checked again on
2026-07-21:

| Area | Current state |
|---|---|
| Operating system | AlmaLinux 9.8 |
| Kernel | `5.14.0-687.20.1.el9_8.x86_64` |
| CPU | 1 vCPU |
| RAM | about 1.7 GiB |
| Disk | 30 GB, about 18 GB free after backend image build |
| Swap | 2.0 GiB |
| Git | `2.52.0` |
| Docker Engine | `29.6.1`, enabled and active |
| Docker Compose | `v5.3.1` |
| Build monitoring | `sysstat` enabled; `sysstat-collect.timer` active |
| Caddy | `2.11.4`, installed but disabled/inactive |
| Firewall | only SSH is needed now; HTTP/HTTPS remain closed |
| Application | clean repository checkout at `74fa10e`; backend image rebuilt; storefront image failed before Dockerfile fix; containers and database volume not deployed |

The current deployment treats this small VPS as the default server profile:
1 vCPU, about 1.7 GiB RAM, 30 GB disk, and 2.0 GiB swap. Production images are
built directly on the VPS, strictly one at a time and under live `sar`
monitoring. Never build backend and storefront concurrently.

Do not treat 2 vCPU / 2 GB RAM as the baseline. A later VPS upgrade is an
optional capacity decision if monitored builds, traffic, or real orders show
that the current server is not enough.

## Current Access Model

- `root` SSH configuration was not changed.
- Deployment user `eshop` was created.
- `eshop` authenticates with a dedicated local `ed25519` private key.
- `eshop` password and keyboard-interactive authentication are disabled.
- The public key is in `/home/eshop/.ssh/authorized_keys`.
- The server SSH rule is `/etc/ssh/sshd_config.d/90-eshop.conf`.
- The local private key is `C:\Users\ADMIN\.ssh\eshop_vps_ed25519`.
- `.env` contains only the local key path and connection metadata, not the key.
- `eshop` belongs to the `docker` group.
- Docker-group access is equivalent to root-level control of the host.

Verified effective SSH policy:

```text
root:  passwordauthentication yes
eshop: passwordauthentication no
eshop: authenticationmethods publickey
```

Verified deployment user command:

```powershell
ssh -i C:\Users\ADMIN\.ssh\eshop_vps_ed25519 eshop@<SERVER_IP>
```

## Current Server Layout

```text
/opt/eshop          eshop:eshop 750
/opt/eshop/app      reserved for repository checkout
/opt/eshop/secrets  eshop:eshop 700
/opt/eshop/backups  created before the first database backup
```

The checkout uses `/opt/eshop/app`. The separate path prevents the existing
`/opt/eshop/secrets` directory from making `git clone` fail.

GitHub repository checkout rule:

```bash
git clone <REPOSITORY_URL> /opt/eshop/app
cd /opt/eshop/app
```

Do not clone the repository into `/opt/eshop`. That parent directory is the
deployment root and contains non-Git runtime paths such as `/opt/eshop/secrets`
and `/opt/eshop/backups`.

## Completed Preparation Timeline

### 1. Initial inspection

The agent connected to the VPS through the existing bootstrap root credential.

The inspection confirmed:

- AlmaLinux 9.8 on KVM;
- a newer kernel installed but not active;
- one vCPU rather than the previously planned two;
- about 1.7 GiB RAM rather than the planned 2 GB;
- 512 MiB swap;
- Docker and Caddy absent;
- Git already installed;
- firewall allowing SSH, Cockpit, and DHCPv6 client;
- only port 22 listening;
- no `/opt/eshop` deployment directory.

No application, production data, Docker volumes, or existing deployment was
found during the inspection.

### 2. Kernel reboot

Before reboot, these checks passed:

```bash
dnf check
systemctl --failed
```

The server was rebooted.

After reconnecting, the active kernel was verified as:

```text
5.14.0-687.20.1.el9_8.x86_64
```

`systemctl --failed` reported zero failed units.

### 3. Key-only deployment access

A dedicated unencrypted `ed25519` key was generated locally to support
non-interactive agent access.

The private key remains in the local Windows user profile.

Only the public key was installed on the VPS.

The following server-side objects were created:

```text
user:     eshop
home:     /home/eshop
ssh dir:  /home/eshop/.ssh, mode 700
key file: /home/eshop/.ssh/authorized_keys, mode 600
rule:     /etc/ssh/sshd_config.d/90-eshop.conf, mode 600
```

The SSH configuration was syntax-checked before reload:

```bash
sshd -t
systemctl reload sshd
```

The new key login was verified before continuing with system preparation.

Root SSH continued to work under its previous policy.

### 4. Swap expansion

The original server had one swapfile of 512 MiB.

A second swapfile was created:

```text
path: /swapfile-eshop
size: 1536 MiB
mode: 600
```

The file was formatted, activated, and added to `/etc/fstab`.

The verified total is:

```text
/swapfile       512 MiB
/swapfile-eshop 1.5 GiB
total           2.0 GiB
```

Swap reduces the likelihood of OOM but does not make parallel Docker builds on
this VPS safe.

### 5. Docker and Caddy installation

Docker CE was installed from Docker's RHEL repository.

Caddy was installed from the configured Caddy COPR repository.

Installed components:

```text
docker-ce                 29.6.1
docker-ce-cli             29.6.1
containerd.io             2.2.6
docker-buildx-plugin      0.35.0
docker-compose-plugin     5.3.1
caddy                     2.11.4
```

Docker was enabled and started:

```bash
systemctl enable --now docker
```

The Docker daemon and Compose plugin were verified.

The `hello-world` image was pulled and executed successfully.

Caddy was deliberately left disabled and inactive because DNS records, a real
`Caddyfile`, and firewall rules do not yet exist.

### 6. Deployment directories

The following directories were created:

```text
/opt/eshop          owner eshop:eshop  mode 750
/opt/eshop/secrets  owner eshop:eshop  mode 700
```

The `eshop` user was added to the Docker group.

A fresh key-authenticated `eshop` session successfully executed:

```bash
docker version
docker compose version
```

No repository checkout, production secret file, Compose project, container,
database volume, registry credential, or Caddy configuration has been created.

## Repository Deployment Artifacts Checkpoint

Repository-side deployment artifacts were added on 2026-07-16:

| Artifact | Current state |
|---|---|
| `.dockerignore` | added; excludes env files, local build outputs, Memory Bank/task artifacts, and local runtime data |
| `apps/backend/Dockerfile` | added; multi-stage Node 24.11.0 image, runs `medusa build`, starts production Medusa server |
| `apps/storefront/Dockerfile` | added; multi-stage Node 24.11.0 image, uses Next standalone output, removes accidental standalone `.env` |
| `compose.production.yml` | added; PostgreSQL, backend, and storefront services with loopback app ports, named PostgreSQL volume, health checks, build-time storefront public configuration, and no Redis |
| `apps/storefront/next.config.ts` | updated with `output: "standalone"` for production image runtime |

Local verification on 2026-07-16:

- `docker compose -f compose.production.yml config --no-interpolate`: passed.
- `npm --workspace apps/storefront run typecheck`: passed.
- `npm --workspace apps/backend run typecheck`: passed.
- `npm --workspace apps/storefront run build`: passed.
- `npm --workspace apps/backend run build`: passed in about 142 seconds.
- Docker image build was not run because the local Docker daemon was not active
  (`dockerDesktopLinuxEngine` pipe unavailable).

Initial deployment attempt on 2026-07-16:

- Local development and local verification run without Docker.
- Production deployment runs through Docker Compose on the VPS.
- The repository was cloned into `/opt/eshop/app` at commit `33b8fad`.
- A sequential backend image build spent more than 35 minutes in `npm ci`; a
  second explicit attempt caused the SSH connection to drop and the VPS uptime
  confirmed a host reboot during the build.
- The unprivileged deployment user cannot read the previous boot kernel journal,
  so OOM versus provider watchdog could not be distinguished.
- After reboot, Docker and Git were healthy. No application image, container,
  PostgreSQL volume, migration, seed, or production data had been created.
- This incident proved that an unmonitored retry is unsafe on the current
  1 vCPU / 1.7 GiB VPS. Any later retry must build only one image and must run
  under live RAM, swap, load, and disk monitoring.
- The local Windows Docker Desktop could not start because its WSL backend
  requires an update. An attempted installer switch to Hyper-V did not change
  the active backend; completing that switch requires local Windows
  administration and likely a reboot.

Retired external backend image build checkpoint on 2026-07-17:

- GitHub Actions was temporarily used as an external `linux/amd64` build host.
- Native Linux preflight completed the scoped dependency install and
  `medusa build`; Docker builds then showed that `medusa-config.ts` was copied
  into `/app/apps/backend`, but the Medusa CLI could not resolve the
  extensionless config path inside the image.
- The backend Docker build now compiles that one config to CommonJS
  `medusa-config.js` before `medusa build`, removing the image build's reliance
  on runtime TypeScript loader registration.
- The final external run for commit `224b568` still failed at the Dockerfile
  `npm run build` step; no production image artifact was created.
- The operator retired the external CI build path and selected sequential VPS
  builds instead. The GitHub workflow file still requires repository cleanup.
- No failed external build produced a deployed image, and the VPS still has no
  application container, PostgreSQL volume, migration, seed, or production
  data.

VPS build-monitoring checkpoint on 2026-07-18:

- `sysstat` is installed and enabled.
- `sysstat-collect.timer` is active and schedules periodic samples.
- Live `sar -r 1 3` sampling was verified successfully.
- Each image build must run in its own `eshop` SSH session while additional SSH
  sessions monitor `sar -r 2`, `sar -S 2`, `sar -q 2`, and `sar -d 2`.
- Stop the active build with `Ctrl+C` if swap remains close to full, the host
  becomes unresponsive, or disk wait remains saturated.
- At that time, Docker had no application container or volume. The remaining
  build cache was about 379 MB and could accelerate the next backend attempt.

Backend image status checked on 2026-07-21 before refresh:

- The server checkout at `/opt/eshop/app` is clean at commit `c46fe46`.
- Docker image `eshop-backend:production` exists on the VPS.
- The image inspect ID is
  `sha256:0fe5fe6fb553572c8ea7e362cd1a4e041d8124e4d37a916e6b556d77260d415d`.
- The image creation timestamp is `2026-07-18T12:09:32+03:00`.
- `docker ps -a` shows no running or stopped application containers.
- `docker compose -f /opt/eshop/app/compose.production.yml ps` shows no
  project services.
- `docker volume ls` shows no project/database volume.
- The storefront image is not present yet.

Fresh backend image refresh checked on 2026-07-21:

- The server checkout at `/opt/eshop/app` is clean at commit `74fa10e`.
- Backend image `eshop-backend:production` was rebuilt successfully with Docker
  cache enabled and `--pull`.
- The build reused cached base/initial layers, but dependency install reran
  because package files changed; `npm ci` took about 40 minutes.
- The Medusa backend build completed successfully in the image.
- The current backend image inspect ID is
  `sha256:d82b18f754ad59b42319eb2c2f5e74b7131edf34ea7255ad5e7e671041c55017`.
- The image creation timestamp is `2026-07-21T11:25:12+03:00`.
- `docker ps -a` still shows no running or stopped project containers.
- No project container was started during this image refresh.

Storefront image attempt checked on 2026-07-21:

- The operator intentionally did not start containers and attempted only the
  second image build: `eshop-storefront:production`.
- Build cache was enabled. Base/package layers were reused, but the storefront
  dependency install ran and completed in about 23 seconds.
- The build failed at `npm --workspace apps/storefront run build`.
- Root cause: `apps/storefront/tsconfig.json` extends `../../tsconfig.json`, but
  `apps/storefront/Dockerfile` did not copy the repository root `tsconfig.json`
  into the image build stage.
- Repository fix: copy root `tsconfig.json` before copying `apps/storefront`.
- After this fix is committed, pushed, and pulled into `/opt/eshop/app`, rerun
  only the storefront `docker build`; do not start containers unless deployment
  moves from image-build verification to runtime startup.

The committed Compose file uses images built directly on the VPS:

```text
eshop-backend:production
eshop-storefront:production
```

If a registry is selected later, replace those two image lines once with the
selected stable registry tags, for example:

```text
<REGISTRY>/eshop-backend:production
<REGISTRY>/eshop-storefront:production
```

## Production Environment Files Checkpoint

Production env files were created on the VPS on 2026-07-16 under
`/opt/eshop/secrets`.

Created files:

| File | Mode | Owner | Current state |
|---|---|---|---|
| `/opt/eshop/secrets/postgres.env` | `600` | `eshop:eshop` | created with generated PostgreSQL password |
| `/opt/eshop/secrets/backend.env` | `600` | `eshop:eshop` | created with generated internal secrets and explicit fake integration placeholders |
| `/opt/eshop/secrets/storefront.env` | `600` | `eshop:eshop` | created with production domain values and explicit fake public Medusa placeholders |

Configured values without exposing secrets:

- `postgres.env`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- `backend.env`: `NODE_ENV`, `PORT`, `DATABASE_URL`, `STORE_CORS`,
  `ADMIN_CORS`, `AUTH_CORS`, `JWT_SECRET`, `COOKIE_SECRET`, `NODE_OPTIONS`,
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `VK_ID_CLIENT_ID`,
  `VK_ID_SERVICE_TOKEN`, `YOOKASSA_MODE`, `YOOKASSA_SHOP_ID`,
  `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_SECRET`, `EMAIL_PROVIDER`,
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`.
- `storefront.env`: `NODE_ENV`, `PORT`, `NEXT_PUBLIC_MEDUSA_BACKEND_URL`,
  `NEXT_PUBLIC_STOREFRONT_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`,
  `NODE_OPTIONS`, `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID`.

Known remaining env gaps and fake placeholders:

- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` and
  `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID` are explicit fake placeholders and must
  be replaced with real Medusa values before a production-ready storefront image
  is built.
- The existing idempotent catalog seed emits both public values, but on a clean
  database it requires the `Москва` / `RUB` Medusa region to be configured first.
- Google OAuth, VK ID, YooKassa, and SMTP variables are present as explicit
  fake placeholders containing `fake`, `NOT_REAL`, or `not-real`. Replace them
  before enabling the corresponding production feature.

## What Remains Before A Successful Deployment

### Product and repository readiness

1. Select a verified release commit that excludes unfinished product work.
2. Update the clean VPS checkout from `74fa10e` to that exact commit if needed.
3. If the checkout changes after the existing backend image build, rebuild the
   backend image on the VPS under `sar` monitoring.
4. Start PostgreSQL, run migrations, start the backend, and verify `/health`.
5. Configure the initial Medusa region and run the verified catalog seed.
6. Replace the fake public Medusa values in `storefront.env` with the seed output.
7. Build the storefront image only after the backend, database setup, and real
   public Medusa values are ready.
8. Never run backend and storefront image builds concurrently.
9. Verify backend, storefront, and PostgreSQL health checks from real containers.
10. Verify containers do not run dev servers.
11. Verify backend and storefront only bind to `127.0.0.1`.
12. Verify PostgreSQL has no `ports` section.
13. Verify a named volume owns PostgreSQL data.
14. Verify secrets are excluded from images and Git.
15. Verify no Redis service or `REDIS_URL` is introduced without a design change.

### Delivery decisions

1. Select the production branch or release tag.
2. Optional: select a container registry for future image delivery.
3. Optional: configure registry credentials for the image publisher.
4. Configure `eshop` access to the Git repository.
5. Keep the locally built `production` backend and storefront image tags,
   or define registry-backed stable tags later.
6. Preserve previous known-good image references before later updates.
7. Ensure image builds target `linux/amd64`.
8. Build exactly one application image at a time on the VPS.
9. Monitor every build with `sar` and stop an unstable build before starting any
   container or database operation.
10. Remove the retired GitHub Actions image-build workflow from the repository.

### Domains and proxy

1. Use `eshop.natureonzoom.win` as the current public domain.
2. Keep Cloudflare proxy status as `DNS only` for direct Caddy TLS.
3. Wait for DNS propagation before Caddy activation.
4. Create `/etc/caddy/Caddyfile` with the single-domain route from
   [DEPLOYMENT.md](DEPLOYMENT.md).
5. Route backend paths to Medusa and all other paths to storefront.
6. Validate the Caddyfile.
7. Open firewall services `http` and `https`.
8. Decide whether Cockpit remains required before removing its firewall service.
9. Enable Caddy only after backend and storefront are healthy locally.
10. Verify HTTPS and automatic certificate issuance.

### Production secrets

1. Replace fake storefront Medusa placeholders with real publishable key and
   sales channel ID before production-ready storefront image build.
2. Replace fake OAuth settings only when OAuth is production-ready.
3. Replace fake YooKassa credentials and webhook settings only when payment is
   ready.
4. Replace fake SMTP settings only when notifications are ready.
5. Rebuild the storefront image after changing `NEXT_PUBLIC_*` settings.

### Database and backup readiness

1. Define the external backup destination.
2. Test upload of an encrypted or otherwise protected backup copy.
3. Create `/opt/eshop/backups` before the first update.
4. Test `pg_dump` against the production Compose database after first startup.
5. Test database restore in a non-production environment.
6. Confirm the seed script is idempotent before any production seed.
7. Run migrations before the application containers on first deployment.
8. Create a backup before every later migration.
9. Do not use `docker compose down -v` on production.
10. Do not delete the PostgreSQL named volume.

### Capacity and launch decision

1. Treat the current VPS as the default capacity: 1 vCPU, about 1.7 GiB RAM,
   30 GB disk, and 2.0 GiB swap.
2. Consider upgrading to 2 vCPU / 2 GB RAM or higher only if monitored builds,
   traffic, or real orders show that the current server is not enough.
3. Build backend and storefront sequentially on the VPS, never concurrently.
4. Monitor RAM, swap, load, disk activity, and Docker image size during every
   build using `sar` and Docker disk checks.
5. Do not accept real orders until the critical buyer journey is verified.
6. Verify payment/webhook behavior in staging before enabling live credentials.
7. Verify a payment return page cannot mark an order as paid by itself.
8. Verify duplicate webhooks are idempotent.
9. Verify order, reservation, payment, and email flows before production launch.

## Historical Archive: Original Pre-Preparation Plan

The following sections preserve the detailed design and command plan that
preceded the actual VPS preparation. They are retained for traceability only.

Do not execute commands in this archive without comparing them to the current
[DEPLOYMENT.md](DEPLOYMENT.md): it contains outdated resource values, root SSH
examples, `/opt/eshop` checkout paths, and the retired `compose.env` scheme.

### Historical Design Decisions

- Docker was selected for production deployment.
- Codex CLI was not intended to run on the server.
- Redis was excluded until application code required it.
- PostgreSQL, Medusa backend, and Next.js storefront were planned as containers.
- Caddy was planned as a host-level HTTPS reverse proxy.
- Kubernetes, PM2, a dedicated Medusa worker, and a monitoring stack were
  excluded from the MVP.
- Production images were planned to be built outside the VPS.
- PostgreSQL was planned without a published host port.
- Backend and storefront were planned to bind only to loopback addresses.

### Historical Target Topology

```text
Local agent / operator
        |
        | SSH
        v
AlmaLinux VPS
        |
        +-- Caddy host service, ports 80 and 443
        |      |
        |      +-- 127.0.0.1:3000 storefront container
        |      |
        |      +-- 127.0.0.1:9000 backend container
        |
        +-- Docker Compose
               |
               +-- postgres
               +-- backend
               +-- storefront
```

### Historical Application Artifact Requirements

The original plan required these files before the first deployment:

```text
.dockerignore
apps/backend/Dockerfile
apps/storefront/Dockerfile
compose.production.yml
```

The original image requirements were:

- multi-stage production images;
- Linux platform `linux/amd64`;
- fixed major/minor base-image versions;
- no `latest` base images;
- a Medusa production build in the backend image;
- a Next.js production build in the storefront image;
- no dev servers in containers;
- no `privileged: true`;
- no Docker socket mount;
- named PostgreSQL volume;
- no PostgreSQL host port;
- backend loopback port mapping `127.0.0.1:9000:9000`;
- storefront loopback port mapping `127.0.0.1:3000:3000`;
- health checks and `restart: unless-stopped` for all services;
- no Redis service or `REDIS_URL`;
- no embedded or committed secrets.

Recommended historical base images:

```text
backend/storefront: node:24-bookworm-slim
database:            postgres:16-alpine
```

### Historical Non-Goals

The old plan explicitly excluded installation or use of:

- Redis;
- PM2;
- Kubernetes;
- a separate Medusa worker;
- a message broker;
- Prometheus, Grafana, or ELK;
- host PostgreSQL;
- host Node.js dependencies for application runtime.

### Historical Inputs Checklist

The original plan identified these missing inputs:

- Git repository URL and access method;
- production branch or immutable release tag;
- container registry and credentials;
- storefront domain;
- backend/Admin domain;
- production environment values;
- external PostgreSQL backup location;
- DNS records before TLS issuance;
- YooKassa local/staging credentials;
- webhook tunneling approach;
- email provider selection;
- fiscalization review before a public launch.

### Historical Kernel Procedure

Before the newer kernel was activated, the plan prescribed:

```bash
dnf check
systemctl --failed
reboot
uname -r
systemctl --failed
```

This procedure was completed during the actual preparation timeline.

### Historical Swap Procedure

The original plan prescribed adding a separate swapfile:

```bash
swapon --show
test ! -e /swapfile-eshop
fallocate -l 1536M /swapfile-eshop
chmod 600 /swapfile-eshop
mkswap /swapfile-eshop
swapon /swapfile-eshop
echo '/swapfile-eshop none swap sw 0 0' >> /etc/fstab
swapon --show
free -h
```

This procedure was completed during the actual preparation timeline.

### Historical Host Package Procedure

The original host preparation commands were:

```bash
dnf install -y git dnf-plugins-core
dnf -y copr enable @caddy/caddy
dnf install -y caddy
caddy version
```

Docker was planned from the official Docker RHEL repository:

```bash
dnf config-manager --add-repo \
  https://download.docker.com/linux/rhel/docker-ce.repo

dnf install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable --now docker
```

The plan required these checks:

```bash
docker version
docker compose version
systemctl status docker --no-pager
```

These installation and verification steps were completed.

### Historical Secret Layout

The original plan used these secret files:

```text
/opt/eshop/secrets/postgres.env
/opt/eshop/secrets/backend.env
/opt/eshop/secrets/storefront.env
```

The earlier `compose.env` version-selection file is retired. The current handoff
uses stable `production` image tags directly in `compose.production.yml`.

Historical PostgreSQL environment example:

```dotenv
POSTGRES_DB=eshop
POSTGRES_USER=eshop
POSTGRES_PASSWORD=<RANDOM_DATABASE_PASSWORD>
```

Historical backend environment example:

```dotenv
NODE_ENV=production
PORT=9000
DATABASE_URL=postgres://eshop:<PASSWORD>@postgres:5432/eshop
STORE_CORS=https://shop.example.ru
ADMIN_CORS=https://api.example.ru
AUTH_CORS=https://shop.example.ru,https://api.example.ru
JWT_SECRET=<RANDOM_SECRET>
COOKIE_SECRET=<RANDOM_SECRET>
NODE_OPTIONS=--max-old-space-size=256
```

Historical storefront environment example:

```dotenv
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.ru
NEXT_PUBLIC_STOREFRONT_URL=https://shop.example.ru
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<PRODUCTION_PUBLISHABLE_KEY>
NODE_OPTIONS=--max-old-space-size=192
```

### Historical Image Delivery Procedure

The design preferred one of these build locations:

- CI;
- a local Docker-capable machine;
- a dedicated build host.

The intended server flow was:

```bash
docker login <REGISTRY>
docker compose -f compose.production.yml pull
```

The server was not intended to build images during normal operation.

The old emergency-build policy was:

```bash
docker compose -f compose.production.yml stop backend storefront

COMPOSE_PARALLEL_LIMIT=1 \
  docker compose -f compose.production.yml build backend

COMPOSE_PARALLEL_LIMIT=1 \
  docker compose -f compose.production.yml build storefront
```

The plan required monitoring the following during an emergency build:

```bash
free -h
docker system df
```

### Historical First Deployment Order

The detailed first-deployment order was:

1. Start PostgreSQL.
2. Check PostgreSQL health and logs.
3. Run Medusa migrations.
4. Seed only an empty database with an idempotent seed.
5. Start backend and storefront.
6. Check container status and logs.
7. Check backend health on loopback.
8. Check storefront response on loopback.
9. Configure Caddy after local application checks pass.
10. Open firewall HTTP/HTTPS only after proxy configuration is valid.
11. Verify public HTTPS paths.

Historical local checks:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 postgres
docker compose -f compose.production.yml logs --tail=100 backend
docker compose -f compose.production.yml logs --tail=100 storefront
curl -fsS http://127.0.0.1:9000/health
curl -fsSI http://127.0.0.1:3000/
```

### Historical PostgreSQL Limits

The original constrained-server recommendation was:

```text
shared_buffers=64MB
work_mem=2MB
maintenance_work_mem=32MB
max_connections=30
```

These limits must be expressed in the future Compose configuration and verified
against the actual Medusa runtime before launch.

### Historical Caddy Plan

The intended Caddyfile shape was:

```caddyfile
api.example.ru {
    reverse_proxy 127.0.0.1:9000
}

shop.example.ru {
    reverse_proxy 127.0.0.1:3000
}
```

The planned activation commands were:

```bash
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl status caddy --no-pager
```

The plan relied on Caddy to preserve `Host` and add `X-Forwarded-*` headers.

### Historical Firewall and TLS Plan

The planned firewall commands were:

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
firewall-cmd --list-all
```

The plan required only SSH, HTTP, and HTTPS to be public.

The plan relied on Caddy for automatic certificate issuance and renewal after
DNS, ports 80/443, and the Caddyfile were ready.

Historical public checks:

```bash
journalctl -u caddy -n 100 --no-pager
curl -fsSI https://shop.example.ru/
curl -fsS https://api.example.ru/health
```

### Historical Update Procedure

The old update process required recording the active images and creating a
backup before database migrations.

Historical backup command shape:

```bash
docker compose -f /opt/eshop/app/compose.production.yml \
  exec -T postgres \
  pg_dump -U eshop -Fc eshop \
  > /opt/eshop/backups/eshop-$(date +%Y%m%d-%H%M%S).dump
```

Historical update command shape:

```bash
docker compose -f compose.production.yml pull backend storefront
docker compose -f compose.production.yml stop storefront backend
docker compose -f compose.production.yml run --rm backend npm run db:migrate:medusa
docker compose -f compose.production.yml up -d backend storefront
```

### Historical Rollback Plan

The old plan preserved a previous application image reference and required:

1. Returning the registry production reference to the previous application images.
2. Pulling backend and storefront images on the server.
3. Restarting backend and storefront.
4. Repeating health checks.

Database migrations were always excluded from simple image rollback.

Database restoration was reserved for an explicit recovery decision because it
replaces production data.

### Historical Cleanup Rules

The old plan allowed only a reviewed image cleanup:

```bash
docker image ls
docker system df
docker image prune
```

It prohibited these commands without an explicit review:

```bash
docker system prune -a
```

The reason remains current: these commands may remove rollback images or
production data.

### Historical Diagnostics

The old diagnostic set included:

```bash
docker compose -f /opt/eshop/app/compose.production.yml ps
docker compose -f /opt/eshop/app/compose.production.yml logs --tail=200 backend
docker compose -f /opt/eshop/app/compose.production.yml logs --tail=200 storefront
docker compose -f /opt/eshop/app/compose.production.yml logs --tail=200 postgres
docker stats --no-stream
journalctl -u docker -n 200 --no-pager
journalctl -u caddy -n 100 --no-pager
systemctl --failed
ss -lntp
free -h
swapon --show
```

The diagnostics remain useful, but current paths and commands are maintained in
[DEPLOYMENT.md](DEPLOYMENT.md).
