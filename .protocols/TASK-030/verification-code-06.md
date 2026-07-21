# TASK-030 Independent Functional Verification Code 06

## Findings

- HIGH: logout on an already expired session preserves stale authenticated customer
  state and the local cart reference. Installed Medusa 2.16 protects
  `DELETE /auth/session` with session authentication and returns `401` when no valid
  session exists (`node_modules/@medusajs/medusa/dist/api/auth/middlewares.js:14-18`
  and
  `node_modules/@medusajs/framework/dist/http/middlewares/authenticate-middleware.js:31-55`).
  `performLogout()` handles that authoritative session-invalid response like a
  retryable backend failure (`apps/storefront/lib/auth-state.ts:140-146`). An
  independent probe restored `cus_expired`, received logout `401`, performed zero
  cart cleanup calls, and ended in `session_established` with the old customer and a
  recoverable error. This violates the linked rule that confirmed session-invalid
  responses prevent false logout state and leaves shared-browser cart state exposed.
- MEDIUM: an OAuth location with an empty fragment delimiter is accepted despite the
  exact no-fragment constraint. The independent probe accepted and returned
  `https://accounts.google.com/o/oauth2/v2/auth?state=x#`. WHATWG `URL.hash` is an
  empty string for a trailing `#`, so the check at
  `apps/storefront/lib/auth.ts:335-342` cannot distinguish no fragment from an empty
  fragment. A non-empty fragment correctly rejects. This is a narrow bypass, but it
  fails the explicit TASK-030 destination contract and the requested strict
  fail-closed surface.

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Packet: `PACKET-TASK-030-R13` (`ready`), accepted by strict doctor against the
  current authoritative task record

VERDICT: FAIL

## Functional Acceptance Results

- PASS: the installed Medusa Google provider emits exactly
  `https://accounts.google.com/o/oauth2/v2/auth` with `redirect_uri`, `client_id`,
  `response_type`, `scope`, and `state`. The current VK provider emits exactly
  `https://id.vk.com/authorize` with its provider-bound callback, state, and S256
  PKCE parameters. Both real provider-shaped locations pass the storefront client.
- PASS: arbitrary/backend/relative/wrong-provider origins and paths, HTTP downgrade,
  credentials, explicit default/non-default ports, non-empty fragments, path
  normalization, callback/return aliases, duplicate names, malformed percent
  escapes, controls, empty names/segments, and repeated dangerous-name encoding
  reject. Exact 4096-character and 32-segment query boundaries pass; 4097 characters
  and 33 segments reject.
- FAIL: the explicit fragment prohibition is incomplete because a trailing empty
  fragment delimiter passes and is preserved in the returned location.
- PASS: Google/VK start, current-customer GET, and session DELETE use
  `credentials: "include"`, `cache: "no-store"`, and the publishable key without an
  Authorization header or request token body. Installed Medusa DELETE success is
  compatible with the required `{ success: true }` response.
- PASS: successful current-customer retrieval is the only customer authority used by
  the controller. Current-customer `401` clears customer/error state and resolves to
  `guest`; malformed successful payloads fail closed.
- PASS: the covered restore/logout interleavings remain deterministic: restore before
  logout cannot resurrect identity, restore during logout joins the logout result,
  failed logout overlapping restore retains the last confirmed customer, and
  concurrent logout shares one DELETE.
- FAIL: session-expired logout `401` is also an authoritative no-session result but is
  not treated as such. The stale customer and cart reference are retained instead of
  moving to guest and cleaning shared-browser state.
- PASS: after successful DELETE, cart cleanup failure stays `logging_out`; retry runs
  cleanup only, does not issue a second DELETE, and reaches `guest` after cleanup.
- PASS: the versioned sessionStorage return path accepts only internal
  one-leading-slash paths, rejects unsafe envelopes, and fails closed under read and
  removal faults. In-runtime tombstones prevent repeated consumption in the covered
  fault cases.
- PASS: no auth JWT, provider token, bearer/Authorization credential, customer
  payload, or auth localStorage persistence was found. The only production auth
  browser storage is the versioned safe return path in sessionStorage; the existing
  localStorage production boundary remains the opaque FT-003 cart reference.
- PASS: TASK-030/TASK-043 runtime and test changes remain in their allowed storefront
  scopes. The full tracked diff and complete untracked-file list were inspected;
  adjacent backend auth changes belong to separately indexed TASK-027/028/029 work.
  No TASK-030 callback backend, page design, cart semantics, checkout/order/payment,
  lifecycle, or sync write was found.

## Commands And Evidence

- PASS: `node scripts/mb-doctor.mjs --strict`; zero errors, three unrelated upstream
  warnings, and packet R13 accepted.
- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test -- auth-state`.
- PASS: `npm --workspace apps/storefront run test`; all eight suites.
- PASS: `npm run typecheck`; storefront and backend.
- PASS: `npm --workspace apps/storefront run build`.
- PASS: `npm --workspace apps/backend run build`.
- PASS: `npm --workspace apps/backend run smoke:auth-vkid`.
- PASS: `npm --workspace apps/backend run test:integration -- auth-completion`.
- PASS: `node scripts/mb-lint.mjs`; 118 files.
- PASS: `git diff --check`; line-ending warnings only.
- PASS: independent provider-source probes confirmed the installed Google and current
  VK start origins, paths, query fields, and exact provider-bound callbacks.
- FAIL: independent destination probe accepted the trailing-empty-fragment location;
  the same probe rejected a non-empty fragment and accepted encoded `%23` as query
  data rather than a top-level fragment.
- FAIL: independent expired-session logout probe ended with the old customer,
  `status: session_established`, and zero cart cleanup calls after logout `401`.

## Scheduler Recommendation

- REQUEST_CHANGES. TASK-030 is not closure-eligible. Keep TASK-031, TASK-032, and
  TASK-039 unpromoted/blocked, route the two findings through bounded implementation,
  and repeat full `/verify TASK-030` plus required `/red-verify TASK-030`.
- Reviewer changed no implementation, task/packet record, lifecycle status,
  dependency state, Memory Bank sync state, or unrelated worktree content.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
