# TASK-049 Execute Evidence

## COMPLETION_REPORT

- role: Implementer
- task_id: TASK-049
- stage: implementation / local gates
- touched_files:
  - `apps/backend/src/scripts/smoke-checkout-delivery-acceptance.ts`
  - `apps/backend/test/run-integration.cjs`
  - `apps/backend/package.json`
  - `apps/storefront/e2e/run-real-medusa-e2e.cjs`
  - `apps/storefront/package.json`
  - `.memory-bank/changelog.md`
- changes:
  - Added real compiled Medusa backend acceptance over local PostgreSQL and
    Admin/Shipping Options synthetic fixtures.
  - Added real browser acceptance through local Google provider double,
    Medusa callback/session cookie, authenticated-ready checkout gate, and
    storefront/backend HTTP boundary.
  - Added browser fixture phases for live Admin-option unavailability and
    unconditional cleanup; browser artifacts omit request bodies/cookies.
  - Preserved standard Medusa parser and deferred malformed-JSON normalization.
- scope_compliance: yes.
- forbidden_scope_touched: no.

## Evidence

Backend acceptance PASS:

- `npm --workspace apps/backend run test:integration -- checkout-delivery-acceptance`
- Real boundary: compiled Medusa HTTP → standard session/bearer middleware →
  checkout route/workflow → Admin Shipping Options/price-set links → PostgreSQL.
- Auth: guest `401 checkout_auth_required`; bearer and session-cookie requests
  `200`; client-submitted `customer_id` rejected with sanitized `400`.
- Delivery: IDs/order `pickup`, `city_courier`, `transport_company`; configured
  tariffs `0`, `500`, `700 RUB`; no fallback after removing transport option.
- Fields: `name`, `email`, `phone`, `city` required; courier/transport address
  required; pickup address optional; comment optional.
- Validation: normalization precedes limit (`120` normalized chars accepted,
  `121` rejected); all four required-field failures and unsupported payment are
  sanitized.
- Payment IDs: `card`, `sbp`, `sberpay` each returned by the backend handoff.
- Unavailable: real HTTP `422 delivery_method_unavailable`, exact method detail,
  `substituted: false`.
- Non-mutation: order/payment-collection/reservation counts stayed
  `0 -> 0`; source read-only scan found no FT-007/FT-009 mutation/provider call;
  `providerRequest`, `orderMutation`, `inventoryMutation`, and `paymentMutation`
  were all false.
- Privacy/cleanup: synthetic values only, no production data; session, compiled
  server, Admin fixtures, API key, customer, and ports cleaned in final paths.

Browser acceptance PASS:

- `npm --workspace apps/storefront run test:e2e -- checkout-delivery`
- Real boundary: local Google provider double → Medusa callback/session cookie →
  Next storefront → real `POST /store/checkout`.
- Entry: guest was routed to `/login`; provider callback established a real
  session; only `authenticated_ready` rendered the FT-006 form.
- UI: all contact/comment fields, conditional address, stable delivery/payment
  IDs, backend response tariffs/payment IDs, and local validation error were
  observed.
- Recovery: after the synthetic Admin transport option was removed, the browser
  received live HTTP `422 delivery_method_unavailable`; transport remained
  selected until an explicit pickup selection and successful retry.
- Browser did not issue order, inventory, payment, or provider requests.
- Artifacts: `.tasks/TASK-049/playwright/checkout-browser-report.json` and
  `checkout-delivery.png`; no Playwright trace was written for this sensitive
  suite, and the report omits synthetic request values, cookies, and tokens.
- Cleanup: browser, storefront, backend, synthetic Admin options, temporary
  state, and ports were released after the passing run.

## Commands run

- PASS `node --check apps/backend/test/run-integration.cjs`
- PASS `node --check apps/storefront/e2e/run-real-medusa-e2e.cjs`
- PASS `git diff --check` (only existing LF/CRLF warnings)
- PASS `npm --workspace apps/backend run typecheck`
- PASS `npm --workspace apps/backend run test:integration -- checkout-delivery-acceptance`
- PASS `npm --workspace apps/storefront run test:e2e -- checkout-delivery`
- PASS run-ID propagation and first-page timeout remediation reruns; all failed
  attempts completed fixture/server/port cleanup.
- PENDING at report creation: workspace typecheck, workspace build,
  `node scripts/mb-lint.mjs`, final privacy/diff scan.

## Handoff

- Packet context used: `.memory-bank/packets/TASK-049.packet.json`.
- Scope: yes; forbidden scope: no.
- `/verify`, `/red-verify`, task status, packet, dependents, closure markers,
  and `/mb-sync` remain untouched.
- Recommended next owner: scheduler/explicit owner for sequential remaining
  gates, `/verify`, per-task T3 `/red-verify`, human checkpoint, rollback note,
  and lifecycle decision.

COMPLETION_REPORT
