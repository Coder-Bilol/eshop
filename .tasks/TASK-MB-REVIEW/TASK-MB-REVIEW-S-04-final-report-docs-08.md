Проведён read-only security/privacy review только для FT-008 с учётом REQ-022/028/029 и зависимостей FT-007.

### Findings

- **P1 — недостаточно формализована граница Admin-оператора.**  
  FT-008 разрешает `source: "medusa_admin"` и описывает Admin как operator surface, но не фиксирует обязательную проверку Admin authentication/role/permission внутри вызывающей границы. Это создаёт риск unauthorized lifecycle mutation (OWASP Broken Access Control).  
  Evidence: `contracts/order-lifecycle-admin-api.md:15-39`, `:83-90`; `architecture/order-lifecycle-admin-runtime.md:22-24`.

- **P1 — доверие к источнику события остаётся декларативным.**  
  Workflow принимает строковое поле `source`; контракт говорит, что событие «уже authenticated by its owning boundary», но не требует технического binding между source и проверенным caller/context. Ошибка интеграции может позволить вызвать `payment_succeeded`/`payment_refunded` из неподходящего пути.  
  Evidence: `contracts/order-lifecycle-admin-api.md:21-39`, `:61-70`.

- **P2 — replay/idempotency покрыты только частично в FT-008.**  
  Safe no-op для уже применённого состояния определён, но durable provider-event replay ledger и provider/payment identity принадлежат FT-009. Это не FT-008-specific defect, однако FT-008 нельзя считать payment-safe без обязательного verified handoff contract и integration evidence от FT-009.  
  Evidence: `tech-specs/FT-008...md:21-24`, `:45`, `:83-98`; `contracts/order-lifecycle-admin-api.md:57-59`, `:83-90`.

- **P2 — refund/cancel authorization и audit scope недостаточно конкретны.**  
  Спецификация запрещает metadata-only cancellation captured payment, но не определяет actor permission, audit actor и audit event для операторского cancel/refund path.  
  Evidence: `contracts/order-lifecycle-admin-api.md:67-70`; `states/order-lifecycle-admin.md:47-53`.

### Что выглядит корректно

- FT-007 actor ownership, server-side re-read, idempotency key, compensation и expiry/release описаны последовательно.
- Клиент не является authority для order items, prices, inventory IDs, status или expiration.
- FT-008 не удаляет reservation при payment capture; fulfillment остаётся владельцем consumption.
- Provider secrets, webhook secrets, raw payloads и лишний PII исключены из lifecycle metadata и test evidence.
- Storefront route для lifecycle mutation отсутствует, что снижает IDOR/CSRF-риск.
- Contradictory transitions fail closed; повтор текущего состояния — no-op.
- OWASP injection/secrets exposure/logging risks явно ограничены, но требуют runtime verification.

### Scoped fix list

1. В FT-008 contract/runtime явно потребовать caller-context binding:
   - `medusa_admin` — authenticated Admin session + required operator permission;
   - `yookassa_webhook` — only FT-009 verified handoff;
   - `pending_order_expiry` — only FT-007 expiry workflow.
2. Запретить публичный/произвольный вызов lifecycle workflow по одному `order_id + source`.
3. Зафиксировать authorization и audit requirements для operator cancel/refund paths.
4. Добавить acceptance evidence для unauthorized Admin actor, forged source, replayed event и cross-order mutation.
5. Считать FT-009 authenticity/durable replay ledger обязательным dependency gate, а не заменять его FT-008 state no-op.

VPS root-password issue найден только в `DEPLOYMENT.md`/`DEPLOYMENT_HANDOFF.md`; это remote deployment concern и не является FT-008-specific blocker.

VERDICT: REJECT