FT-008 read-only review: **REJECT**.

Проверено:

- `TASK-054..057` присутствуют в `tasks/index.json`; все task/source/spec/protocol references существуют.
- Зависимости корректны: `054 → 053 → 055 → 056 → 057`.
- Tier routing соответствует политике: `T2, T3, T3, T3`.
- Linked SDD specs и `IMPL-FT-008` согласованы, FT-008 scope и boundaries определены.
- Packet hashes совпадают с raw task records:
  - `TASK-054..056`: `ready`
  - `TASK-057`: `ready_with_gaps`
- `TASK-057` — T3 и потому не готов к исполнению: required packet не имеет статуса `ready`.
- `node scripts/mb-doctor.mjs --strict` завершился `FAIL`: `mb-lint.mjs` не запустился из-за `spawnSync ... node.exe EPERM`; warnings отсутствуют.
- Gates, `verify`, `docs`, `touched_files`, T3 checkpoint/recovery requirements присутствуют.
- Blind queue risk: downstream tasks остаются `planned`, но их продвижение корректно заблокировано зависимостями и packet readiness.

Scoped fix list:

1. Устранить средовую ошибку запуска `node.exe EPERM` и повторить `node scripts/mb-doctor.mjs --strict`.
2. Разобраться с gap в `TASK-057.packet.json`; довести packet до `ready` только после устранения причины gap.
3. После выполнения задач отдельно пройти `/verify` и требуемые T3 semantic/checkpoint/recovery gates; затем выполнить feature-level `/red-verify --feature FT-008`.

VERDICT: REJECT