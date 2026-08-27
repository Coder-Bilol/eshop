Проведён read-only review FT-008 scope/RTM.

Итог: трассировка REQ-022/028/029 → EP-003 → FT-008 → TASK-054..057 в целом присутствует; lifecycle и статусы согласованы как `planned`, задачи корректно маршрутизированы в T2/T3 с зависимостями и packet gates.

Найдено:

- Небольшой RTM drift: `IMPL-FT-008.md:143` указывает TASK-054 как покрытие REQ-028, но TASK-054 содержит только `reqs: ["REQ-022"]` и не проверяет Admin visibility. Фактическое покрытие REQ-028 начинается с TASK-056/TASK-057.
- Acceptance FT-008 сформулирован корректно, но минимально: подробное покрытие Admin-полей и lifecycle edge cases находится только в implementation plan и task records. Это не блокирует выполнение, но требует сохранять IMPL как нормативную детализацию.
- `product-brief.md` остаётся `draft`, однако соответствующий delta Windows-native development явно зафиксирован в PRD и отражён в FT-008 scope не затрагивается. Scope drift для REQ-022/028/029 не обнаружен.
- EP-003, FT-008 и REQ-022/028/029 имеют согласованный lifecycle `planned`; преждевременной promotion/status drift нет.
- Workflow routing корректен: TASK-054 T2; TASK-055..057 T3; последовательность зависимостей и требование feature-level `/red-verify --feature FT-008` согласуются с tier policy.

Scoped fix list:

1. Исправить только coverage table в [IMPL-FT-008.md](D:/projects/eshop/.memory-bank/tasks/plans/IMPL-FT-008.md:140): убрать TASK-054 из покрытия REQ-028 либо явно добавить ему Admin acceptance scope (предпочтительно убрать).
2. При следующем `/mb-sync` проверить, что RTM сохраняет REQ-028/029 как `planned` до закрытия TASK-056/057 и feature-level semantic review.
3. Файлы и статусы в рамках review не изменялись.

VERDICT: APPROVE