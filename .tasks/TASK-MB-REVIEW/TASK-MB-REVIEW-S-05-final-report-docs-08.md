Роль GENERAL

## Итог

FT-008 MBB compliance review: **REJECT**.

## Evidence

- `node scripts/mb-lint.mjs` — PASS, 144 файла.
- `node scripts/mb-doctor.mjs --strict` — FAIL:
  - `MB_LINT_FAILED`: внутренний `spawnSync ... node.exe EPERM`;
  - 1 error, 0 warnings.
- FT-008 specs зарегистрированы в `spec-index.md`; routers и changelog содержат FT-008/TASK-054..057.
- FT-008 linked docs имеют frontmatter и согласованную нормативную цепочку.
- TASK-054..057 имеют records и packets; tiers согласованы.
- TASK-057 packet имеет статус `ready_with_gaps`.

## Blocking findings

1. **Нарушение запрета `.tasks` leakage.** Durable Memory Bank содержит ссылки на `.tasks/**` в feature/epic/requirements/changelog/bug docs и command docs. Примеры:
   - `.memory-bank/epics/EP-003-checkout-order-inventory.md`
   - `.memory-bank/features/FT-005-authenticated-wishlist.md`
   - `.memory-bank/requirements.md`
   - `.memory-bank/changelog.md`

2. **Strict doctor не проходит.** Даже если причина выглядит средовой (`EPERM` при дочернем запуске Node), строгий gate остаётся красным и требует воспроизводимого успешного запуска.

3. **TASK-057 packet не готов полностью:** `status: ready_with_gaps`; требуется устранить gaps или явно зафиксировать допустимое исключение до task-queue readiness.

## Scoped fix list

- Убрать `.tasks/**` из durable navigation/source docs либо заменить на допустимые operational references по правилам MBB.
- Повторить `mb-doctor --strict` в окружении, где разрешён дочерний запуск `node.exe`, и сохранить PASS evidence.
- Разобрать и закрыть gaps в `TASK-057.packet.json`, затем повторить FT-008-only review.

VERDICT: REJECT