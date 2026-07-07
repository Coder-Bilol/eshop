# Развёртывание Eshop на текущем сервере

## Назначение

Этот документ описывает подготовку текущего AlmaLinux-сервера и KISS-процесс
развёртывания Eshop через Docker Compose.

Принятые решения:

- Docker обязателен для production deployment.
- Codex CLI на сервере не используется.
- Управление сервером выполняется локальным агентом через SSH.
- Redis не разворачивается, пока его нет в конфигурации приложения.
- PostgreSQL, Medusa backend и Next.js storefront работают в контейнерах.
- Caddy работает на host и проксирует HTTPS-трафик в контейнеры.
- Kubernetes, PM2, отдельный Medusa worker и monitoring stack не используются.
- Production images по возможности собираются вне сервера.

## Текущие параметры сервера

Снимок состояния на 2026-07-04:

| Параметр | Значение |
|---|---|
| ОС | AlmaLinux 9.8 |
| Архитектура | `x86_64` |
| CPU | 1 vCPU |
| RAM | 769 MB |
| Swap | 511 MB |
| Диск | 15 GB, свободно около 11 GB |
| Текущее ядро | `5.14.0-362.24.2.el9_3.x86_64` |
| Установленное новое ядро | `5.14.0-687.20.1.el9_8.x86_64` |
| Node.js на host | `v24.14.1`, не используется runtime-контейнерами |
| npm на host | `11.11.0`, не используется runtime-контейнерами |
| Codex CLI на host | установлен, но не входит в deployment workflow |
| Docker | не установлен |
| Git | не установлен |
| Caddy | не установлен |
| Firewall | `firewalld`, разрешены `ssh`, `cockpit`, `dhcpv6-client` |
| SELinux | отключён |
| Слушающие порты | только SSH `22` |

Сервер существенно ограничен по памяти. Он не подходит для параллельных сборок
и нескольких экземпляров приложения. Сначала разворачивается один backend,
один storefront и один PostgreSQL.

## Целевая схема

```text
Локальный Codex CLI / оператор
             |
             | SSH
             v
      AlmaLinux server
             |
             +-- Caddy (host, ports 80/443)
             |      |
             |      +-- 127.0.0.1:3000 -> storefront container
             |      |
             |      +-- 127.0.0.1:9000 -> backend container
             |
             +-- Docker Compose
                    |
                    +-- postgres
                    +-- backend
                    +-- storefront
```

PostgreSQL не публикует порт на host. Backend и storefront публикуют порты
только на `127.0.0.1`, поэтому к ним нельзя подключиться напрямую из Internet.

## Что должно появиться в репозитории

Сейчас в проекте отсутствуют Docker deployment artifacts. До первого
развёртывания должны быть реализованы и локально проверены:

```text
.dockerignore
apps/backend/Dockerfile
apps/storefront/Dockerfile
compose.production.yml
```

Требования к ним:

- multi-stage production images;
- Linux platform `linux/amd64`;
- фиксированные major/minor base images, не плавающий `latest`;
- backend image содержит результат `medusa build`;
- storefront image содержит production build Next.js;
- контейнеры не запускают dev servers;
- application containers не запускаются с `privileged: true`;
- Docker socket не монтируется внутрь контейнеров;
- PostgreSQL data хранится в named volume;
- PostgreSQL не имеет секции `ports`;
- backend публикуется как `127.0.0.1:9000:9000`;
- storefront публикуется как `127.0.0.1:3000:3000`;
- все сервисы имеют health checks и `restart: unless-stopped`;
- Redis service и `REDIS_URL` отсутствуют;
- secrets не встраиваются в images и не коммитятся.

Рекомендуемые базовые images:

- backend/storefront: `node:24-bookworm-slim`;
- database: зафиксированный PostgreSQL image, например `postgres:16-alpine`;
- точные версии фиксируются при реализации Dockerfiles и проверяются тестами.

Первое production deployment заблокировано, пока эти файлы не созданы и не
прошли локальный build/smoke.

## Что не устанавливаем

Пока соответствующая зависимость не появится в коде или deployment design, не
устанавливать:

- Redis;
- PM2;
- Kubernetes;
- отдельный Medusa worker;
- message broker;
- Prometheus/Grafana/ELK;
- PostgreSQL на host;
- Node.js dependencies на host для запуска приложения.

## Данные, необходимые до начала

Нужно определить:

- Git URL репозитория и способ доступа;
- production branch или точный commit/tag;
- container registry и credentials либо другой способ доставки images;
- домен storefront, например `shop.example.ru`;
- домен backend/Admin, например `api.example.ru`;
- production environment values;
- внешнее место для PostgreSQL backups.

DNS `A`-записи обоих доменов должны указывать на сервер до выпуска TLS
сертификата.

## 1. Подготовка AlmaLinux

### 1.1. Перезагрузка после обновления ядра

На сервере установлено более новое ядро, но оно ещё не загружено.

Перед перезагрузкой:

```bash
dnf check
systemctl --failed
```

Перезагрузка:

```bash
reboot
```

После повторного подключения:

```bash
uname -r
systemctl --failed
```

### 1.2. Увеличение swap

Текущих 511 MB swap недостаточно даже для аварийной сборки images на сервере.
Добавить 1.5 GB swap, чтобы общий объём был примерно 2 GB:

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

До выполнения убедиться, что файл и строка в `/etc/fstab` ещё не существуют.
Swap предотвращает OOM, но не делает параллельные сборки безопасными.

### 1.3. Минимальные host packages

```bash
dnf install -y git dnf-plugins-core
dnf -y copr enable @caddy/caddy
dnf install -y caddy
caddy version
```

PostgreSQL и application runtime на host не устанавливаются.

## 2. Установка Docker Engine и Compose

Использовать официальный Docker RPM repository для RHEL 9:

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

Проверка:

```bash
docker version
docker compose version
systemctl status docker --no-pager
docker run --rm hello-world
```

Не использовать convenience script `get.docker.com` для production server.

## 3. Каталоги и secrets

### 3.1. Каталог deployment

```bash
mkdir -p /opt/eshop
git clone <REPOSITORY_URL> /opt/eshop
cd /opt/eshop
git checkout <PRODUCTION_BRANCH_OR_TAG>
```

Host-каталог содержит Compose-файл и deployment metadata. Source code может
также использоваться для аварийной сборки, но штатно server должен получать
готовые production images.

### 3.2. Production environment

Создать отдельный каталог:

```bash
mkdir -p /opt/eshop/secrets
chmod 700 /opt/eshop/secrets
```

Рекомендуемые файлы:

```text
/opt/eshop/secrets/compose.env
/opt/eshop/secrets/postgres.env
/opt/eshop/secrets/backend.env
/opt/eshop/secrets/storefront.env
```

Права:

```bash
chmod 600 /opt/eshop/secrets/*.env
```

Локальный project `.env` нельзя копировать на сервер: он содержит локальные
настройки и SSH-доступ. Production files должны создаваться отдельно.

### 3.3. Compose environment

Пример `/opt/eshop/secrets/compose.env`:

```dotenv
ESHOP_VERSION=<COMMIT_SHA_OR_RELEASE_TAG>
BACKEND_IMAGE=<REGISTRY>/eshop-backend
STOREFRONT_IMAGE=<REGISTRY>/eshop-storefront
```

Images должны использовать immutable tag, например Git commit SHA. Не
использовать `latest` для production и rollback.

### 3.4. PostgreSQL environment

Пример `/opt/eshop/secrets/postgres.env`:

```dotenv
POSTGRES_DB=eshop
POSTGRES_USER=eshop
POSTGRES_PASSWORD=<RANDOM_DATABASE_PASSWORD>
```

### 3.5. Backend environment

Пример `/opt/eshop/secrets/backend.env`:

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

Секреты генерируются отдельно:

```bash
openssl rand -hex 32
```

OAuth, YooKassa и SMTP variables добавляются только после появления и
production-готовности соответствующей функциональности. Redis variables не
добавлять.

### 3.6. Storefront environment

Пример `/opt/eshop/secrets/storefront.env`:

```dotenv
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.example.ru
NEXT_PUBLIC_STOREFRONT_URL=https://shop.example.ru
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<PRODUCTION_PUBLISHABLE_KEY>
NODE_OPTIONS=--max-old-space-size=192
```

`NEXT_PUBLIC_*` values встраиваются в storefront во время image build. Эти
значения должны передаваться как build arguments или build environment без
попадания secrets в image layers. После их изменения image storefront нужно
пересобрать.

## 4. Сборка и доставка images

### 4.1. Предпочтительный путь

Из-за 769 MB RAM production images нужно собирать:

- в CI;
- на локальной машине с Docker;
- на отдельном build host.

Результат публикуется в container registry с tag, равным commit SHA:

```text
<REGISTRY>/eshop-backend:<COMMIT_SHA>
<REGISTRY>/eshop-storefront:<COMMIT_SHA>
```

Server только скачивает и запускает готовые images:

```bash
cd /opt/eshop
docker login <REGISTRY>

docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  pull
```

Registry credentials не хранить в репозитории.

### 4.2. Аварийная сборка на сервере

Сборка на сервере допустима только если registry недоступен. Сервисы
останавливаются, images собираются строго последовательно:

```bash
cd /opt/eshop
docker compose -f compose.production.yml stop backend storefront

COMPOSE_PARALLEL_LIMIT=1 \
  docker compose -f compose.production.yml build backend

COMPOSE_PARALLEL_LIMIT=1 \
  docker compose -f compose.production.yml build storefront
```

Во время сборки контролировать:

```bash
free -h
df -h /
docker system df
```

Не запускать `docker compose build` без указания одного service.

## 5. Первое развёртывание

### 5.1. PostgreSQL

```bash
cd /opt/eshop

docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  up -d postgres
```

Проверить health:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 postgres
```

PostgreSQL volume нельзя удалять командами `docker compose down -v` или
`docker volume rm`.

Для ограниченного сервера PostgreSQL должен использовать консервативную
конфигурацию:

```text
shared_buffers=64MB
work_mem=2MB
maintenance_work_mem=32MB
max_connections=30
```

Эти параметры задаются в Compose command/config и проверяются до production.

### 5.2. Database migrations

До запуска backend:

```bash
docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  run --rm backend npm run db:migrate:medusa
```

Seed разрешён только при первом создании пустой production database и после
проверки seed script:

```bash
docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  run --rm backend npm run db:seed
```

Повторный seed без подтверждённой идемпотентности запрещён.

### 5.3. Backend и storefront

```bash
docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  up -d backend storefront
```

Проверка:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 backend
docker compose -f compose.production.yml logs --tail=100 storefront

curl -fsS http://127.0.0.1:9000/health
curl -fsSI http://127.0.0.1:3000/
```

## 6. Caddy, firewall и TLS

### 6.1. Caddy

Создать `/etc/caddy/Caddyfile`, заменив домены:

```caddyfile
api.example.ru {
    reverse_proxy 127.0.0.1:9000
}

shop.example.ru {
    reverse_proxy 127.0.0.1:3000
}
```

Проверить и запустить:

```bash
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl status caddy --no-pager
```

Caddy сам сохраняет исходный `Host` и выставляет `X-Forwarded-*` headers при
`reverse_proxy`, поэтому дополнительные proxy headers здесь не задаются.

### 6.2. Firewall

Если Cockpit не используется:

```bash
firewall-cmd --permanent --remove-service=cockpit
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
firewall-cmd --list-all
```

Открыты должны быть только `22`, `80`, `443`.

Docker может добавлять собственные iptables rules, поэтому application ports
обязательно привязываются к `127.0.0.1`, а PostgreSQL port не публикуется.

### 6.3. TLS

После настройки DNS, открытия портов `80/443` и успешного запуска Caddy TLS
выпускается и продлевается автоматически. Отдельный ACME client не нужен.

```bash
journalctl -u caddy -n 100 --no-pager
curl -fsSI https://shop.example.ru/
curl -fsS https://api.example.ru/health
```

## 7. Проверка первого deployment

```bash
systemctl --failed
systemctl status docker caddy --no-pager

docker compose -f /opt/eshop/compose.production.yml ps
docker stats --no-stream

curl -fsS https://api.example.ru/health
curl -fsSI https://shop.example.ru/

free -h
df -h /
docker system df
```

Вручную проверить:

- storefront открывается по HTTPS;
- backend health отвечает успешно;
- Medusa Admin доступен по `https://api.example.ru/app`;
- storefront обращается к production backend;
- PostgreSQL port недоступен извне;
- после reboot Docker, Caddy и Compose services запускаются автоматически.

## 8. Последующие deployment

Текущий сервер не рассчитан на zero-downtime deployment. Допустим короткий
downtime.

### 8.1. Перед обновлением

Зафиксировать текущую версию:

```bash
cd /opt/eshop
grep '^ESHOP_VERSION=' /opt/eshop/secrets/compose.env
docker compose -f compose.production.yml ps
```

Создать database backup:

```bash
mkdir -p /var/backups/eshop

docker compose -f /opt/eshop/compose.production.yml \
  exec -T postgres \
  pg_dump -U eshop -Fc eshop \
  > /var/backups/eshop/eshop-$(date +%Y%m%d-%H%M%S).dump
```

Проверить, что backup не пуст:

```bash
ls -lh /var/backups/eshop/
```

Backup обязательно копируется во внешнее хранилище. Backup на том же VPS не
защищает от потери диска.

### 8.2. Обновление

```bash
cd /opt/eshop
git fetch --prune
git checkout <PRODUCTION_BRANCH_OR_TAG>
git pull --ff-only
```

Обновить `ESHOP_VERSION` на новый immutable image tag, затем:

```bash
docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  pull backend storefront

docker compose -f compose.production.yml stop storefront backend

docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  run --rm backend npm run db:migrate:medusa

docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  up -d backend storefront
```

После запуска выполнить проверки из раздела 7.

## 9. Rollback

Images предыдущего deployment сохраняются с immutable tag.

Для отката:

1. Вернуть предыдущее значение `ESHOP_VERSION`.
2. Запустить:

```bash
cd /opt/eshop

docker compose \
  --env-file /opt/eshop/secrets/compose.env \
  -f compose.production.yml \
  up -d backend storefront
```

3. Выполнить health checks.

Rollback application images не откатывает database migrations. Перед каждой
миграцией обязателен backup. Восстановление database выполняется только после
отдельного решения, поскольку заменяет production data.

## 10. Очистка диска

На сервере только около 11 GB свободного места. После успешного deployment и
проверенного rollback tag:

```bash
docker image ls
docker system df
docker image prune
```

Не запускать без отдельной проверки:

```bash
docker system prune -a
docker volume prune
docker compose down -v
```

Эти команды могут удалить rollback images или production data.

## 11. Диагностика

```bash
docker compose -f /opt/eshop/compose.production.yml ps
docker compose -f /opt/eshop/compose.production.yml logs --tail=200 backend
docker compose -f /opt/eshop/compose.production.yml logs --tail=200 storefront
docker compose -f /opt/eshop/compose.production.yml logs --tail=200 postgres

docker stats --no-stream
docker system df

journalctl -u docker -n 200 --no-pager
journalctl -u caddy -n 100 --no-pager

systemctl --failed
ss -lntp
free -h
swapon --show
df -h /
```

Не выводить в logs production secrets, OAuth tokens, платёжные данные и
персональные данные покупателей.

## 12. Работа локального Codex CLI

Codex CLI работает на Windows-машине с проектом и подключается к серверу через
SSH только для ограниченных deployment-команд:

```powershell
ssh root@<SERVER_IP> "cd /opt/eshop && docker compose -f compose.production.yml ps"
```

Codex CLI на сервере не запускается и не является частью runtime или
deployment. Долгие операции Docker выполняются в фоне либо через SSH с
повторной проверкой состояния.

## Порядок дальнейших действий

1. Создать и проверить Dockerfiles и `compose.production.yml` в проекте.
2. Определить registry и immutable image tags.
3. Перезагрузить сервер на новое ядро.
4. Увеличить общий swap примерно до 2 GB.
5. Установить Docker Engine, Compose plugin, Git и Caddy.
6. Настроить каталоги и production secrets.
7. Собрать images вне сервера и опубликовать их в registry.
8. Запустить PostgreSQL container.
9. Выполнить migrations.
10. Запустить backend и storefront containers.
11. Настроить Caddy, firewall, DNS и TLS.
12. Выполнить health checks и проверку после reboot.
13. Настроить внешний PostgreSQL backup до приёма реальных заказов.
