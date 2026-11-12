# Локальное развёртывание Eshop в Docker под Windows

Дополнительный локальный сценарий к [серверному мануалу](DEPLOYMENT.md).
Используются те же Dockerfile для Medusa и Next.js, но отдельный
[compose.windows.yml](compose.windows.yml), локальные образы и данные.
Это запуск собранного приложения, без hot reload. Нативный npm-сценарий
остаётся доступен по [локальному runbook](.memory-bank/runbooks/local-development.md).

## 1. Предварительные условия

- Docker Desktop запущен с WSL 2 engine и Linux containers.
- WSL имеет установленное ядро. Отдельная Ubuntu не требуется.
- Git и PowerShell 7 доступны; Node.js/npm на Windows для Docker-сборки не нужны.
- Репозиторий находится, например, в `D:\projects\eshop`.
- Порты 3000 и 9000 свободны: остановите нативные процессы приложения.
- Проверьте свободное место на диске Docker и память перед сборкой. Backend
  использует heap до 2 ГБ, дополнительно нужна память для npm, ОС и Docker.
  На машине с почти заполненным C: сначала освободите место либо перенесите
  disk image через настройки Docker Desktop. Сборки выполняются последовательно.

```powershell
Set-Location D:\projects\eshop
wsl --version
docker version
docker compose version
Get-PSDrive C, D
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in 3000,9000
```

`docker version` должен показывать Client и Server. Если ядро WSL отсутствует,
в PowerShell администратора выполните `wsl --update --web-download`, затем
перезапустите Docker Desktop. Если установщик требует перезагрузку Windows,
выполните её до дальнейших шагов.

## 2. Изоляция и адреса

| Компонент | Адрес / хранилище |
|---|---|
| Storefront | http://localhost:3000 |
| Medusa API | http://localhost:9000 |
| Medusa Admin | http://localhost:9000/app |
| PostgreSQL 16 | `postgres:5432`, только внутри Compose |
| База и пользователь | `eshop` / `eshop` |
| Данные БД | volume `eshop-local_postgres_data` |
| Загруженные изображения | volume `eshop-local_media` |

Контейнер `postgres16`, ранее созданный на `127.0.0.1:5433`, и Windows PostgreSQL
на 5432 не используются и не изменяются. Этот стек создаёт собственную пустую БД.
Production volumes, secrets и образы с тегом `production` также не используются.

Storefront разделяет network namespace backend (`network_mode: service:backend`).
Поэтому `localhost:9000` доступен и браузеру Windows, и SSR внутри Next.js.
Оба опубликованных порта объявлены у backend. После пересоздания backend
пересоздавайте storefront по процедуре ниже. Данные БД backend получает по
имени `postgres`, а не через localhost.

## 3. Локальная конфигурация

Создайте `.env.docker` в корне проекта один раз. Файл исключён существующими
правилами Git и Docker build context. Не копируйте production credentials.
Команды требуют PowerShell 7 и не перезаписывают существующую конфигурацию:

```powershell
if (Test-Path -LiteralPath .env.docker) { throw '.env.docker уже существует; отредактируйте его вручную' }
function New-LocalSecret {
    [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}
@(
    "POSTGRES_PASSWORD=$(New-LocalSecret)"
    "JWT_SECRET=$(New-LocalSecret)"
    "COOKIE_SECRET=$(New-LocalSecret)"
    'NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_build_placeholder'
    'NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=sc_build_placeholder'
) | Set-Content -Encoding utf8 -LiteralPath .env.docker

$dc = @('compose', '--env-file', '.env.docker', '-f', 'compose.windows.yml')
docker @dc config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Ошибка Compose-конфигурации' }
```

В новой вкладке PowerShell снова перейдите в корень проекта и задайте `$dc`.
Во всех командах ниже используется именно этот массив параметров.
Hex-пароль не требует URL-encoding в `DATABASE_URL`. Изменение пароля в env
не меняет пароль уже инициализированной БД — не генерируйте env повторно.

## 4. Backend и миграции

После каждой команды Docker проверяйте код возврата; при ошибке не переходите
к следующему этапу. PowerShell по умолчанию не останавливает последовательность
команд при ненулевом exit code внешней программы.

```powershell
docker @dc build backend
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
docker @dc up -d --wait postgres
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL is not healthy' }
docker @dc run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=768 --workdir /app/apps/backend/.medusa/server backend /app/node_modules/.bin/medusa db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
docker @dc up -d --wait backend
if ($LASTEXITCODE -ne 0) { throw 'Backend is not healthy' }
Invoke-RestMethod http://localhost:9000/health
```

Миграции запускаются из compiled `.medusa/server`, как на VPS. Не используйте
вместо них `db:migrate` из локального DB smoke scaffold.

Инициализируйте права на новый media volume для пользователя `node` (UID 1000):

```powershell
docker @dc run --rm --no-deps --user root backend chown -R 1000:1000 /app/apps/backend/.medusa/server/static
```

## 5. Admin, регион и каталог

Создайте локального администратора один раз; выберите собственный локальный
пароль вместо значения ниже. Команда с паролем может остаться в истории терминала.

```powershell
docker @dc exec -w /app/apps/backend/.medusa/server backend /app/node_modules/.bin/medusa user -e admin@example.test -p '<LOCAL_ADMIN_PASSWORD>'
```

Откройте http://localhost:9000/app и войдите. В Settings → Regions создайте
регион с точным именем `Москва`, валютой `RUB`, страной Russia и доступным
system/manual payment provider. Затем выполните существующий catalog seed:

```powershell
docker @dc run --rm --no-deps backend npm run seed:medusa:catalog
if ($LASTEXITCODE -ne 0) { throw 'Catalog seed failed' }
```

Seed требует существующий регион `Москва` / `rub`. Он создаёт demo-каталог,
sales channel и publishable key; повторный запуск предназначен для этого
локального набора данных. Не запускайте его против production БД.

Скопируйте из вывода `publishable_api_key` и `sales_channel_id` в соответствующие
`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` и `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID`
в `.env.docker`. Это публичные настройки, а не admin token. Не собирайте
storefront с placeholder-значениями.

## 6. Storefront

Только после успешной сборки backend и заполнения ключей:

```powershell
docker @dc build storefront
if ($LASTEXITCODE -ne 0) { throw 'Storefront build failed' }
docker @dc up -d --wait storefront
if ($LASTEXITCODE -ne 0) { throw 'Storefront is not healthy' }
docker @dc ps
Invoke-RestMethod http://localhost:9000/health
(Invoke-WebRequest http://localhost:3000/).StatusCode
```

Откройте http://localhost:3000. Проверьте каталог, карточку и добавление товара
в корзину; загрузите изображение через Admin и проверьте его `/static/...` URL.
Проверка HTTP 200 сама по себе не доказывает работоспособность каталога.

`NEXT_PUBLIC_*` встраиваются при build. После изменения ключа, sales channel
или URL требуется пересобрать storefront; одного restart недостаточно.

Google/VK login в этом профиле отключён. Поэтому полный authenticated checkout
не готов без отдельной настройки OAuth. Для неё нужны реальные local/dev
credentials, зарегистрированные callback URLs и согласованная настройка
HTTPS/cookies. `NODE_ENV=production` включает secure cookies; не отключайте
защиту в исходном коде ради локального запуска. Здесь нет Caddy/TLS и нет
проверки production OAuth. Оплата текущего MVP подтверждается оператором в Admin;
наличие `YOOKASSA_MODE=mock` не включает онлайн-платежи.

## 7. Ежедневный запуск и остановка

```powershell
docker @dc up -d --wait
docker @dc logs --tail 100 backend storefront
docker @dc stop
# Удалить контейнеры и сеть, сохранив оба тома:
docker @dc down
```

Не добавляйте `-v` к `down`: это удалит БД и изображения. Не используйте
`docker system prune --volumes` как способ исправления ошибки запуска.

## 8. Backup перед обновлением

Для согласованного локального backup остановите приложения, оставив БД:

```powershell
docker @dc stop storefront backend
$stamp = Get-Date -Format yyyyMMdd-HHmmss
$backupDir = Join-Path $env:USERPROFILE "eshop-backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
docker @dc exec -T postgres pg_dump -U eshop -Fc -f /tmp/eshop.dump eshop
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
docker @dc cp postgres:/tmp/eshop.dump (Join-Path $backupDir 'eshop.dump')
docker @dc run --rm --no-deps --user root --volume "${backupDir}:/backup" backend tar -czf /backup/media.tar.gz -C /app/apps/backend/.medusa/server/static .
Get-ChildItem -LiteralPath $backupDir
```

Храните dump и media archive вместе. Бинарный dump копируется через `docker cp`,
а не PowerShell `>`: это исключает перекодирование данных в старых PowerShell.
При ошибке копирования/архивации обновление отложите. Backup нужно проверять
восстановлением в отдельной БД, прежде чем полагаться на него для важных данных.

## 9. Обновление и восстановление

После backup обновите checkout выбранной ревизией и последовательно выполните:

```powershell
docker @dc build backend
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
docker @dc run --rm --no-deps -e NODE_OPTIONS=--max-old-space-size=768 --workdir /app/apps/backend/.medusa/server backend /app/node_modules/.bin/medusa db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
docker @dc build storefront
if ($LASTEXITCODE -ne 0) { throw 'Storefront build failed' }
# Сначала удалить старый storefront, связанный с прежним backend namespace.
docker @dc rm -f storefront
docker @dc up -d --wait --force-recreate backend
if ($LASTEXITCODE -ne 0) { throw 'Backend is not healthy' }
docker @dc up -d --wait --force-recreate storefront
```

Повторите проверки раздела 6. При ошибке миграции сохраняйте тома и логи,
исправляйте причину и повторяйте миграцию, не seed. Откат Git и пересборка
образа не отменяют миграции БД. Для восстановления данных используйте оба
файла backup в отдельном Compose-проекте с пустыми томами; не перезаписывайте
текущую БД без отдельного решения о потере изменений после backup.

## 10. Диагностика

| Симптом | Что проверить |
|---|---|
| Docker daemon недоступен | Docker Desktop, `docker version`, WSL engine |
| WSL долго готовит Docker | Первое копирование служебных образов может занять минуты; смотрите Docker Desktop, не удаляйте диск |
| Address already in use | Нативные процессы на 3000/9000; не менять только host port без CORS/URL/build args |
| PostgreSQL authentication failed | Соответствие env исходному паролю тома; restart не меняет пароль БД |
| Backend unhealthy | `docker @dc logs --tail 100 backend`, миграции и доступность postgres |
| Catalog seed требует регион | Создайте `Москва` / `RUB` в Admin до seed |
| Каталог пустой / API 401 | Publishable key, его sales channel, seed; пересборка storefront после правки env |
| SSR connection refused | Запуск через этот Compose, общий namespace; пересоздать storefront после backend |
| Upload permission denied | Инициализация владельца media volume из раздела 4 |
| Сборка OOM / no space left | `docker stats`, `docker system df`, место Windows и лимиты WSL; не запускать две сборки одновременно |

Этот runbook описывает последовательность по текущим Dockerfile и коду.
Проверка Compose-конфигурации не заменяет полный первый build и browser smoke.
