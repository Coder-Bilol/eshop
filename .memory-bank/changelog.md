---
description: Лог изменений Memory Bank.
status: active
---
# Changelog

## [2026-08-21] Final review remediation and durable-state reconciliation
- Reconciled: T2 task, T2 feature, and T3 closure wording now exactly follows
  tier policy across architecture and testing docs.
- Clarified: safe non-production local-development runtime/tooling routes T1/T2
  by blast radius and cross-module/data scope; remote/shared deployment and
  staging/production runtime impact remains mandatory T3. This preserves the
  evidence-backed FT-011/TASK-003 classification without a production downgrade.
- Clarified: PostgreSQL owns durable structured data, while deployment-owned
  persistent media is the durable blob store; database dumps and media archives
  form one backup/recovery set.
- Mapped: FT-007 `checkout_state: expired` is an audit/retry reason projection
  over global/native `canceled`, removing the peer-state contradiction.
- Updated: the backbone now records FT-007 Medusa status, reservation,
  expiry/release, and idempotency decisions as resolved; FT-008/FT-009 retain
  only their genuine finalization/Admin projection questions.
- Decided: authoritative SDD specs are the accepted decision records for the
  current KISS strategy; `ADR-000` is a non-normative template for exceptional
  cross-spec decisions.
- Reconciled: removed the unsupported Telegram identity-label Product Brief ->
  PRD delta, restored the 30-item FR/REQ sequence, and synchronized REQ-030 and
  EP-005 to verified FT-011 evidence.
- Repaired: architecture, contract, domain, state, tech-spec, and implementation-
  plan routers; IMPL-FT-004 now includes completed follow-up TASK-043.
- Clarified: operator policy categorically preserves root password
  authentication; the runbook and handoff forbid SSH hardening under that policy.
- Blocked externally: the last verified public VPS state still permits root
  password authentication, and the VPS provider currently blocks server access
  while resolving provider-side errors. No live SSH change or re-verification is
  possible from this workspace.

## [2026-08-21] FT-007 / TASK-052 and TASK-053 scheduler closure
- Closed: TASK-052 and feature-review follow-up TASK-053 with functional
  `VERDICT: PASS`, per-task `SEMANTIC_VERDICT: semantic-pass`, exact T3
  checkpoint/recovery markers, matching final packets, and real
  Medusa/PostgreSQL/Edge evidence.
- Added: authenticated checkout-to-pending-order UI/runtime handoff with a
  browser UUID idempotency key, truthful unconfirmed-payment state, sanitized
  retry errors, provider isolation, privacy-safe post-cleanup artifacts, and no
  client-authoritative cart/order totals.
- Fixed: terminal `checkout_state: expired` no longer hides an already bound
  idempotency key; expired same-key replay returns stable
  `409 checkout_idempotency_conflict` with no replacement order/reservation.
- Verified: native pending order, line-linked reservation, in-window replay,
  stock conflict, post-order compensation, controlled 72-hour expiry/release,
  terminal replay conflict, cleanup, workspace build, lint, strict doctor, and
  final FT-007 feature `semantic-pass`.
- Reconciled: FT-007 and REQ-018/REQ-019/REQ-021 to `verified`; EP-003 remains
  `planned` because FT-008 complete lifecycle/Admin visibility is still planned.

## [2026-08-20] Storefront hero canvas motion
- Added: buyer-facing home hero with a lightweight canvas product-universe animation,
  pointer response, responsive sizing, and reduced-motion fallback.
- Preserved: backend-driven catalog source, existing catalog filters, cart/auth/wishlist
  boundaries, and no new Three.js/runtime dependency.
- Verified: storefront typecheck, unit suites, production build, and browser smoke for
  canvas rendering, catalog anchor navigation, and reduced-motion behavior.

## [2026-08-20] TASK-051 scheduler closure sync
- Closed: TASK-051 as `done` after required packet/spec gates, real
  Medusa/PostgreSQL expiry evidence, functional `VERDICT: PASS`, per-task
  `SEMANTIC_VERDICT: semantic-pass`, and exact T3 checkpoint/recovery markers.
- Reconciled: REQ-021 lifecycle to `verified`; FT-007 remains `implemented`
  because TASK-052 still owns storefront handoff and full runtime acceptance;
  EP-003 remains `planned` for downstream FT-007/FT-008 work.
- Preserved: native Medusa order/reservation ownership, retryable cleanup,
  no-provider boundary, TASK-052 status, and scheduler-only dependent promotion.

## [2026-08-20] TASK-051 pending-order expiry implementation handoff
- Fixed: the expiry workflow now relies on native Medusa cancellation for the
  normal reservation release and performs explicit line-item deletion only for
  retrying an already-canceled order with pending cleanup, avoiding a duplicate
  release attempt.
- Hardened: the local integration harness validates deterministic simulated
  cleanup errors across native and serialized Medusa workflow error shapes.
- Verified locally: real Medusa/PostgreSQL expiry integration, backend typecheck,
  full workspace build, and Memory Bank lint pass; paid, canceled, future, and
  non-pending orders remain unchanged, partial cleanup recovers, and provider
  traffic remains absent. TASK-051 stays `in_progress` pending independent
  `/verify`, per-task `/red-verify`, T3 markers, scheduler closure, and sync.

## [2026-08-16] TASK-050 scheduler closure sync
- Reconciled: authoritative TASK-050 state as `done` with `VERDICT: PASS`,
  `SEMANTIC_VERDICT: semantic-pass`, `HUMAN_CHECKPOINT: done`, and
  `ROLLBACK_RECOVERY_NOTE: present` across task, protocol, packet, and evidence
  links.
- Updated: REQ-018 and REQ-019 RTM lifecycle to `verified`; FT-007 lifecycle to
  `implemented` while REQ-021 and the feature-level completion remain pending
  TASK-051/TASK-052.
- Preserved: EP-003 lifecycle and TASK-051/TASK-052 statuses; no dependent
  promotion, implementation source/test change, or closure decision was inferred.

## [2026-08-16] TASK-050 post-order reservation compensation harness
- Added: a local-only workflow seam and real Medusa/PostgreSQL smoke scenario
  that reaches native order creation, forces the native reservation step to fail,
  and verifies native compensation leaves order and reservation counts unchanged.
- Preserved: the Store API does not expose or pass the harness flag; normal
  customer/cart idempotency behavior, native Medusa boundaries, and no-provider
  behavior remain unchanged.

## [2026-08-16] TASK-050 pending-order implementation handoff
- Added: authenticated `POST /store/checkout/order` middleware/route validation,
  server-owned pending-order metadata, native Medusa order creation, inventory
  reservation linkage, idempotency replay, sanitized conflicts, and compensation
  handling without payment-provider traffic or direct stock mutation.
- Added: real Medusa/PostgreSQL pending-order smoke coverage for guest rejection,
  one pending order, 72-hour expiry, one line-linked reservation, same-key retry,
  changed-key retry, mismatched-body conflict, stock conflict, and no partial
  state.
- Fixed/verified: customer/cart-scoped workflow locking and pending-order lookup
  prevent a second idempotency key from creating a second pending order for one
  active checkout; root and backend Medusa builds, backend typecheck, pending-order
  integration, and Memory Bank lint pass. Task status remains `in_progress`.

## [2026-08-16] FT-007 feature design and task decomposition
- Added: FT-007 SDD hub plus pending-order runtime, API, durable data, and
  lifecycle specs based on the installed Medusa v2.16 workflows/modules.
- Decided: native Medusa order `status: "pending"` maps to product
  `checkout_state: "pending_payment"`; `reserveInventoryStep` and reservation
  items own stock holds, with workflow compensation and an hourly expiry job.
- Added: implementation plan and T3 tasks TASK-050..TASK-052 with required
  execution packets. No FT-007 implementation or task execution was started.

## [2026-08-16] TASK-049 / FT-006 scheduler closure
- Verified: TASK-049 passed the real compiled Medusa/PostgreSQL backend acceptance,
  storefront browser acceptance, T3 functional verification, and adversarial
  semantic verification.
- Preserved: the standard Medusa parser, Admin/Shipping Options tariff source,
  authenticated actor-derived ownership, and the no-order/no-payment-provider
  boundary. Local production data and provider requests remained absent.
- Reconciled: FT-006 and REQ-013 through REQ-017 are `verified`; EP-003 remains
  `planned` for its downstream order/inventory features. The full queue is terminal.

## [2026-08-15] TASK-049 final FT-006 runtime acceptance harness
- Added: real compiled Medusa/PostgreSQL backend acceptance for authenticated
  checkout, Admin Shipping Options tariffs/order, normalization-before-limit,
  conditional fields, stable payment IDs, sanitized errors, unavailable
  delivery, transient handoff, and no order/inventory/payment/provider mutation.
- Added: real storefront Playwright acceptance through the local Google provider
  double and Medusa session cookie, including authenticated checkout entry,
  backend-confirmed tariff/payment responses, live `422 delivery_method_unavailable`
  recovery, no silent substitution, and sanitized browser evidence.
- Preserved: standard Medusa body parser and deferred malformed-JSON decision;
  no production checkout/auth/parser/UI, Medusa Core, FT-007, or FT-009 code was
  changed. Synthetic Admin fixtures, browser session, server, and ports clean up
  unconditionally through the acceptance harness paths.

## [2026-08-15] TASK-048 buyer-facing checkout continuation
- Added: authenticated checkout form/state/client continuation behind the existing
  `authenticated_ready` gate, covering contact fields, conditional address,
  stable delivery/payment selections, backend validation, and transient handoff.
- Added: backend-resolved selected delivery tariff display, sanitized validation and
  unavailable/error recovery with retry or explicit alternative selection; no client
  tariff table, browser-authoritative checkout storage, order, or provider call was
  introduced.
- Verified: storefront-focused checkout form/state tests and typecheck passed;
  implementation remains pending independent `/verify TASK-048` and later FT-006
  feature semantic verification.

## [2026-08-15] TASK-047 real Medusa HTTP checkout evidence
- Added: compiled Medusa HTTP evidence through the configured synthetic
  publishable-key boundary for guest, bearer, and session-cookie checkout auth,
  including actor-derived ownership and client-identity rejection.
- Preserved: the standard Medusa body parser; custom malformed-JSON response
  normalization is removed and remains deferred by operator decision.
- Verified: no order, payment-collection, inventory-reservation, provider request,
  or production-data mutation during the authenticated checkout proof.
- Closed: `TASK-047` after independent functional `VERDICT: PASS`, semantic
  `SEMANTIC_VERDICT: semantic-pass`, and recorded T3 checkpoint/recovery markers;
  TASK-048 is the next dependency-eligible slice.

## [2026-08-15] TASK-048 authenticated checkout UI
- Added: authenticated-ready checkout form, normalized client boundary, state
  controller, conditional address/payment selection, sanitized recovery, and
  validated-not-order/payment handoff.
- Verified: focused form/state suites, checkout-auth-gate regression, storefront
  typecheck, Memory Bank lint, syntax, and diff hygiene all pass.
- Closed: `TASK-048` as T2; real authenticated browser/no-mutation coverage remains
  with TASK-049 and FT-006 feature-level semantic verification.

## [2026-08-13] TASK-047 bounded remediation
- Fixed: unauthenticated `POST /store/checkout` keeps standard Medusa customer
  session/bearer authentication and now maps only the native middleware 401 to the
  shared sanitized `checkout_auth_required` envelope.
- Strengthened: the synthetic checkout smoke now sends authenticated and
  unauthenticated requests through a real local HTTP route and middleware boundary
  using synthetic session context, while preserving direct validation assertions.
- Hardened: every synthetic fixture cleanup step remains unconditional, records
  cleanup failures without exposing error details, and fails the smoke loudly after
  all recovery attempts complete.

## [2026-08-13] TASK-047 authenticated checkout validation handoff
- Added: authenticated `POST /store/checkout` boundary using the standard Medusa
  customer session/bearer middleware, actor-derived ownership, normalized bounded
  validation, conditional address rules, stable delivery/payment IDs, and sanitized
  errors.
- Added: read-only workflow handoff containing the configured Admin/Shipping Options
  tariff, transient FT-007 snapshot, and FT-009 payment ID. Unavailable delivery fails
  closed with `422 delivery_method_unavailable`; no order, inventory, payment, or
  provider mutation is performed.
- Added: synthetic `checkout-delivery` integration smoke covering auth, normalization,
  safe limits, conditional address, stable tariffs/payment IDs, unavailable recovery,
  sanitized errors, and read-only operation tracing. Production data and secrets are
  not used.

## [2026-08-13] TASK-046 scheduler closure sync
- Reconciled: authoritative TASK-046 is `done` after T2 full protocol, required
  packet/spec gates, execute gates, and independent functional `VERDICT: PASS`.
- Linked: the FT-006 implementation plan, RTM, feature/epic lifecycle navigation,
  and changelog now point to the final execute, verification, protocol, and sync
  evidence without changing the task record.
- Preserved: the historical provider/configuration blocker and owner-approved bounded
  `apps/backend/medusa-config.ts` expansion remain in the task decision trail; the
  Admin-managed Shipping Options source, stable ordering, fail-closed availability,
  and no-fallback boundary remain unchanged.
- Preserved: REQ-013 through REQ-017, FT-006, and EP-003 remain `planned`; TASK-047,
  TASK-048, and TASK-049 retain their recorded blocked decisions. No packet status or
  hash, source implementation, dependent promotion, scheduler state, or terminal
  decision was changed by `/mb-sync`.
- Checked: `node scripts/mb-lint.mjs` passed; strict doctor remains blocked by the
  existing `TASK_QUEUE_DEADLOCK` and dependent-block warnings, which are scheduler-owned.

## [2026-08-13] TASK-046 bounded provider configuration expansion
- Registered: the installed Medusa v2.16 built-in manual fulfillment provider is
  loaded only through the supported Fulfillment module boundary so synthetic
  Admin/Shipping Options can be exposed locally.
- Preserved: Admin-managed Shipping Options and linked price sets remain the only
  delivery source; stable order, fail-closed availability, no fallback, no external
  provider, and no Medusa Core/order/payment changes remain unchanged.
- Pending: TASK-046 integration, typecheck, Memory Bank lint rerun, independent
  verification, scheduler lifecycle decision, dependent promotion, and `/mb-sync`.

## [2026-08-13] TASK-046..TASK-049 scheduler blocking decision sync
- Reconciled: authoritative TASK-046 is `blocked` on the recorded Admin/Shipping
  Options integration scope blocker; TASK-047, TASK-048, and TASK-049 retain their
  recorded blocked dependent decisions.
- Linked: RTM and FT-006 implementation-plan navigation now point to the task
  records, canonical packets, TASK-046 STOP_REPORT, and TASK-046 protocol evidence.
- Preserved: REQ-013 through REQ-017, FT-006, and EP-003 remain `planned`; no task
  status, lifecycle, promotion, dependent unblock, packet status, or scheduler
  terminal decision was changed by `/mb-sync`.
- Reported: the required integration evidence remains blocked because the local
  application registers no supported fulfillment provider. Approving
  `apps/backend/medusa-config.ts` scope expansion remains scheduler/operator-owned.
- Checked: the execute evidence records typecheck, Memory Bank lint, and dispatcher
  syntax as PASS; integration was blocked before fixture creation and no source
  implementation or verification rerun was performed by this sync.

## [2026-08-13] TASK-046 Admin-managed checkout delivery options execute
- Added: one backend projection over installed Medusa v2.16 Fulfillment Shipping
  Options and the linked Pricing price sets, using Admin `type.code` stable IDs and
  current context availability rather than a parallel tariff registry.
- Added: deterministic `pickup`, `city_courier`, `transport_company` projection with
  configured RUB money values, explicit unavailable state, and fail-closed missing or
  ambiguous tariffs without hardcoded fallback or external provider calculation.
- Added: synthetic local integration smoke with unconditional fixture cleanup and
  sanitized source/order/tariff evidence; no production data, credentials, order,
  inventory, payment, or provider mutation is used.
- Blocked: the required real Medusa smoke cannot create synthetic Admin Shipping
  Options because the local application registers no Fulfillment Provider. Provider
  registration is outside TASK-046 scope; no hardcoded or parallel tariff fallback
  was added.
- Pending: independent `/verify`, feature-level semantic verification, scheduler
  closure, dependent promotion, and `/mb-sync` remain outside this Implementer run.

## [2026-08-11] FT-005 lifecycle verification sync
- Reconciled: FT-005 `lifecycle: verified` from the feature-level review with
  `SEMANTIC_VERDICT: semantic-pass`, `verdict: APPROVE`, and no findings; all indexed
  TASK-035..TASK-042, TASK-044, and TASK-045 are scheduler-closed.
- Updated: REQ-009 and EP-002 to `lifecycle: verified`, and added completion/evidence
  navigation to the FT-005 feature and implementation plan.
- Preserved: document `status` values and status taxonomy remain unchanged; no unrelated
  requirement/feature lifecycle, task/queue lifecycle, or packet state was changed.
- Evidence: [.tasks/FT-005/FT-005-S-RED-VERIFY-final-report-docs-01.md](../.tasks/FT-005/FT-005-S-RED-VERIFY-final-report-docs-01.md).

## [2026-08-11] TASK-042 scheduler closure sync
- Reconciled: the authoritative TASK-042 record is `done` after final T3 retry 2/2 with
  functional `PASS`, semantic `semantic-pass`, `HUMAN_CHECKPOINT: done`, and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Linked: all nine final TASK-042 evidence paths resolve under `.tasks/TASK-042/` or
  `.protocols/TASK-042/`; the RTM and FT-005 implementation plan now reflect the closed
  browser acceptance slice.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned` pending feature-level semantic
  verification. No lifecycle, promotion, feature gate, or dependent block/unblock
  decision was made by `/mb-sync`.
- Reported: packet `PACKET-TASK-042-R3` has a stale `source_task_hash` after scheduler
  closure; it was not refreshed.
- Checked: Memory Bank lint, task/protocol consistency, and evidence-path reconciliation;
  details are recorded in `.tasks/TASK-042/TASK-042-S-MB-SYNC-final-report-docs-01.md`.

## [2026-08-10] TASK-045 wishlist fixture sales-channel alignment
- Fixed: the real browser publishable key is passed to the local wishlist acceptance
  phases, whose synthetic visible/restored/out-of-stock fixtures now use the channel
  selected through the supported Medusa API-key query boundary.
- Preserved: browser-positive wishlist checks account for TASK-044 retained rows and wait
  for specific card removal instead of requiring an empty list prematurely.
- Preserved: channel-invisible, unpublished, inactive-category, and missing-product
  omission semantics, TASK-041 write/read/cleanup, TASK-044 retention, unconditional
  cleanup, session/bearer transport, and production wishlist/auth/catalog behavior.
- Sanitized: acceptance output records only the resolution source and alignment result;
  publishable keys, customer/session values, and other sensitive data remain excluded.

## [2026-08-10] TASK-042 final bounded browser lifecycle retry
- Passed: the real wishlist browser suite consumed TASK-044 `browser-setup` through the
  TASK-045 publishable-key channel boundary and observed retained hidden, restored, and
  out-of-stock lifecycle projections through the long-lived Store API.
- Proved: hidden durable rows were omitted, the restored product reappeared with its
  current handle, and the visible out-of-stock product exposed `is_available: false`.
- Covered: authenticated catalog/detail/wishlist add, view, remove, reload, customer
  isolation, guest routing/non-persistence, merge-blocked wishlist independence with
  checkout blocked, logout/session expiry cleanup, storage privacy, and unconditional
  synthetic cleanup with released ports.
- Checked: storefront regression, workspace typecheck/build, Memory Bank lint, runner
  syntax, privacy, and direct browser DB/module boundary scans passed.
- Preserved: no backend source, production behavior, auth/bearer/schema boundary, task
  status, packet, retry decision, scheduler closure, or T3 marker was changed.

## [2026-08-10] TASK-045 scheduler closure sync
- Reconciled: the authoritative TASK-045 record is `done` with T2 full protocol,
  required packet/spec gates, and functional `PASS`.
- Linked: all seven authoritative evidence paths resolve under `.tasks/TASK-045/` or
  `.protocols/TASK-045/`; the RTM and FT-005 implementation plan now include the closed
  acceptance-only sales-channel alignment slice.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned`; TASK-042 remains `in_progress`.
  The FT-005 feature-level semantic gate remains pending. No lifecycle, promotion, or
  dependent block/unblock decision was made by `/mb-sync`.
- Reported: packet `PACKET-TASK-045-R1` has a stale `source_task_hash` after closure;
  it was not refreshed.
- Checked: Memory Bank lint, task/protocol consistency, and evidence-path reconciliation;
  details are recorded in `.tasks/TASK-045/TASK-045-S-MB-SYNC-final-report-docs-01.md`.

## [2026-08-10] TASK-042 bounded browser lifecycle retry
- Changed: the real wishlist browser suite now obtains the current provider-double
  customer actor, consumes TASK-044 `browser-setup`, and parses only its sanitized
  synthetic fixture IDs/handles.
- Added: fail-closed browser-positive checks for retained hidden-row omission, restored
  product reappearance with its current handle, and visible out-of-stock
  `product.is_available === false`.
- Blocked: the long-lived browser Store API returned `404` for both retained fixture
  products and an empty wishlist immediately after setup, so the retry emits a
  STOP_REPORT instead of claiming browser lifecycle proof.
- Preserved: prior backend acceptance assertions, the FT-004 session-cookie boundary,
  unconditional synthetic cleanup, privacy scanning, and all production wishlist/auth/
  catalog behavior.

## [2026-08-10] TASK-044 wishlist browser fixture retention handoff
- Added: acceptance-only `browser-setup` phase accepts the synthetic browser customer
  actor from the existing local session boundary and returns sanitized synthetic product
  IDs/handles for the browser runner.
- Retained: hidden durable rows are seeded through the local Wishlist Module service and
  omitted by the Store API; a restored published row and a visible zero-stock row remain
  available until the existing unconditional cleanup phase.
- Preserved: TASK-041 `write/read/cleanup/full`, production wishlist/auth/catalog behavior,
  session/bearer transport, storefront, schema, and scheduler lifecycle remain unchanged.

## [2026-08-10] TASK-044 scheduler closure sync
- Reconciled: the authoritative TASK-044 record is `done` with T2 full protocol,
  required packet/spec gates, and functional `PASS`.
- Linked: all six authoritative evidence paths resolve under `.tasks/TASK-044/` or
  `.protocols/TASK-044/`; the RTM and FT-005 implementation plan now include the closed
  acceptance-only retention slice.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned`; TASK-042 remains `in_progress`.
  The FT-005 feature-level semantic gate remains pending. No lifecycle, promotion, or
  dependent block/unblock decision was made by `/mb-sync`.
- Reported: packet `PACKET-TASK-044-R1` has a stale `source_task_hash` after closure;
  it was not refreshed.
- Checked: Memory Bank lint and evidence-path reconciliation; details are recorded in
  `.tasks/TASK-044/TASK-044-S-MB-SYNC-final-report-docs-01.md`.

## [2026-08-09] TASK-042 HIGH-gap remediation preflight
- Blocked: the existing TASK-041 `write/read/cleanup` phase API cannot retain hidden
  durable rows or restored/out-of-stock favorites until the TASK-042 browser assertions
  run; the synchronous `read` phase removes them before returning.
- Preserved: no TASK-042 source, production behavior, task JSON, packet, scheduler
  state, status, closure decision, or T3 marker was changed; no direct DB/module bypass
  was introduced.
- Handoff: an owner-approved retention-capable TASK-041 acceptance phase or explicit
  scope change is required before the browser-positive remediation can be implemented.

## [2026-08-09] TASK-042 browser wishlist acceptance harness
- Added: real-browser wishlist acceptance over the existing FT-004 session-cookie and
  provider-double boundary, covering catalog/detail/wishlist add, reload, and remove,
  second-customer isolation, guest login routing without persistence, merge-blocked
  wishlist independence, logout/session-expiry cleanup, and browser storage scanning.
- Added: browser Store API checks for unified hidden-product `404`/omission and visible
  out-of-stock/unavailable state, backed by the existing real Medusa/PostgreSQL
  synthetic lifecycle fixture harness with unconditional cleanup.
- Added: `test:e2e:wishlist` package entry; no production wishlist/auth/catalog behavior,
  live provider, bearer path, credentials, or production data was changed.
- Pending: independent `/verify`, T3 `/red-verify`, human checkpoint, recovery review,
  and lifecycle decision remain scheduler-owned.

## [2026-08-08] TASK-041 wishlist backend acceptance harness
- Added: a local-only phased acceptance harness over real Medusa Store route handlers,
  wishlist workflows/module, canonical product query, and PostgreSQL persistence.
- Covered: fresh-process durability plus Store API removal, two-customer isolation,
  duplicate/concurrent add, repeated remove, guest/malformed input, exact projection,
  sanitized backend failures, unified hidden-product `404`/list omission, visibility
  restoration, and visible out-of-stock projection with `is_available: false`.
- Added: synthetic lifecycle fixtures for publication, sales-channel, active-category,
  and inventory transitions with unconditional cleanup and no production behavior/data.
- Historical handoff note: independent `/verify`, T3 `/red-verify`, human checkpoint,
  rollback/recovery closure markers, lifecycle decision, and `/mb-sync` were
  scheduler-owned at implementation time; the closure is reconciled below.

## [2026-08-09] TASK-041 scheduler closure sync
- Reconciled: the authoritative TASK-041 record is `done` with T3 functional `PASS`,
  semantic `semantic-pass`, `HUMAN_CHECKPOINT: done`, and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Linked: all eight authoritative TASK-041 evidence paths resolve under `.tasks/TASK-041/`
  or `.protocols/TASK-041/`; RTM and the FT-005 implementation plan now reflect the
  closed backend acceptance slice.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned`; TASK-042 remains `planned`.
  No dependent task was promoted, unblocked, blocked, or otherwise given a new lifecycle
  decision by `/mb-sync`.
- Reported: packet `PACKET-TASK-041-R3` is stale after closure changed the authoritative
  task-record hash; it was not refreshed.
- Checked: Memory Bank lint and evidence-path reconciliation; details are recorded in
  `.tasks/TASK-041/TASK-041-S-MB-SYNC-final-report-docs-01.md`.

## [2026-08-08] TASK-040 scheduler closure sync
- Reconciled: the indexed authoritative TASK-040 record is `done` with the explicit
  scheduler decision, T2 full protocol, functional `PASS`, and five linked
  implementation, verification, protocol, and gate artifacts.
- Linked: the FT-005 implementation plan and REQ-009 RTM note now reflect the
  closed TASK-040 slice without inferring feature completion.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned`; TASK-041 remains `ready`
  and TASK-042 remains `planned` from their existing decisions. No dependent task
  was promoted, unblocked, blocked, or otherwise given a new lifecycle decision.
- Reported: packet `PACKET-TASK-040-R3` has a stale pre-closure `source_task_hash`;
  the packet was not refreshed.
- Checked: `node scripts/mb-lint.mjs` and evidence-path reconciliation; details are
  recorded in `.tasks/TASK-040/TASK-040-S-MB-SYNC-final-report-docs-01.md`.

## [2026-08-08] TASK-040 wishlist controls and page execute
- Added: accessible product-level wishlist controls to catalog and product detail,
  using opaque product IDs for mutations and current handles only for navigation.
- Added: guest login routing through the existing safe return-path helper without
  pending favorite intent, plus authenticated idle/pending/saved/error behavior
  independent of cart merge readiness.
- Added: authenticated `/wishlist` loading, empty, products, error, remove, and
  session-expired views rendering the exact minimal product projection and current
  product handles.
- Added: focused wishlist UI contract/state assertions and registered the suite.
- Pending: feature-level semantic verification after all FT-005 tasks and the
  downstream backend/browser acceptance tasks; these remain outside TASK-040 closure.

## [2026-08-08] TASK-039 scheduler closure sync
- Reconciled: the indexed authoritative TASK-039 record is `done` with the explicit
  scheduler decision, functional `PASS`, semantic `semantic-pass`, exact T3 markers,
  and seven linked implementation, verification, protocol, and recovery artifacts.
- Linked: the FT-005 implementation plan, RTM note, and dedicated sync report now
  reflect the recorded storefront-state closure without inferring feature completion.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned`; TASK-040 and TASK-042
  remain `planned`, and the existing TASK-041 `ready` decision is unchanged.
- Preserved: no dependent task was promoted, unblocked, blocked, or otherwise given a
  new lifecycle decision by `/mb-sync`.
- Reported: TASK-039 packet `PACKET-TASK-039-R9` has a stale pre-closure
  `source_task_hash`; the packet was not refreshed.
- Checked: `node scripts/mb-lint.mjs` passed; hash/evidence details are recorded in
  `.tasks/TASK-039/TASK-039-S-MB-SYNC-final-report-docs-01.md`.

## [2026-08-08] TASK-039 storefront wishlist state execute
- Added: session-cookie wishlist client and in-memory state controller for the
  authenticated current-customer boundary, independent of cart merge/checkout
  readiness.
- Added: backend-truth list/add/remove handling, per-product pending/error isolation,
  duplicate mutation suppression, guest no-op behavior, session-expiry invalidation,
  logout clearing, and stale-response protection without browser wishlist storage.
- Added: focused wishlist client/state tests and mounted the provider under the
  existing storefront AuthProvider boundary; no wishlist markup or backend/auth
  behavior was changed.
- Pending: independent `/verify`, T3 `/red-verify`, human checkpoint, rollback/recovery,
  lifecycle decision, and `/mb-sync` remain owned by the scheduler/reviewer.

## [2026-08-08] TASK-038 scheduler closure sync
- Reconciled: the indexed authoritative TASK-038 record is `done` with the explicit
  scheduler decision, functional `PASS`, semantic `semantic-pass`, T3 checkpoint,
  rollback/recovery marker, and linked verification evidence.
- Linked: the current task evidence remains the implementation report, independent
  functional and semantic reports, route-level HTTP matrix, and TASK-038 protocols.
- Preserved: REQ-009, FT-005, and EP-002 remain `planned` because the remaining
  wishlist state, UI, backend acceptance, and browser acceptance tasks are incomplete.
- Preserved: no dependent task was promoted, unblocked, blocked, or otherwise given a
  new lifecycle decision by `/mb-sync`.
- Reported: strict doctor detects `TASK_PACKET_STALE` because the scheduler closure
  changed the task-record hash; the existing packet was not refreshed.
- Checked: `node scripts/mb-lint.mjs` passed; the strict doctor result is recorded as a
  consistency gap for the scheduler/packet owner.

## [2026-08-08] TASK-038 bounded remediation evidence
- Replaced: the wishlist API smoke no longer emits the hardcoded
  `productionBearerAdded: false` claim. It now asserts the production storefront
  session-cookie transport, the existing local E2E bearer hook, and standard wishlist
  middleware methods without adding a production bearer mechanism.
- Added: a reproducible real local HTTP route-level matrix over synthetic fixtures for
  missing, unpublished, current-channel-invisible, inactive-category, and visible
  out-of-stock products. Hidden cases return the same `404 wishlist_product_not_found`;
  out-of-stock remains listable with `is_available: false`.
- Preserved: auth providers/session creation, storefront source, wishlist
  workflow/module semantics, core tables, production data, task status, packet, and
  T3 closure markers remain unchanged. Independent `/verify` and `/red-verify` remain
  the next-owner gates.

## [2026-08-08] TASK-038 wishlist Store API execute
- Added: authenticated Store list/add/remove routes with standard Medusa customer
  middleware, actor-derived ownership, publishable sales-channel scoping, exact
  wishlist item responses, idempotent statuses, and sanitized stable errors.
- Added: local `wishlist-api` integration smoke for middleware registration, guest
  denial, two-customer isolation, exact projection, duplicate/repeated mutation,
  malformed input, and non-disclosing missing-product behavior.
- Pending: independent `/verify` and `/red-verify` plus T3 human checkpoint and
  rollback/recovery evidence; `/execute` does not close TASK-038.

## [2026-08-08] TASK-037 wishlist workflows
- Added: wishlist domain service and server-input add/remove workflows over the
  existing Wishlist Module and canonical Medusa Product query boundary.
- Added: exact minimal `WishlistProductProjection` with current handle/title/media,
  active category, lowest valid price, and availability; no product snapshot is stored.
- Added: visibility handling for publication, active category, current sales channel,
  missing products, and out-of-stock products; hidden rows remain durable but are
  omitted from list projections.
- Verified locally: duplicate/concurrent add convergence, exact add/list projection,
  customer/product-scoped idempotent remove, hidden-row omission, missing-product
  rejection, out-of-stock unavailable projection, backend typecheck, Memory Bank lint,
  strict doctor, and dispatcher safety checks pass.
- Verified: independent `/verify TASK-037` returned `VERDICT: PASS` after repeating
  the workflow gate and confirming exact projection, visibility guards, duplicate and
  concurrent convergence, scoped idempotent removal, hidden-row omission, and
  out-of-stock visibility.
- Closed: the operator explicitly assigned manual closure ownership; TASK-037 is
  `done`. Since TASK-029 is also `done`, TASK-038 is promoted to `ready`. FT-005
  feature red verification remains pending until all feature tasks complete.

## [2026-08-07] TASK-036 opaque product ID contracts execute
- Added: catalog and product-detail backend projections expose the canonical opaque
  Medusa Product ID as additive top-level `id` while preserving handles, variants,
  filters, prices, availability, and cart handoff semantics.
- Updated: storefront `CatalogProduct` and `ProductDetail` contracts preserve product
  ID; handles remain navigation-only and variant IDs remain SKU/cart identity.
- Added: `wishlist-product-id` integration gate composes the real canonical catalog
  and product-detail smokes without introducing another product source.
- Verified locally: combined integration, individual catalog/detail smokes, full
  storefront regression, workspace typecheck, Memory Bank lint, dispatcher syntax,
  and diff whitespace checks pass.
- Verified 2026-08-08: independent `/verify TASK-036` returned `VERDICT: PASS` after
  repeating all required T2 gates and confirming direct canonical ID mapping,
  storefront preservation, identity boundaries, and full catalog/detail regression.
- Closed 2026-08-08: the operator explicitly assigned manual closure ownership;
  TASK-036 is `done`. Since TASK-035 is also `done`, TASK-037 is promoted to `ready`.
  FT-005 feature red verification remains pending until all feature tasks complete.

## [2026-08-07] TASK-035 Wishlist Module persistence
- Added: registered custom Medusa `wishlist` module with one `WishlistItem` model
  containing only opaque customer/product IDs and standard timestamps.
- Generated: `Migration20260807134045` creates only `wishlist_item`, a partial unique
  `(customer_id, product_id)` index, customer/created/id list index, deleted-at index,
  and no cross-module foreign keys.
- Proved locally: migration apply/idempotent repeat, real PostgreSQL write, fresh-
  process read, delete, concurrent duplicate convergence to one row plus recoverable
  unique conflict, and unconditional synthetic-fixture cleanup.
- Verified locally: backend typecheck, integration dispatcher syntax, Memory Bank
  lint, migration/schema/index inspection, and diff whitespace checks pass.
- Verified: independent `/verify TASK-035` returned `VERDICT: PASS` after repeating all
  required T2 gates and directly inspecting PostgreSQL schema, indexes, constraints,
  concurrency behavior, fresh-process persistence, deletion, and fixture cleanup.
- Closed: the operator explicitly assigned manual closure ownership; TASK-035 is
  `done`. TASK-037 remains `planned` because TASK-036 is still incomplete. FT-005
  feature red verification remains pending until all feature tasks are complete.

## [2026-08-07] FT-005 decomposition refreshed
- Revalidated: feature SDD, data/API/security contracts, implementation plan,
  TASK-035..TASK-042 coverage, tiers, dependencies, scopes, gates, and required
  packets remain complete with no blocking design questions.
- Unblocked for planning: TASK-039 moved from historical auth-blocked state to
  `planned` because FT-004/TASK-030 are verified; TASK-038 remains its incomplete
  dependency, so no ready promotion occurred.
- Preserved: TASK-035 and TASK-036 remain the only ready entry tasks and must
  serialize their shared changelog write.

## [2026-08-07] TASK-034 and FT-004 verified
- Reverified: real local browser, Medusa, and PostgreSQL acceptance establishes usable
  Google/VK customer sessions, cleans callback URLs, enforces checkout readiness, and
  handles cancel/failure/replay, Google cart conflict/retry, expiry, and both-provider
  logout cleanup.
- Confirmed: the regenerated-session correction in `b6e39a0` resolves the original
  callback-success/current-customer-401 defect without introducing another identity or
  session boundary.
- Confirmed: checkout logout waits for AuthStateController confirmation and suppresses
  the guest redirect race; failure remains retryable.
- Verified privacy: regenerated logs, decompressed traces, browser storage/console, and
  screenshots contain no prohibited token, secret, session, callback, customer email,
  or full customer/cart identifier.
- Closed: functional verification returned `VERDICT: PASS`; T3 adversarial verification
  returned `SEMANTIC_VERDICT: semantic-pass`; the direct operator checkpoint and
  rollback/recovery evidence are recorded; TASK-034 is `done`.
- Synced: FT-004 and REQ-010/REQ-011/REQ-012 are `verified`. Dependent task promotion
  remains outside `/mb-sync` ownership.

## [2026-08-04] TASK-034 browser acceptance remediation
- Confirmed: the approved regenerated-session fix establishes usable Google and VK
  customer sessions through real local Medusa/PostgreSQL and browser boundaries.
- Fixed: checkout logout suppresses the guest redirect race, waits for confirmed
  AuthStateController cleanup, and reaches clean `/login` without recreating the
  checkout return path; logout failure remains retryable.
- Refined: browser storage privacy ignores only Next.js-owned
  `__next_debug_channel:*` keys while continuing to reject every unexpected app
  session key and sensitive storage value.
- Verified locally: Google/VK callback cleanup, cancel/failure/replay, cart handoff,
  conflict/retry, checkout gate, expiry/logout, process cleanup, storefront tests,
  backend auth-completion regression, workspace typecheck/build, Memory Bank lint,
  strict doctor, screenshots, and decompressed trace privacy scan pass.
- Resolved: TASK-034 callback-session and evidence-sanitization bug records. The
  historical functional FAIL was superseded by the independent repeated PASS and
  semantic closure recorded on 2026-08-07.

## [2026-08-04] OAuth regenerated-session remediation
- Fixed: customer OAuth completion reacquires the active Express session after
  `regenerate()` before writing and saving Medusa customer `auth_context`.
- Added: the auth-completion regression replaces the session object during
  regeneration and proves the stale object is never saved.
- Deployment remains in progress; TASK-034 stays open until the production image
  and real browser current-customer boundary are verified.

## [2026-08-04] Production OAuth callback routing corrected
- Fixed: Caddy now routes the storefront-owned `/auth/complete` page to Next.js
  before the general Medusa `/auth*` handler.
- Preserved: the replaced configuration is available at
  `/etc/caddy/Caddyfile.backup-20260804-071458` for route-only rollback.
- Verified: candidate and installed Caddyfiles are valid; reload succeeded;
  public callback, storefront root, and backend `/health` return `200`; Caddy
  remains active with no reload errors and no Docker service was restarted.
- Recorded T3 markers: `HUMAN_CHECKPOINT: done` and
  `ROLLBACK_RECOVERY_NOTE: present`.

## [2026-08-02] TASK-033 interrupted-run recovery remediation
- Added: a private owner marker is created before acceptance database writes; bounded
  discovery skips live owners and recovers dead-owner or legacy TASK-033 runs through
  the existing idempotent Medusa cleanup phase.
- Tested: acceptance writes real PostgreSQL fixtures, simulates termination before
  `finally`, and requires a later discovery pass to remove that run before normal
  persistence/session acceptance proceeds.
- Recovered: the first remediated command removed the legacy state that triggered the
  semantic concern plus the simulated interrupted run, then left no TASK-033 temp
  owner/state files.
- Guarded: discovery accepts only bounded lowercase TASK-033 IDs, inspects at most 20
  run groups, treats live owners as active for at most two hours to bound PID reuse,
  does not emit state values, and removes markers only after cleanup.
- Verified locally: auth acceptance, backend typecheck, and Windows-native local
  smoke pass; repeated functional and semantic verification remain required for T3
  closure.
- Reverified: repeated functional verification returned `VERDICT: PASS`; hostile
  recovery review returned `SEMANTIC_VERDICT: semantic-pass` with bounded lease,
  retry, privacy, and production-scope risks explicitly assessed.
- Closed: the continued manual run supplied explicit standalone closure ownership;
  TASK-033 is `done` with checkpoint and rollback/recovery evidence. REQ-010, REQ-011,
  FT-004, and TASK-034 lifecycle/promotion remain unchanged.
- Synced: task record, hash-matched packet R4, archived bug, protocol/evidence, and
  changelog agree; strict doctor passes. TASK-034 is reported only as a promotion
  candidate for its scheduler/owner.

## [2026-07-31] TASK-033 real session HTTP remediation
- Replaced: the acceptance no longer claims runtime cookie/restart proof from only an
  in-memory session recorder and persisted DTO field scan.
- Added: compiled real Medusa starts twice on an isolated local port; a synthetic
  bearer for the persisted test customer creates an actual session through
  `POST /auth/session` and captures the real `Set-Cookie` response.
- Proved: the session cookie authenticates `/store/customers/me`, logout returns an
  empty session cookie and rejects the prior cookie, and a second valid cookie is
  rejected after full backend process restart while the durable Auth/Customer link
  remains readable in a fresh Medusa process.
- Added: a temporary publishable API key through the real API Key Module; auth,
  customer, and key fixtures are revoked/deleted in unconditional cleanup and the
  private temp state file is removed.
- Corrected: provider summary now claims real HTTP session coverage only after these
  probes pass; no session cookie, bearer, publishable key, customer ID, or email is
  emitted to evidence.
- Status: implementation remediation complete; historical `/verify` FAIL remains
  authoritative until repeated `/verify TASK-033`, followed by `/red-verify` only
  after functional PASS.

## [2026-07-25] TASK-033 backend auth acceptance execute
- Added: real Medusa/PostgreSQL auth acceptance runs synthetic Google/VK identity
  completion through Auth/Customer modules and supported customer-account workflows.
- Proved: first/repeat login, same-email collision, missing email, server-side session
  save/destroy, explicit cookie/CORS policy, and durable identity/customer linkage
  across a fresh Medusa process.
- Added: sanitized local provider-double aggregation for invalid/replayed/expired
  state, VK PKCE/device mismatch, callback redirect, rate limiting, failure cleanup,
  and token non-persistence without live providers or credentials.
- Guarded: acceptance always runs a final cleanup process and asserts no synthetic
  identities/customers remain; output contains only coarse booleans/counts.
- Updated: backend integration dispatcher now owns auth suites as well as existing
  catalog/cart suites; `test:integration -- auth-acceptance` uses the real source
  boundary while contract-only auth suites are labelled synthetic.
- Verified locally: auth acceptance, auth-completion/VK dispatcher regressions,
  backend typecheck, and Windows-native local smoke pass.
- Status: `/execute` handoff complete; TASK-033 remains `ready` pending independent
  `/verify`, per-task `/red-verify`, closure ownership, and `/mb-sync`.
- Independent verify: `VERDICT: FAIL`. Real PostgreSQL persistence, provider-negative
  contracts, privacy, and cleanup pass, but no real HTTP cookie/logout/restart flow is
  exercised; the green summary is based on an in-memory recorder and JSON scan.
- Recorded: active `TASK-033-session-restart-acceptance-gap` bug. TASK-033 remains
  `ready` pending bounded acceptance remediation and repeated `/verify`;
  `/red-verify` was not run because functional PASS was not reached.
- Remediated: acceptance now exercises actual Set-Cookie, current-customer access,
  real logout, stale-cookie rejection, full backend restart, durable-link survival,
  API-key/Auth/Customer cleanup, and private temp-state removal.
- Reverified: repeated `/verify TASK-033` returned `VERDICT: PASS`; the session restart
  bug is archived. TASK-033 remains `ready` pending per-task `/red-verify`.
- Red verification: core persistence/session/security behavior passed, but
  `SEMANTIC_VERDICT: semantic-concern` because an interrupted prior run left private
  temp state and normal new-run IDs cannot recover or prove stale fixture cleanup.
- Recorded: active `TASK-033-interrupted-run-cleanup-gap`; TASK-033 remains `ready`
  pending tested recovery or an explicit operator decision that narrows the cleanup
  guarantee, followed by repeated verification.

## [2026-07-25] Production Caddy, firewall, and HTTPS enabled
- Configured host-level Caddy routing for Medusa paths and the Next.js
  storefront; candidate and installed configurations passed validation.
- Preserved the package-default Caddyfile as
  `/etc/caddy/Caddyfile.backup-20260725-111004` for rollback.
- Permanently allowed only HTTP and HTTPS in the public firewalld zone; backend
  and storefront remain loopback-bound and PostgreSQL remains private.
- Enabled Caddy and obtained a Let's Encrypt certificate for
  `eshop.natureonzoom.win`, valid through 2026-10-23.
- Verified externally: HTTP redirects to HTTPS, storefront returns `200`, backend
  `/health` returns `200`, and all three Docker services remain healthy.
- Remaining: region/catalog seed and real storefront public Medusa values are
  still required before catalog behavior is production-ready.

## [2026-07-24] TASK-032 return-path semantic remediation
- Removed: checkout return navigation is no longer duplicated in the `/login` URL;
  guest checkout writes only normalized `/checkout` through the existing versioned
  sessionStorage adapter and navigates to clean `/login`.
- Changed: the login page no longer accepts `return_path` query input, and provider
  start without an explicit path preserves existing sessionStorage state instead of
  overwriting it with `/`.
- Scoped: the operator approved the bounded neighboring login/auth-state test scope;
  backend auth/provider/callback, cart merge, checkout fields, orders, inventory, and
  payments remain unchanged.
- Refreshed: TASK-032 and required `PACKET-TASK-032-R8` record the approved scope and
  the session-storage-only boundary.
- Verified locally: checkout/auth-state/auth-UI focused suites, all storefront tests,
  typecheck, production build, Memory Bank lint, strict doctor, and diff check pass.
- Historical status: the reported semantic concern was remediated before repeated
  independent `/verify` and `/red-verify` verdicts.
- Reverified: repeated functional verification returned `VERDICT: PASS`; repeated
  hostile verification, including malicious login-query behavior, returned
  `SEMANTIC_VERDICT: semantic-pass`.
- Closed: the operator supplied explicit standalone closure ownership; TASK-032 is
  `done` after repeated functional PASS, semantic-pass, checkpoint, recovery,
  protocol, packet, and evidence gates.
- Synced: task record, closure handoff, packet hash, and changelog are reconciled.
  REQ-012 and FT-004 remain `planned` pending TASK-034 browser acceptance; no
  dependent promotion was performed.


## [2026-07-23] Production PostgreSQL initialized and migrated
- Added: `DEPLOYMENT_HANDOFF.md` records the verified VPS state, migration
  findings, safety boundaries, blocker, and exact resume sequence without
  containing production secrets.
- Started only the Compose `postgres` service on the VPS; backend and storefront
  application services remain stopped.
- Confirmed: `eshop-postgres-1` is healthy with zero restarts, accepts database
  connections, publishes no host port, and mounts the named
  `eshop_postgres_data` volume.
- Applied Medusa core, custom `cartMerge`, link, and script migrations; a second
  full migration run completed idempotently with the schema already up to date.
- Verified: the `eshop` database contains 141 public tables; region creation and
  catalog seed were not run.
- Fixed and published: backend database driver configuration explicitly disables
  SSL for the private Compose PostgreSQL connection in commit `99b92f4`.
- Rebuilt: `eshop-backend:production` now points to
  `sha256:89684d39af06a2d913940a5d212318fdaa9e2470aa8740de86ef9c113d399927`
  with OCI revision label `99b92f4`; the previous image is preserved as
  `eshop-backend:pre-99b92f4`.
- Recorded: long backend builds must use `nohup` plus a persistent log because
  the current SSH path may close after about 10 minutes. No helper script was
  added, and backend/storefront application containers remain stopped.

## [2026-07-23] TASK-032 checkout authentication gate execute
- Added: `/checkout` now confirms the backend customer session, restores the current
  backend cart, and renders continuation only after no-source/current-customer cart
  readiness or the existing FT-003 merge handoff succeeds.
- Guarded: guests store only the normalized `/checkout` return path and route to
  login; foreign, unresolved, failed, and stale cart/session states fail closed.
- Added: recoverable `merge_blocked` retry, bounded FT-006 handoff content, and an
  explicit reminder that storefront gating never replaces backend authorization.
- Verified locally: focused checkout state-matrix tests, full storefront tests,
  storefront typecheck/build, and Memory Bank lint pass.
- Verified independently: `/verify TASK-032` passed focused/full storefront tests,
  typecheck, production build, Memory Bank lint, strict doctor, packet hash, scope,
  and diff checks.
- Status: functional `VERDICT: PASS`; `TASK-032` remains `ready` under T3 policy.
- Red verification: hostile auth/cart readiness probes passed, but
  `SEMANTIC_VERDICT: semantic-concern` because the fixed checkout return path is
  duplicated in the login query despite the linked session-storage-only contract.
- Next: keep `TASK-032` open pending an explicit contract decision or bounded
  login-boundary remediation and repeated functional/semantic verification.

## [2026-07-21] VPS deployment checkpoint refreshed
- Recorded: server checkout is clean at `c46fe46` and backend production image
  `eshop-backend:production` exists.
- Confirmed: no project containers, PostgreSQL volume, or storefront image are
  present yet; the next deployment step is PostgreSQL, migrations, backend
  health check, Medusa public values, then storefront build.
- Updated: deployment docs now treat the current VPS as the default capacity:
  1 vCPU, about 1.7 GiB RAM, 30 GB disk, and 2.0 GiB swap.
- Clarified: 2 vCPU / 2 GB RAM is an optional future capacity upgrade, not the
  baseline for the current deployment runbook.
- Refreshed: backend image `eshop-backend:production` was rebuilt on VPS checkout
  `74fa10e`; current image ID is
  `sha256:d82b18f754ad59b42319eb2c2f5e74b7131edf34ea7255ad5e7e671041c55017`.
- Fixed: storefront Dockerfile now copies the repository root `tsconfig.json`,
  resolving the VPS image build failure where
  `apps/storefront/tsconfig.json` could not resolve `../../tsconfig.json`.
- Fixed: storefront package now declares `typescript` as its own dev dependency,
  preventing Next.js from trying to install TypeScript with Yarn during the
  Docker image build.
- Confirmed: storefront image `eshop-storefront:production` was built on VPS
  checkout `5a47a9d`; current image ID is
  `sha256:f3cbb5523708b96404e1d10eaa6bf089fcb391f5bf721bc1adae93edc808081a`.
- Preserved: no project containers or database volume were started during image
  build verification.

## [2026-07-21] TASK-031 OAuth UI and cart handoff verified
- Added: Google/VK login and completion UI with sanitized pending, cancel, failure,
  retry, merge, and no-source states.
- Fixed: fail-closed merge-result mapping, stale async invalidation, duplicate action
  guards, real `null + idle` no-source composition, and strict merge metadata checks.
- Verified: final independent functional and semantic T3 checks passed after retry
  2/2; scheduler closed `TASK-031`.

## [2026-07-21] TASK-031 OAuth login and cart completion UI execute
- Added: equal Google/VK ID login choices with bounded pending, safe failure, and
  retry states through the existing storefront AuthProvider boundary.
- Added: fixed completion UI that strips callback query/fragment data before
  rendering, confirms the existing customer session, and invokes the existing
  CartProvider post-auth merge handoff.
- Guarded: merged/no-source readiness is distinguished from recoverable merge
  failure; failures preserve the active session/source reference and safe return
  state is consumed only from `authenticated_ready`.
- Hardened after independent review: only a validated ready target or genuine
  no-source handoff reaches readiness; auth loss, retry supersession, remounts, and
  duplicate actions cannot apply a stale merge result or consume the return path.
- Corrected after final bounded review: the real root CartProvider `null + idle`
  no-source composition reaches readiness only with no operation/error/cart, while
  ready merge handoffs require complete and coherent source/target/outcome/replay
  metadata and reject pending, errored, incomplete, or contradictory forms.
- Preserved: no backend/provider, FT-003 merge semantics, checkout, order,
  inventory, payment, token storage, raw provider-error rendering, or customer PII
  rendering was added.

## [2026-07-18] TASK-030 recovery 2 failed malformed-query T3 gate
- Passed: exact Google/VK paths, backend/port/credential/fragment/path rejection,
  real provider starts, and every prior TASK-030 behavior.
- Failed: malformed raw query syntax, invalid escapes, encoded controls, empty
  segments, and double-encoded callback/return keys remained fail-open.
- Blocked: `TASK-030` and direct dependents; added `TASK-043` for the bounded parser
  gap. Terminal state is `HALT_FAILURE_BUDGET`.
- Resumed: operator authorized continued bounded remediation without repeated
  approval prompts; `TASK-043` moved to `ready`.
- Verified: `TASK-043` retry 1/2 passed independent functional and semantic T3
  checks; scheduler closed the malformed-query remediation.
- Closed: final TASK-030 code-07 functional and semantic verification passed after
  logout `401` cleanup and empty-fragment fixes; direct eligible dependent may now
  be promoted.

## [2026-07-18] TASK-030 recovery failed exact-path T3 gate
- Confirmed: approved Google/VK origins allow real provider starts and preserve all
  prior race, storage, cart cleanup, and token non-storage fixes.
- Failed: origin-only backend trust still accepted arbitrary/wrong-provider paths,
  explicit default ports, and fragment payloads.
- Blocked: `TASK-030` and its direct dependents; added blocked `TASK-043` for an
  exact provider/backend destination contract.
- Terminal state: `HALT_FAILURE_BUDGET` after the approved recovery attempt failed.
- Resumed: operator approved only the exact Google/VK authorization paths, rejected
  every backend destination/port/fragment variant, and authorized recovery attempt
  2; temporary `TASK-043` was removed.

## [2026-07-18] TASK-030 halted after exhausted T3 retry budget
- Failed: final adversarial verification confirmed that backend-origin-only
  storefront validation rejects the legitimate VK ID authorization redirect.
- Preserved: all earlier concurrency, one-shot storage, logout/cart cleanup, token
  non-storage, and origin-hardening fixes remain verified.
- Blocked: direct dependents `TASK-031`, `TASK-032`, and `TASK-039`.
- Added: `TASK-043` and bug evidence for an authoritative Google/VK provider
  authorization-origin allowlist; run terminal state is `HALT_FAILURE_BUDGET`.
- Resumed: operator approved exact HTTPS origins `accounts.google.com` and
  `id.vk.com` plus one reviewed recovery attempt; temporary `TASK-043` was removed
  and `TASK-030` reopened.

## [2026-07-18] TASK-029 customer auth completion execute
- Added: backend-only Google/VK callback completion through Medusa Auth validation,
  Customer Module lookup, and the supported customer-account workflow.
- Guarded: duplicate/replayed callback state, same-email cross-provider collision,
  concurrent customer resolution, and session-save failure all fail closed without
  browser token handoff or automatic linking.
- Added: fixed sanitized storefront completion redirects plus bounded single-process
  start/completion limits that retain only salted key hashes and coarse counters.
- Added: synthetic integration assertions for reuse/create, collision, missing email,
  replay, redirect cleanup, bounded rate state, session save, and failure cleanup;
  no live provider credentials or provider calls are used.
- Fixed: callback ownership now remains serialized per provider identity through
  customer resolution, identity confirmation, session save, and compensation;
  post-create identity-read failure also removes the newly created customer/link
  through the supported Medusa workflow.
- Verified: final independent T3 functional and adversarial checks passed after
  retry 2/2; scheduler closed `TASK-029` with checkpoint and recovery evidence.

## [2026-07-18] TASK-028 VK ID Auth Module Provider execute
- Added: custom Medusa Auth Module Provider `vkid` with opaque single-use/expiring
  state, S256 PKCE, fixed backend callback, required `device_id`, and server-side
  authorization-code exchange.
- Mapped: matching VK token/user-info `user_id` to provider entity ID and required a
  normalized provider-returned email before identity creation.
- Guarded: callback state is consumed before exchange, provider tokens are discarded
  without persistence/logging, and cancel, malformed, replay, expiry, PKCE,
  identity, and upstream failures return one sanitized error.
- Added: synthetic provider-double integration coverage; live credentials and live
  provider calls remain excluded.
- Fixed: retry aligned confidential exchange with the VK ID `service_token` wire
  contract and proved mismatched `device_id` rejection before identity creation.
- Verified: independent functional and semantic T3 checks passed; scheduler closed
  `TASK-028` with checkpoint and rollback evidence.

## [2026-07-18] Sequential VPS image-build policy
- Changed: [DEPLOYMENT.md](../DEPLOYMENT.md) now builds production backend and
  storefront images directly on the VPS, strictly one at a time.
- Added: `sysstat` setup, live `sar` monitoring commands for RAM, swap, load, and
  disk activity, plus explicit stop conditions for an unstable build host.
- Updated: first deployment, update, and rollback procedures no longer depend on
  an external build host or transferred image archives.
- Preserved: the prior VPS reboot remains a documented capacity risk; monitoring
  does not remove that risk.

## [2026-07-18] TASK-027 OAuth configuration execute retry
- Added: backend-only Google/VK provider configuration, actor allowlists, explicit
  authenticated CORS, and bounded signed HttpOnly session-cookie policy.
- Guarded: Medusa Google auth start rejects caller-supplied `callback_url` for
  both GET and POST before the built-in provider can consume it.
- Added: sanitized configuration smoke coverage for provider callbacks, session
  policy, CORS, callback override rejection, and missing enabled-provider secrets.
- Fixed: non-local HTTPS/staging cookies are secure, and production startup fails
  closed when either signing secret is absent.
- Verified: independent functional and adversarial T3 review passed with human
  checkpoint and rollback/recovery evidence; scheduler closed `TASK-027`.

## [2026-07-17] Deterministic Medusa config image build
- Confirmed: the external Docker build contains
  `apps/backend/medusa-config.ts`; the failure is extensionless TypeScript
  config resolution inside the image, not a missing source COPY.
- Changed: the backend Docker build compiles the config to CommonJS
  `medusa-config.js` before running `medusa build`, avoiding dependence on
  runtime TypeScript loader registration.
- Verified locally: standalone config compilation, generated JavaScript syntax,
  backend typecheck, and the ordinary backend Medusa build.
- Preserved: failed CI images were not deployed; the VPS still has no
  application containers, PostgreSQL volume, migrations, seed, or production
  data.

## [2026-07-16] First deployment image-build blocker
- Cloned: production repository checkout `/opt/eshop/app` at commit `33b8fad`.
- Verified: DNS, SSH, production env-file permissions, Compose topology, and
  local typecheck/build gates.
- Blocked: the first backend Docker image build exceeded the current VPS
  capacity; a retry coincided with a confirmed host reboot before any image,
  container, volume, migration, seed, or production data was created.
- Changed: [DEPLOYMENT.md](../DEPLOYMENT.md) now prohibits application image
  builds on the current 1 vCPU / 1.7 GiB VPS and requires externally built
  `linux/amd64` archives loaded with `docker load` until a registry is selected.
- Pending: complete a Docker-capable external build host. Local Docker Desktop
  remains unavailable because its WSL backend requires an update and the
  attempted Hyper-V installer switch did not change the active backend.

## [2026-07-16] TASK-027 scheduler halt on OAuth callback boundary
- Blocked: `TASK-027` after Implementer preflight and independent Explorer evidence
  confirmed that Medusa 2.16 accepts caller-provided `callback_url` ahead of the
  configured Google callback URL.
- Preserved: the backend-controlled exact callback security contract; no runtime
  code, secrets, provider configuration, or forbidden scope was changed.
- Required: operator approval to extend `TASK-027` to the existing
  `apps/backend/src/api/middlewares.ts` guard boundary, refresh its Execution
  Packet, and resume scheduler-mode `/autopilot`.
- Terminal run state: `HALT_CLARIFICATION_REQUIRED`.
- Resumed: operator approved preserving the strict contract and adding the
  existing Medusa middleware boundary to `TASK-027`; scheduler reopened the task
  for one bounded retry.

## [2026-07-16] FT-005 manual SDD review remediation
- Decoupled: wishlist capability now requires successful backend current-customer
  retrieval and remains available during `merge_blocked`; cart merge continues to
  gate checkout only.
- Defined: one exact minimal `WishlistProductProjection` shared by list/add, using
  Product ID for durable identity and handle only for navigation.
- Clarified: visibility requires existing `published` product, current sales
  channel, and active category; out-of-stock remains visible/unavailable, while all
  hidden cases use the same non-disclosing `404 wishlist_product_not_found`.
- Corrected: acceptance artifacts may show synthetic product IDs/names and wishlist
  contents, but never real PII, production data, cookies, bearer values, OAuth
  tokens, session IDs, or secrets.
- Preserved: production storefront authentication remains session-cookie only;
  synthetic bearer is limited to the existing local harness through standard
  Medusa middleware.
- Refreshed: TASK-037 through TASK-042 and their R2 Execution Packets. TASK-035 and
  TASK-036 are unchanged; FT-005 `spec_design_status` remains `complete`.

## [2026-07-16] GitHub checkout path clarified
- Updated: [DEPLOYMENT.md](../DEPLOYMENT.md) and
  [DEPLOYMENT_process.md](../DEPLOYMENT_process.md) now explicitly require
  cloning the GitHub repository into `/opt/eshop/app`, not `/opt/eshop`, so
  deployment-owned `/opt/eshop/secrets` and `/opt/eshop/backups` stay outside
  the repository checkout.

## [2026-07-16] Production env placeholders completed
- Updated: VPS `backend.env` now includes explicit fake placeholders for Google
  OAuth, VK ID, YooKassa, and SMTP keys while preserving generated internal
  secrets.
- Updated: VPS `storefront.env` now includes explicit fake placeholders for
  Medusa publishable key and sales channel ID.
- Synced: [DEPLOYMENT.md](../DEPLOYMENT.md) and
  [DEPLOYMENT_process.md](../DEPLOYMENT_process.md) now document that values
  containing `fake`, `NOT_REAL`, or `not-real` must be replaced before enabling
  corresponding production features.

## [2026-07-16] Production env files created
- Created: VPS production env files under `/opt/eshop/secrets`:
  `postgres.env`, `backend.env`, and `storefront.env`, each owned by
  `eshop:eshop` with mode `600`.
- Generated: PostgreSQL password, `JWT_SECRET`, and `COOKIE_SECRET` without
  recording secret values in repository docs or chat output.
- Recorded: `storefront.env` still contains a publishable-key placeholder;
  Google OAuth, VK ID, YooKassa, and SMTP variables remain absent until their
  features and credentials are production-ready.
- Synced: [DEPLOYMENT_process.md](../DEPLOYMENT_process.md) now reflects the
  production env checkpoint and remaining env gaps.

## [2026-07-16] FT-005 feature design and task decomposition
- Completed: feature-level SDD for authenticated product favorites, PostgreSQL
  ownership/uniqueness, Store API idempotency/security, unavailable-product
  behavior, storefront state, and guest non-persistence.
- Added: FT-005 feature hub, wishlist data spec, wishlist API/security contract,
  planning protocol, and implementation plan.
- Planned: TASK-035 through TASK-042 across module persistence, additive product
  IDs, workflows/projection, authenticated API, storefront state/UI, and real
  backend/browser acceptance.
- Packets: canonical ready packets created for all eight tasks; TASK-035 and
  TASK-036 are initially `ready`, while downstream tasks remain `planned`.
- Unchanged: REQ-009 and FT-005 remain planned until implementation and
  tier-required verification complete.

## [2026-07-16] Server-build deployment policy
- Updated: [DEPLOYMENT.md](../DEPLOYMENT.md) now states that local development
  and verification run without Docker, while production deployment uses Docker
  Compose on the VPS.
- Changed: first deployment, update, and rollback procedures now build backend
  and storefront images sequentially on the VPS until a registry is introduced.
- Updated: production configuration uses the single Cloudflare DNS name
  `eshop.natureonzoom.win`; Caddy routes backend paths to Medusa and all other
  requests to the storefront.
- Synced: [DEPLOYMENT_process.md](../DEPLOYMENT_process.md) and system
  architecture deployment assumptions with the server-build policy.

## [2026-07-16] Cloudflare DNS checkpoint
- Updated: [DEPLOYMENT.md](../DEPLOYMENT.md) records the Cloudflare `A` record
  for `eshop.natureonzoom.win` pointing to `79.133.183.183` with proxy status
  `DNS only` and TTL `Auto`.

## [2026-07-16] Deployment artifacts baseline
- Added: `.dockerignore`, backend/storefront Dockerfiles, and
  `compose.production.yml` for the KISS VPS Docker Compose deployment path.
- Updated: storefront Next config now uses standalone output for the production
  image runtime.
- Synced: `DEPLOYMENT.md` and `DEPLOYMENT_process.md` now record the repository
  deployment artifact checkpoint and the one-time registry image-name replacement
  still required before first registry-based deployment.
- Verified locally: Compose config, backend/storefront typecheck, storefront
  production build, backend Medusa production build. Docker image build was not
  run because the local Docker daemon was unavailable.

## [2026-07-16] FT-004 feature design and task decomposition
- Completed: feature-level SDD for Google OAuth, VK ID, Medusa customer sessions,
  callback/redirect security, identity collision policy, post-auth cart handoff,
  checkout gate, logout, abuse controls, and provider-double verification.
- Added: FT-004 feature hub, auth runtime architecture, auth/session security
  contract, customer auth/session lifecycle, and implementation plan.
- Planned: T3 TASK-027 through TASK-034 across configuration, VK provider,
  callback/session, storefront state/UI, checkout gate, backend persistence
  acceptance, and real-browser acceptance.
- Packets: canonical ready packets created for TASK-027 through TASK-034; only
  TASK-027 is initially `ready`, while dependent tasks remain `planned`.
- Unchanged: REQ-010 through REQ-012 and FT-004 remain planned until implementation
  and tier-required verification complete. Live Google/VK credentials are a human
  UAT input and are never required by automated tests.

## [2026-07-13] FT-003 manual closure sync
- Closed: FT-003 lifecycle is `verified` after direct user authorization and
  feature-level `SEMANTIC_VERDICT: semantic-pass`.
- Synced: REQ-006 guest cart updates, REQ-007 browser persistence, and REQ-008
  authenticated same-variant merge are `verified` in the RTM.
- Confirmed: all indexed FT-003 tasks are `done`; the source-runtime acceptance
  fixture blocker is archived as resolved.
- Unchanged: EP-002 remains `planned` because FT-004 OAuth and FT-005 wishlist
  work is not complete.

## [2026-07-13] FT-003 feature red-verification retry
- Result: feature-level `/red-verify --feature FT-003` retry returned
  `SEMANTIC_VERDICT: semantic-pass`.
- Confirmed: canonical seed, source product-detail smoke, and real backend
  cart-merge acceptance now pass in sequence; real browser provider-handoff E2E
  remains passing.
- Resolved: historical source-runtime fixture reproducibility blocker is archived
  after supported product-to-sales-channel reconciliation.
- Not promoted: feature/requirement lifecycle remains under explicit closure and
  sync ownership.

## [2026-07-13] FT-003 backend acceptance fixture remediation
- Fixed: canonical seed now idempotently links already-existing canonical
  products to the selected default sales channel.
- Root cause: source `medusa exec` smoke and acceptance scripts queried that
  channel, while existing canonical products remained linked only to a previous
  channel after an idempotent seed run.
- Verified: `seed:medusa:catalog`, `smoke:product-detail`, and
  `test:integration -- cart-merge-acceptance` pass in sequence against local
  Medusa/PostgreSQL without manual repair.
- Follow-up: repeat feature-level `/red-verify --feature FT-003` before
  promoting FT-003 or REQ-006 through REQ-008.

## [2026-07-13] FT-003 feature red-verification
- Result: `/red-verify --feature FT-003` returned
  `SEMANTIC_VERDICT: semantic-concern`.
- Confirmed: the real compiled Medusa/PostgreSQL browser flow passes guest
  create/update/remove, persistence, actual provider-handoff merge,
  consumed-source `404`, and stale-context replay without duplicate quantity.
- Found: after successful canonical local seed, source-runtime product-detail
  smoke and required `cart-merge-acceptance` cannot find a sellable canonical
  fixture. The independent backend acceptance gate is therefore not
  reproducible.
- Recorded: [.memory-bank/bugs/FT-003-backend-acceptance-fixture-reproducibility.md](bugs/FT-003-backend-acceptance-fixture-reproducibility.md).
- Not promoted: FT-003 and REQ-006 through REQ-008 remain `planned` pending
  remediation and a repeated feature-level semantic pass.

## [2026-07-12] TASK-026 verification blocker
- Verified: Windows-native smoke, real Medusa/PostgreSQL Playwright cart suite,
  workspace typecheck, and Memory Bank lint all pass.
- Found: the Playwright merge step bypasses the storefront post-auth handoff by
  directly calling the merge route and manually writing the target cart
  reference.
- Recorded: `.memory-bank/bugs/TASK-026-browser-merge-handoff-bypass.md`.
- Status: `/verify TASK-026` is `VERDICT: FAIL`; task closure is not eligible
  until browser acceptance exercises the actual storefront handoff.

## [2026-07-12] TASK-026 browser handoff remediation
- Approved: the user authorized a minimal E2E-only trigger in `CartProvider`.
- Updated: Playwright now invokes the actual `mergeAfterAuthentication()`
  handoff with a synthetic local bearer fixture, and repeats replay from a stale
  browser context that still holds the consumed-source reference.
- Scope: no provider login UI, live OAuth, production data, backend merge
  behavior, checkout, order, inventory reservation, or payment behavior added.
- Verified: re-run browser acceptance now exercises the actual provider handoff
  for both merge and stale-context replay; Windows-native smoke, workspace
  typecheck, and Memory Bank lint pass.
- Status: the earlier `/verify` blocker is resolved; TASK-026 now has functional
  `/verify PASS` pending T3 per-task semantic verification and closure markers.

## [2026-07-12] TASK-026 red-verification
- Result: per-task `/red-verify TASK-026` returned
  `SEMANTIC_VERDICT: semantic-pass`.
- Confirmed: browser acceptance invokes the actual provider handoff, synthetic
  bearer auth is E2E-only, stale-context replay adopts the recorded target with
  no duplicate quantity, and no production/OAuth/checkout/order/payment scope
  was introduced.
- Not closed: TASK-026 remains `planned` pending an explicit T3 closure owner
  and required human/rollback markers.

## [2026-07-12] TASK-026 manual closure sync
- Closed: `TASK-026` is now `done` after explicit manual closure approval from
  the user.
- Confirmed: latest `/verify TASK-026` is `VERDICT: PASS` and per-task
  `/red-verify TASK-026` is `SEMANTIC_VERDICT: semantic-pass`.
- Recorded T3 markers: `HUMAN_CHECKPOINT: done` and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Synced: task record, protocol/evidence links, required packet hash, and
  changelog.
- Not promoted: no dependent task was advanced during `/mb-sync`; FT-003 and
  REQ-006 through REQ-008 remain pending feature-level semantic verification.

## [2026-07-11] VPS deployment foundation
- Confirmed actual VPS capacity after reboot: AlmaLinux 9.8 on `1 vCPU`, about
  `1.7 GiB` RAM, `30 GB` disk with about `23 GB` free, and kernel
  `5.14.0-687.20.1.el9_8.x86_64`; this supersedes the earlier planned 2 vCPU /
  2 GB snapshot.
- Added deployment user `eshop`: key-only SSH through a local private key,
  password and keyboard-interactive login disabled only for that user, and
  Docker-group access. Root SSH configuration was not changed.
- Added persistent 1.5 GiB `/swapfile-eshop` alongside the existing 512 MiB
  swapfile, providing 2.0 GiB total swap.
- Installed and verified Docker Engine 29.6.1, Docker Compose v5.3.1, and Caddy
  2.11.4. Docker is enabled; Caddy remains inactive until domains, Caddyfile,
  and firewall rules are ready.
- Created `/opt/eshop` and `/opt/eshop/secrets` for the deployment user. The
  repository checkout path is `/opt/eshop/app` so secrets do not conflict with
  Git checkout.
- Restructured: [DEPLOYMENT.md](../DEPLOYMENT.md) is the deployment handoff;
  [DEPLOYMENT_process.md](../DEPLOYMENT_process.md) preserves preparation
  history, the legacy plan archive, and remaining deployment work.

## [2026-07-11] TASK-026 browser cart acceptance execute
- Added: explicit storefront `cart` E2E suite over the real local
  Medusa/PostgreSQL runtime and Playwright browser.
- Covered: product-detail guest cart creation, reference-only browser storage,
  absolute quantity update, line removal, reload/new-context restore, synthetic
  local customer auth, authenticated merge into a backend-selected existing
  customer cart, consumed-source Store not-found behavior, and completed replay
  without duplicate quantity.
- Updated: storefront package scripts now include `test:e2e:cart` as a narrow
  alias for the cart acceptance suite.
- Updated: user-selected Москва/RUB first-cart policy and configured public sales
  channel context now let production product-detail add create a Medusa guest
  cart without browser-authoritative cart data.
- Verified: real browser acceptance covers guest cart creation, update/remove,
  reload/new-context persistence, exact authenticated merge, consumed-source
  Store not-found, and replay without duplicate quantity.
- Status: `/execute` implementation handoff is complete; TASK-026 task-record
  status remains `planned` pending independent `/verify`, per-task
  `/red-verify`, and T3 closure markers.

## [2026-07-11] TASK-023 manual closure sync
- Closed: `TASK-023` is now `done` after explicit manual instruction from the
  user to check the task state and do it if not done.
- Confirmed: existing `/verify TASK-023` is `VERDICT: PASS`; fresh closure gates
  passed for cart-view tests, product-detail regression, storefront typecheck,
  Memory Bank lint, and strict doctor.
- Synced: task record, closure protocol/report, command evidence, required packet
  hash, and changelog.
- Not required: per-task `/red-verify` and T3 markers are not required for this
  T2 task closure.
- Not promoted: no dependent task was advanced during this sync; FT-003 remains
  planned until TASK-026 and feature-level semantic verification are complete.

## [2026-07-10] TASK-025 manual closure sync
- Closed: `TASK-025` is now `done` after explicit manual closure approval from
  the user.
- Confirmed: `/verify TASK-025` is `VERDICT: PASS` and per-task
  `/red-verify TASK-025` is `SEMANTIC_VERDICT: semantic-pass`.
- Recorded T3 markers: `HUMAN_CHECKPOINT: done` and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Synced: task record, protocol/evidence links, required packet hash, and
  changelog.
- Not promoted: no dependent task was advanced during `/mb-sync`; FT-003 and
  REQ-008 remain `planned` until downstream TASK-026 and feature-level semantic
  verification are complete.

## [2026-07-10] TASK-025 backend cart merge acceptance execute
- Added: backend `cart-merge-acceptance` integration suite over real
  Medusa/PostgreSQL route, workflow, module, cart, and customer boundaries.
- Covered: transfer with incompatible target isolation, deterministic
  existing-target selection, same-variant summing, foreign ownership denial,
  stock conflict no-mutation, journal-first replay, in-progress concurrency
  response, consumed-source not-found behavior, and injected post-soft-delete
  recovery.
- Verified locally during `/execute`: backend cart-merge acceptance suite,
  backend typecheck, and Memory Bank lint pass.
- Status: `/execute` implementation handoff is complete; TASK-025 remains
  `planned` pending independent `/verify`, per-task `/red-verify`, and T3
  closure markers.

## [2026-07-10] TASK-024 manual closure sync
- Closed: `TASK-024` is now `done` after explicit manual closure instruction from
  the user.
- Confirmed: `/verify TASK-024` is `VERDICT: PASS` and per-task
  `/red-verify TASK-024` is `SEMANTIC_VERDICT: semantic-pass`.
- Recorded T3 markers: `HUMAN_CHECKPOINT: done` and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Synced: task record, protocol/evidence links, required packet hash, and
  changelog.
- Not promoted: no dependent task was advanced during `/mb-sync`; FT-003 and
  REQ-008 remain `planned` until downstream TASK-025/TASK-026 and feature-level
  semantic verification are complete.

## [2026-07-09] TASK-024 post-auth cart merge handoff execute
- Added: storefront `cart-merge` handoff client for authenticated
  `POST /store/carts/{source_cart_id}/merge` with `credentials: include`, an
  empty request body, and no client-chosen destination/customer identity.
- Updated: cart provider now exposes a provider-agnostic
  `mergeAfterAuthentication` method for FT-004 to invoke after auth without
  adding OAuth provider logic.
- Added: focused cart-merge tests for request shape, backend-selected target
  adoption, replay, failure/source-reference preservation, and provider
  boundary scope.
- Verified locally during `/execute`: focused cart-merge tests, storefront
  typecheck, and Memory Bank lint pass.
- Status: `/execute` implementation handoff is complete; TASK-024 remains
  `planned` pending independent `/verify`, per-task `/red-verify`, and T3
  closure markers.

## [2026-07-09] VPS deployment runbook KISS image tags
- Updated: [DEPLOYMENT.md](../DEPLOYMENT.md) now uses stable `production`
  image tags for backend/storefront instead of a manually edited
  `ESHOP_VERSION`/`compose.env` flow.
- Updated: VPS resource snapshot now reflects 2 vCPU / 2 GB RAM and keeps
  swap/disk as values to re-check after the tariff change.
- Synced: system architecture deployment assumptions now record the stable
  `production` tag policy and leave only the external PostgreSQL backup target
  as an open VPS deployment question.

## [2026-07-09] TASK-023 product detail and cart UI execute
- Added: root cart provider wiring, `/cart` route, and a buyer-visible cart view
  for backend-returned items/totals, restore, absolute quantity update, remove,
  stale reference recovery, validation, conflict, and backend failure states.
- Updated: product detail now calls guest-cart add with the validated Medusa
  Product Variant ID from the FT-002 handoff while preserving blocked selection
  guards.
- Added: focused cart-view source/component contract tests and product-detail
  regression checks.
- Verified locally during `/execute`: focused cart-view tests, product-detail
  regression, storefront typecheck, Memory Bank lint, full storefront unit
  regression, and strict doctor pass.
- Status: `/execute` implementation handoff is complete; TASK-023 remains
  `ready` pending independent `/verify` and closure by the appropriate owner.

## [2026-07-09] TASK-022 manual closure sync
- Closed: `TASK-022` is now `done` after explicit manual closure instruction
  from the user.
- Confirmed: `/verify TASK-022` is `VERDICT: PASS` and per-task
  `/red-verify TASK-022` is `SEMANTIC_VERDICT: semantic-pass`.
- Opened: `TASK-023` is now `ready` for `/execute`; its only dependency
  `TASK-022` is closed and its required packet is ready/hash-matched.
- Synced: task records, protocol/evidence links, packet hashes, and changelog.
- Not promoted: FT-003, REQ-006, and REQ-007 remain `planned`; feature-level
  completion still requires downstream tasks and `/red-verify --feature FT-003`.

## [2026-07-09] TASK-022 red-verification
- Result: per-task `/red-verify TASK-022` returned
  `SEMANTIC_VERDICT: semantic-pass`.
- Confirmed: guest-cart state remains a bounded frontend state boundary over the
  TASK-018 Store client/reference adapter; backend responses remain truth,
  browser storage stays reference-only, stale references clear without
  reconstruction, and backend failures remain retryable.
- Scope: no cart page, product-detail rendering, authenticated merge, OAuth,
  backend, checkout, order, inventory, or payment scope was added.
- Not closed: `TASK-022` remains `planned`; this optional T2 per-task
  semantic-pass does not replace the later feature-level
  `/red-verify --feature FT-003` after all FT-003 tasks.

## [2026-07-09] TASK-022 independent verification
- Verified: manual `/verify TASK-022` passed for guest-cart state
  orchestration.
- Evidence: focused `cart-state` tests and full storefront unit regression pass
  for lazy create, restore, reference-only persistence, backend-response
  adoption, stale clear, absolute update/remove, validation, conflict, backend
  failure, and loading states.
- Gates: storefront typecheck, Memory Bank lint, strict doctor, and packet hash
  checks passed.
- Not closed: `TASK-022` remains `planned`; per-task `/red-verify TASK-022` is
  running next because it was explicitly requested, while feature-level
  `/red-verify --feature FT-003` remains a later gate after all FT-003 tasks.

## [2026-07-09] TASK-022 guest cart state execute
- Added: storefront guest-cart state orchestration over the TASK-018 Store cart
  client and reference adapter.
- Added: a thin cart provider boundary for later UI integration without cart
  page/product-detail rendering.
- Added: focused cart-state tests covering lazy create, restore, reference-only
  persistence, absolute update/remove adoption, stale clear, validation,
  conflict, backend failure, and loading states.
- Verified locally during `/execute`: focused cart-state tests, storefront
  typecheck, Memory Bank lint, full storefront unit regression, and strict
  doctor pass.
- Status: `/execute` implementation handoff is complete; TASK-022 remains
  `planned` pending independent `/verify` and closure by the appropriate owner.

## [2026-07-09] TASK-021 manual closure sync
- Closed: `TASK-021` is now `done` after explicit manual closure approval from
  the user.
- Confirmed: `/verify TASK-021` is `VERDICT: PASS`, per-task
  `/red-verify TASK-021` is `SEMANTIC_VERDICT: semantic-pass`, and T3 markers
  are present: `HUMAN_CHECKPOINT: done` and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Synced: task record, protocol state, packet hash, and changelog.
- Not promoted: no dependent task was advanced during `/mb-sync`; TASK-022
  readiness remains a separate scheduler/manual decision.

## [2026-07-08] TASK-021 red-verification
- Result: per-task `/red-verify TASK-021` returned
  `SEMANTIC_VERDICT: semantic-pass`.
- Confirmed: authenticated merge API preserves actor-derived identity,
  path-derived source identity, strict empty-body authority rejection,
  journal-first customer-checked replay, stable in-progress/stock-conflict
  responses, and route-level delegation to TASK-019/TASK-020.
- Gates: cart merge API integration, backend typecheck, Memory Bank lint,
  strict doctor, packet hash, and scope/security scans passed.
- Not closed: TASK-021 remains `planned`; T3 closure still requires exact
  `HUMAN_CHECKPOINT: done` under an explicit closure owner.

## [2026-07-08] TASK-021 independent verification
- Verified: manual `/verify TASK-021` passed for the authenticated cart merge
  API boundary.
- Evidence: `cart-merge-api` integration passed against Medusa/PostgreSQL and
  proved auth-required behavior, empty-body validation, transfer, merge,
  journal-first replay, replay no-duplication, replay foreign-customer denial,
  in-progress response, and stock-conflict stability.
- Gates: backend typecheck, Memory Bank lint, strict doctor, packet hash, and
  scope/security scans passed.
- Not closed: TASK-021 remains `planned`; T3 closure still requires per-task
  `/red-verify TASK-021` semantic-pass and `HUMAN_CHECKPOINT: done`.

## [2026-07-07] TASK-021 authenticated cart merge API execute
- Added authenticated `POST /store/carts/:id/merge` Store API route backed by
  TASK-019 planning and TASK-020 lifecycle workflow.
- Added route middleware for customer authentication and strict route-owned
  empty-body validation to keep stable `cart_merge_invalid_request` envelopes.
- Added PostgreSQL-backed Medusa integration smoke covering auth, invalid body,
  transfer, merge, journal-first replay, foreign source denial, pending journal,
  and stock conflict.
- Verified locally during `/execute`: cart merge API integration, backend
  typecheck, TASK-020 lifecycle regression, Memory Bank lint, and scope audit
  pass.
- Not closed: `TASK-021` remains `planned`; T3 closure still requires
  `/verify TASK-021`, per-task `/red-verify TASK-021`, and exact
  `HUMAN_CHECKPOINT: done`.

## [2026-07-07] TASK-020 manual closure sync
- Closed: `TASK-020` is now `done` after explicit manual closure instruction
  from the user.
- Confirmed: repeated `/verify TASK-020` is `VERDICT: PASS`, repeated
  per-task `/red-verify TASK-020` is `SEMANTIC_VERDICT: semantic-pass`, and T3
  markers are present: `HUMAN_CHECKPOINT: done` and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Synced: task record, protocol state, packet hash, and changelog.
- Not promoted: no dependent task was advanced during `/mb-sync`; TASK-021
  readiness remains a separate scheduler/manual decision.

## [2026-07-07] TASK-020 repeated red-verification
- Result: repeated per-task `/red-verify TASK-020` returned
  `SEMANTIC_VERDICT: semantic-pass` after duplicate target-line remediation.
- Confirmed: TASK-019 planning, linked SDD aggregation semantics, and TASK-020
  lifecycle now align for duplicate target same-variant lines.
- Resolved: `.memory-bank/bugs/TASK-020-duplicate-target-variant-lines.md`.
- Not closed: TASK-020 remains `planned`; T3 closure still requires exact
  `HUMAN_CHECKPOINT: done` under an explicit closure owner.

## [2026-07-07] TASK-020 repeated verification after duplicate-line repair
- Verified: repeated manual `/verify TASK-020` passed after duplicate target
  variant-line remediation.
- Evidence: lifecycle integration now includes
  `targetDuplicateVariantLinesMerged: true`; backend typecheck, Memory Bank
  lint, and strict doctor pass.
- Status: TASK-020 remains `planned`; previous per-task `/red-verify` is still
  `semantic-fail` until repeated after this repair, and T3 closure still
  requires `HUMAN_CHECKPOINT: done`.

## [2026-07-07] TASK-020 duplicate target-line remediation
- Repaired: TASK-020 runtime now validates target before-state by aggregate
  Product Variant ID quantity plus planned anchor-line presence instead of
  rejecting duplicate target lines.
- Added: lifecycle regression creates duplicate target same-variant lines
  through Medusa `addToCartWorkflow`, proves compensation restores the
  aggregate, and proves success reaches the exact summed target quantity.
- Verified locally during `/execute`: backend typecheck, cart-merge lifecycle
  integration, TASK-017/TASK-019 regression, Memory Bank lint, and scope scan
  pass.
- Not closed: previous `/red-verify` remains `semantic-fail` until rerun;
  TASK-020 remains `planned` pending repeated `/verify`, repeated
  `/red-verify`, and `HUMAN_CHECKPOINT: done`.

## [2026-07-07] TASK-020 red-verification
- Result: per-task `/red-verify TASK-020` returned
  `SEMANTIC_VERDICT: semantic-fail`.
- Blocker: linked FT-003 SDD and TASK-019 planning aggregate source and target
  lines by `variant_id`, but TASK-020 runtime rejects target carts that contain
  more than one line for a planned target variant.
- Recorded: `.memory-bank/bugs/TASK-020-duplicate-target-variant-lines.md`.
- Not closed: TASK-020 remains `planned`; repair, repeat `/verify`, repeat
  `/red-verify`, and human checkpoint are required before T3 closure.

## [2026-07-07] TASK-020 independent verification
- Verified: repeated manual `/verify TASK-020` passed after the core-workflow
  remediation. The runtime now uses Medusa core workflows for ownership and
  target-line mutation, with direct Cart Module calls limited to source
  soft-delete/restore.
- Evidence: cart merge lifecycle integration, backend typecheck, Memory Bank
  lint, and strict doctor pass. Integration assertions cover exact quantities,
  poisoned source pricing isolation, target totals, taxes, promotions, ordering,
  restore-first compensation, retry, and stock conflict.
- Resolved: `.memory-bank/bugs/TASK-020-core-cart-workflow-bypass.md`.
- Not closed: TASK-020 remains `planned` because T3 closure still requires
  per-task `/red-verify TASK-020` semantic-pass and `HUMAN_CHECKPOINT: done`.

## [2026-07-05] TASK-020 core cart workflow remediation
- Replaced direct ownership and target line-item mutations with composed Medusa
  `transferCartCustomerWorkflow`, `addToCartWorkflow`, and forced
  `refreshCartItemsWorkflow` execution under the existing sorted cart locks.
- Retained direct Cart Module calls only for source `softDeleteCarts` and
  restore-first `restoreCarts` compensation.
- Added PostgreSQL-backed evidence that poisoned source pricing is not copied,
  final absolute quantities and totals match a reference Medusa cart, and
  positive tax totals and promotion discounts are recalculated.
- Local lifecycle, TASK-017/TASK-019 regression, backend typecheck, and Memory
  Bank lint gates pass; independent `/verify` and per-task `/red-verify` remain
  required before T3 closure.

## [2026-07-04] TASK-020 compensatable cart merge lifecycle
- Added: a T3 Medusa workflow with sorted cart locks, immutable-plan journal
  lifecycle, core inventory confirmation, exact target mutations, and
  no-target ownership transfer.
- Added: existing-target source soft-delete after target mutation, restore-first
  compensation, reverse target rollback, failed-journal guarded retry, and
  completion only after source disposition succeeds.
- Added: real Medusa/PostgreSQL integration coverage for ownership transfer,
  injected post-soft-delete failure, successful retry, journal ordering, and
  stock-conflict no-mutation behavior.
- Verify failed: quantity/lifecycle gates pass, but ownership and target-line
  changes bypass the required Medusa core cart workflows and directly copy
  source pricing snapshots; target pricing/tax/promotion correctness is not
  proven.
- Blocked: recorded
  `.memory-bank/bugs/TASK-020-core-cart-workflow-bypass.md`; repair and repeat
  `/verify` before per-task `/red-verify`, human checkpoint, or T3 closure.

## [2026-07-04] TASK-018 Store cart client and browser reference adapter
- Added: a typed storefront client for the installed Medusa Store create,
  retrieve, add-line, absolute update-line, and remove-line cart routes.
- Added: versioned `eshop.cart.v1` browser persistence containing only the
  opaque cart ID, plus invalid/stale reference clearing.
- Added: deterministic client-side validation and stable application error codes
  without exposing transport details or persisting authoritative cart data.
- Verified independently: manual T2 `/verify` passed installed-route inspection,
  focused and full storefront tests, typecheck, strict doctor, and Memory Bank
  lint.
- Synced: task verification evidence, protocol state, and required packet hash
  are consistent; FT-003, EP-002, REQ-006, and REQ-007 correctly remain
  `planned`.
- Closed: after explicit user instruction, `GENERAL` recorded TASK-018 as
  `done`; no dependent promotion was performed, and no cart UI, authenticated
  merge, OAuth, or checkout was added.

## [2026-07-04] TASK-019 deterministic cart merge planning
- Added: read-only Medusa Cart Module planning state, actor-scoped destination
  candidates, deterministic `updated_at DESC, id ASC` target selection, and
  immutable absolute-quantity plans keyed by Product Variant ID.
- Added: real Medusa/PostgreSQL integration coverage for actor scoping,
  compatibility rejection, same-variant aggregation, tie-breaking, ownership
  guards, malformed/overflow quantities, transfer mode, and read-before/after
  no-mutation proof.
- Verified locally during `/execute`: cart-merge-plan integration, TASK-017
  persistence regression, backend typecheck, planning-slice mutation scan, and
  Memory Bank lint.
- Verified independently: manual T2 `/verify` passed packet/spec gates, real
  Medusa Cart Module/PostgreSQL planning integration, backend typecheck, strict
  doctor, and Memory Bank lint.
- Synced: task verification evidence, protocol state, and required packet hash
  are consistent; FT-003, EP-002, and REQ-008 correctly remain `planned`.
- Closed: after explicit user instruction, `GENERAL` recorded TASK-019 as
  `done`; no dependent promotion was performed, and no mutation, HTTP/auth,
  journal transitions, or storefront behavior was introduced.

## [2026-07-04] TASK-017 cart merge journal implementation
- Added: registered Medusa `cartMerge` module with one PostgreSQL-backed `CartMerge` journal model, generated migration, unique active `source_cart_id`, actor/status and target indexes, and no cross-module foreign keys.
- Added: a two-process Medusa exec smoke that creates a journal, proves duplicate-source rejection, and reads the same record after fresh runtime/module resolution.
- Verified: independent manual T2 `/verify` passed packet/spec gates, strict doctor, repeated migration, PostgreSQL persistence/uniqueness, migration-scope inspection, backend typecheck, and Memory Bank lint.
- Closed: `TASK-017` is `done`; FT-003 and REQ-008 remain `planned` because the
  merge behavior is distributed across TASK-019..TASK-026.
- Synced: task index, closure evidence, protocol, packet reference/hash,
  changelog, feature lifecycle, and RTM are consistent. TASK-019 is legally
  promotion-eligible but remains `planned` pending a separate status-transition
  owner after `/mb-sync`.

## [2026-07-03] FT-003 repaired task decomposition
- Refreshed: `IMPL-FT-003`, TASK-017..TASK-026, and all required Execution Packets from the consumed-source soft-delete SDD repair.
- Split: merge planning, compensatable lifecycle, authenticated API, guest state, cart UI, post-auth handoff, backend acceptance, and browser acceptance now have separate bounded tasks.
- Covered: source `softDeleteCarts`, compensation `restoreCarts`, journal-first replay, consumed-source Store not-found behavior, and exact packet hashes.
- Next gate: strict `/mb-doctor` at the feature/task-queue boundary before TASK-017 or TASK-018 execution.

## [2026-07-02] FT-003 consumed-source SDD repair
- Decided: after a successful merge into an existing customer cart, the guest source cart is soft-deleted through the Medusa Cart Module; a no-target ownership transfer keeps the source active as the target.
- Defined: completed replay queries the durable merge journal before source retrieval, ordinary Store CRUD for the consumed source returns not found, and compensation restores the source before reverting target mutations.
- Preserved: source cart and line data are not hard-deleted or cleared, Medusa Core remains unchanged, and no cross-route middleware wrapper is introduced.
- Required next route: rerun `/prd-to-tasks FT-003` to update the pre-repair implementation plan, TASK records, and Execution Packets before any FT-003 `/execute`.

## [2026-07-02] FT-003 SDD and task decomposition
- Completed: feature-level SDD for guest cart persistence and authenticated merge across architecture/component, REST API, event, boundary payload, persistence, state, and security/access contracts.
- Reused: Medusa Cart Module and built-in Store cart/line-item routes; added only the missing authenticated merge endpoint design and a small PostgreSQL-backed idempotency/recovery journal.
- Added: `IMPL-FT-003`, schema-backed `TASK-017`..`TASK-022`, and ready hash-matched Execution Packets.
- Routed: TASK-017 and TASK-018 are ready; authenticated merge/handoff/final verification tasks are T3 and retain required security, human-checkpoint, and rollback/recovery gates.
- Next gate: strict `/mb-doctor` at the FT-003 feature/task-queue boundary before `/execute`.

## [2026-07-02] FT-002 semantic repair
- Fixed: product-detail media now crosses canonical Medusa Query, Store API, and storefront rendering as a consistent URL-string contract.
- Added: image-bearing canonical fixture reconciliation plus real-browser proof that the product image URL loads successfully.
- Hardened: variants without a usable SKU remain non-sellable and cannot reach the FT-002 cart-action handoff.
- Verified: repeated canonical seed, product-detail integration, backend/storefront typechecks, storefront unit coverage, compiled Medusa browser E2E, and strict doctor pass.
- Result: repeated feature-level red-verification returns `SEMANTIC_VERDICT: semantic-pass`; FT-002 and EP-001 lifecycle are synchronized to `verified`.

## [2026-07-01] FT-001 semantic completion
- Verified: repeated `/red-verify --feature FT-001` returned `SEMANTIC_VERDICT: semantic-pass` after TASK-015 and TASK-016 remediation.
- Updated: FT-001 lifecycle and REQ-001..REQ-003 RTM lifecycle to `verified`; EP-001 lifecycle advanced to `implemented`.
- Confirmed: canonical Medusa catalog ownership, real Store middleware/browser flow, publishable-key sales-channel scope, inventory-backed availability, and Medusa Product Variant ID handoff.

## [2026-07-01] TASK-016 real Medusa Store E2E
- Replaced: Playwright startup through `apps/backend/test/catalog-e2e-server.cjs` with the compiled real Medusa backend and canonical PostgreSQL catalog.
- Added: storefront `x-publishable-api-key` headers for catalog/product-detail reads and Medusa Product Variant ID in the validated cart-action handoff.
- Verified: missing key returns HTTP 400, seeded key returns HTTP 200, catalog and product-detail browser flows pass in Edge, traces/screenshots are present, and backend/storefront ports are released.
- Closed: `TASK-016` as `done` after manual T2 `VERDICT: PASS`; FT-001 remains `implemented` until repeated feature-level red-verification.

## [2026-07-01] TASK-015 canonical Medusa catalog
- Replaced: direct runtime reads and local schema creation for parallel `eshop_local_catalog_*` tables with Medusa Query graph access.
- Added: an idempotent workflow seed for Medusa categories, product types, products, options, variants, RUB prices, inventory levels, a stock location, sales-channel links, and a publishable API key.
- Updated: Store catalog and product-detail routes now use request scope plus publishable-key sales-channel context and expose stable Medusa Product Variant IDs.
- Verified: repeated seed creates no duplicates; backend typecheck, full Medusa backend/Admin build, and real-container catalog/product-detail integration pass.
- Closed: `TASK-015` as `done` after manual T2 `VERDICT: PASS`; FT-001 remains `implemented` pending TASK-016 real-runtime browser E2E and repeated feature red-verification.

## [2026-07-01] Medusa backend foundation repair
- Added: the official Medusa `2.16.0` application dependency surface, explicit default draft-order plugin, and a complete regenerated npm lockfile.
- Fixed: Medusa configuration normalization, compiled TypeScript emission, production start directory, source/compiled `.env` loading, and extensionless runtime route imports.
- Applied: local Medusa module migrations and link synchronization against PostgreSQL.
- Verified: backend typecheck and full Medusa backend/Admin build pass; the compiled backend starts and returns HTTP 200 from `/health`, while Store routes enforce the real Medusa publishable-key middleware.
- Remaining: FT-001 still requires browser E2E through the real Store route before repeated feature red-verification.

## [2026-07-01] FT-001 feature red-verification
- Result: `/red-verify --feature FT-001` returned `SEMANTIC_VERDICT: semantic-fail`; FT-001 remains `implemented` and is not eligible for `verified`.
- Confirmed: catalog integration and Playwright behavior pass against seeded PostgreSQL data, but E2E uses a test-only backend harness that bypasses the Medusa runtime.
- Blocked: the Medusa backend build fails on unresolved `@medusajs/utils`, and the parallel `eshop_local_catalog_*` model has no proven Medusa Product/Variant, cart, inventory, or Admin integration boundary.
- Updated: REQ-001..REQ-003 lifecycle returned to `implemented` pending remediation and repeated feature-level red-verification.

## [2026-06-30] TASK-014 final verification and closure
- Verified: fresh manual `/verify TASK-014` passed Windows-native smoke, backend product-detail integration, storefront product-detail E2E, Memory Bank lint, and packet/spec gate checks.
- Closed: `TASK-014` as `done` with T2 closure ownership by GENERAL after executable evidence and prior per-task semantic-pass red-verification.
- Updated: RTM lifecycle for `REQ-004` and `REQ-005` to `verified`; `FT-002` lifecycle to `implemented`, with feature-level `/red-verify --feature FT-002` still required before treating the feature as semantically complete.

## [2026-06-30] Red-verify all indexed tasks
- Added: per-task `/red-verify` protocol and final report artifacts for `TASK-001` through `TASK-014`.
- Result: all indexed tasks received `SEMANTIC_VERDICT: semantic-pass` in per-task mode.
- Note: task statuses were not changed; `TASK-014` still requires `/verify TASK-014`, and feature-level red-verification remains separate for `FT-001`/`FT-002` completion.

## [2026-06-30] TASK-014 FT-002 integration and e2e execution
- Added: product-detail route coverage to the local E2E backend harness and a storefront Playwright E2E flow for FT-002 variant selection acceptance states.
- Verified: `TASK-014` `/execute` gates passed for Windows-native smoke, backend product-detail integration, storefront product-detail E2E, and Memory Bank lint.
- Note: `TASK-014` remains pending `/verify TASK-014`; FT-002 feature-level semantic completion remains a separate `/red-verify --feature FT-002` step after task closure.

## [2026-06-30] TASK-009 closure sync
- Synced: `TASK-009` remains closed as `done` with manual T2 `/verify` evidence and GENERAL closure ownership.
- Updated: RTM lifecycle for `REQ-001`, `REQ-002`, and `REQ-003` to `verified` from TASK-009 browser/integration evidence.
- Updated: `FT-001` lifecycle to `implemented`; feature-level `verified` remains pending `/red-verify --feature FT-001`.

## [2026-06-29] TASK-009 final verification
- Verified: fresh manual `/verify TASK-009` passed Windows-native smoke, backend catalog integration, storefront browser E2E, Memory Bank lint, strict doctor precheck, and Playwright artifact checks.
- Closed: `TASK-009` as `done` with T2 closure ownership by GENERAL after full protocol, packet/spec gate, seeded PostgreSQL-backed evidence, and REQ-001..REQ-003 coverage.
- Note: FT-001 feature-level semantic completion remains a separate `/red-verify --feature FT-001` step.

## [2026-06-28] TASK-009 FT-001 acceptance E2E
- Fixed: expanded TASK-009 scope and refreshed its packet so the storefront E2E script and dependency lockfile can be maintained.
- Added: Playwright browser coverage for catalog browse, category, search, all required filters, combined search and filters, empty results, and missing optional attributes.
- Verified: browser UI mirrors seeded PostgreSQL-backed catalog responses; Windows smoke, backend integration, storefront E2E, Memory Bank lint, and strict doctor pass.

## [2026-06-28] TASK-008 catalog edge-state verification
- Added: route-level catalog loading UI and local coverage for empty, backend-error, missing-attribute, and selected query states.
- Verified: pure catalog query-state normalization and href override behavior with deterministic unit assertions.
- Closed: `TASK-008` after storefront catalog tests, typecheck, Memory Bank lint, component trace evidence, and strict doctor passed.

## [2026-06-28] TASK-013 storefront product detail verification
- Added: backend-driven product detail route, responsive variant selector, loading/error/default-SKU states, and variant-aware product-card summaries.
- Verified: missing, impossible, and unavailable selections stay blocked; a valid SKU reaches the narrow product handle/SKU/quantity/validation handoff without cart persistence.
- Closed: `TASK-013` with manual T2 `VERDICT: PASS`; FT-002 remains incomplete pending TASK-014 and feature-level semantic verification.

## [2026-06-28] TASK-012 variant selection helper verification
- Added: pure storefront variant selection resolution for missing, impossible, unavailable, valid, and single/default SKU states.
- Verified: missing, impossible, ambiguous, unavailable, and multi-variant incomplete selections cannot become valid add-to-cart submissions.
- Closed: `TASK-012` with manual T1 `VERDICT: PASS`; `TASK-013` remains a scheduler promotion decision.

## [2026-06-25] TASK-010 product detail seed verification
- Added: backend product-detail seed smoke for multi-option variants, unavailable variant, and default SKU product.
- Fixed: reconciled TASK-010 scope to include `apps/backend/package.json` for the required `smoke:product-detail` npm gate.
- Verified: `TASK-010` after packet refresh with passing `db:seed`, `smoke:product-detail`, and Memory Bank lint evidence.

## [2026-06-24] W1 local foundation verification
- Verified: `TASK-004` with passing `smoke:local`, `check:local-env`, runbook coverage, and Memory Bank lint evidence.
- Closed: W1 task set `TASK-001`..`TASK-004` now has functional `/verify` PASS evidence and `done` task status.
- Note: FT-011 feature-level semantic verification remains separate before treating the whole feature as semantically complete.

## [2026-06-24] TASK-004 local smoke runbook
- Added: Windows-native local development runbook at `.memory-bank/runbooks/local-development.md`.
- Updated: `smoke:local` summary now links the local runbook and task evidence location.
- Documented: local setup, startup, smoke, stop, port conflicts, and explicit local-only reset behavior without Docker containers or production secrets.

## [2026-06-23] TASK-002 Windows PostgreSQL verification
- Added: backend `db:check` command for Windows-native local PostgreSQL preflight.
- Verified: `TASK-002` against local PostgreSQL 18.4 with passing `db:check`, `db:migrate`, `db:seed`, and `smoke:db` evidence.
- Updated: `TASK-002` task record to `done`, refreshed its execution packet hash, and archived the previous local PostgreSQL unavailable blocker.

## [2026-06-23] FT-011 Windows-native local runtime pivot
- Updated: PRD, product, requirements, EP-005, FT-011, global architecture backbone, spec registry, and FT-011 tech spec now require Windows 10 native local development instead of Docker Compose.
- Updated: FT-011 implementation plan, `TASK-001`..`TASK-004` source/spec references, `TASK-003`/`TASK-004` gates, and required packets to use local PostgreSQL and npm-based startup/smoke checks.
- Recorded: Docker is reserved only for a future remote server deployment path, which remains out of current local-foundation scope and must be designed separately as T3 deploy work.

## [2026-06-20] Global task wave classification
- Reclassified task `wave` values as global execution buckets: W1 foundation, W2 core implementation after foundation, and W3 polish/final cross-feature verification.
- Moved all FT-011 local foundation tasks into W1, moved FT-001/FT-002 core implementation tasks into W2, and kept edge/final verification tasks in W3.
- Relaxed FT-002 core start from `TASK-009` to `TASK-007`, while keeping final FT-002 verification after FT-001 final verification.

## [2026-06-20] FT-002 task decomposition
- Reused the active FT-002 product detail and variant selection tech spec for task decomposition.
- Added an implementation plan, schema-backed task records, and required execution packets for variant seed data, backend product detail contract, storefront variant selection helpers/UI, cart-action handoff, and integration/e2e verification.
- Sequenced FT-002 tasks after `TASK-009` so product detail work starts after the FT-011 local foundation and FT-001 catalog surfaces.

## [2026-06-20] README product showcase rewrite
- Updated: root `README.md` now presents only the target product showcase, not the repository/spec status.
- Added: explicit killer features section focused on buyer value, cart merge, pending payment, YooKassa webhook correctness, and Medusa Admin visibility.

## [2026-06-20] README showcase
- Added: root `README.md` as a warm project showcase for the spec-first MVP internet shop.
- Documented: product vision, planned stack, feature map, core safety rules, Memory Bank navigation, and current project status without claiming executable app readiness.

## [2026-06-20] FT-001 task decomposition
- Reused the active FT-001 catalog browsing/filtering/search tech spec for task decomposition.
- Added an implementation plan, schema-backed task records, and required execution packets for catalog seed data, backend query/filter contract, storefront catalog UI, edge states, and integration/e2e verification.
- Sequenced FT-001 tasks after `TASK-004` so catalog implementation starts only after the FT-011 local executable foundation.

## [2026-06-20] FT-011 task decomposition
- Completed feature-level SDD design for `FT-011 Docker Compose Local Development`.
- Added an implementation plan, schema-backed task records, and required execution packets for the local development foundation.
- Explicitly included database initialization and project scaffold work in the generated task queue.

## [2026-06-20] PRD decomposition protocol alignment
- Verified: `.memory-bank/prd.md` functional requirements are decomposed into REQ-001..REQ-030, EP-001..EP-005, and FT-001..FT-011.
- Updated: feature SDD Design Gate notes now route the happy path through `/prd-to-tasks FT-<NNN>`, which owns feature-level SDD design before task slicing.
- Updated: shared routing notes in `spec-backbone.md`, `architecture/system-architecture.md`, `states/order-payment-inventory.md`, `spec-index.md`, and `skills/index.md` now keep standalone `/spec-improve` as repair/refresh only.
- Added: `.protocols/PRD-BOOTSTRAP/` audit plan and decision log for this check.

## [2026-06-19] Global SDD backbone gate
- Completed `/spec-design` with `standard_ai_first` mode and a single-file architecture artifact strategy.
- Added global architecture, API, and order/payment/inventory lifecycle guardrails.
- Updated SDD backbone and spec registry so downstream feature design can use authoritative global links.
- Completed `/spec-improve FT-001` with a feature-local catalog browsing/filtering/search tech spec and feature `spec_design_status: complete`.
- Completed `/spec-improve FT-002` with a feature-local product detail/variant selection tech spec and feature `spec_design_status: complete`.

## [2026-06-18] Product framing, PRD, and decomposition
- Ratified the Project Constitution with medium-scope, KISS-first, tier-based DoD, scoped autonomy, and critical non-negotiables.
- Added Product Brief, clarified PRD, pre-PRD SDD framing, domain, boundary, lifecycle, and invariant docs for the MVP internet shop.
- Decomposed the PRD into product, requirements, epics, features, RTM, and testing strategy docs.
- Added workflow router and synchronized spec registry statuses after the PRD review gate.
- Recorded operational review evidence under `.tasks/TASK-MB-REVIEW/`.

## [2026-06-16] Initial setup
- Created Memory Bank skeleton
- Seeded core docs (product, requirements, testing, task registry)
