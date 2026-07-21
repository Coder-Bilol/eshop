---
description: Лог изменений Memory Bank.
status: active
---
# Changelog

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
