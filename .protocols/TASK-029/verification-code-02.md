# TASK-029 Independent Functional Verification Code 02

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: bounded retry 1/2
- Packet: `PACKET-TASK-029-R4` (`ready`); source hash independently matched

## Findings

- HIGH: compensation is not safe across concurrent valid callbacks for the same
  provider identity. `withCustomerResolutionLock` ends when
  `completeCustomerAuth` returns, before either callback establishes its session.
  A second callback can therefore resolve the new actor as `created: false` and
  save a valid session; if the creator callback then fails `session.save`, its
  `created: true` compensation deletes that same customer and auth link. The
  independent probe ended with a successful session actor `cus-race` but
  `customerStillDurable: false`. This violates exactly-one durable actor, existing
  customer preservation, and failure atomicity.
- MEDIUM: post-create verification failure bypasses compensation. After
  `createCustomerAccount` succeeds, `completeCustomerAuth` retrieves the linked
  identity before returning the `created: true` result. If that retrieval fails,
  the route never reaches `establishCompletedCustomerSession`, so the supported
  removal workflow is unavailable and the new customer/link remain after a
  pre-session failure. The independent injected-failure probe observed
  `created: true`, `linked: true`, and `cleanupAvailable: false`.

## Retry Acceptance Results

- PASS: the original isolated first-login `session.save` failure now destroys the
  session and invokes Medusa 2.16 `removeCustomerAccountWorkflow`; the workflow
  deletes the customer and clears its auth identity association.
- PASS: an isolated existing-account session failure has `created: false`, does not
  invoke removal, and preserves the durable customer.
- FAIL: the cleanup is not atomic with concurrent callback/session completion and
  does not cover a failure between successful account creation and return of the
  completion result.
- PASS: the no-argument integration dispatcher independently ran
  `auth-completion`, `auth-vkid`, and all seven suites registered by the legacy
  runner: `catalog`, `product-detail`, `cart-merge-persistence`, `cart-merge-plan`,
  `cart-merge-lifecycle`, `cart-merge-api`, and `cart-merge-acceptance`.
- PASS: focused and inspected behavior remains replay-safe, same-email collision
  safe, server-session-only, fixed-redirect-only, bounded/hashed-key rate limited,
  and sanitized. No callback/provider token is copied to session, redirect, logs,
  or customer input.
- PASS: Auth/Customer services plus exported create/remove account workflows are
  used; no direct core-table write or Medusa Core modification was found.
- PASS: runtime changes remain in packet R4 allowed scope. Storefront, cart merge,
  checkout/order/payment, and automatic email linking were not changed.
- NOTE: real Auth/Customer PostgreSQL acceptance remains TASK-033. Synthetic output
  was not credited as that later acceptance boundary.

## Commands And Evidence

- PASS: `npm --workspace apps/backend run test:integration -- auth-completion`.
- PASS: `npm --workspace apps/backend run test:integration -- auth-vkid`.
- PASS: `npm --workspace apps/backend run test:integration`; output showed both
  auth suites and every legacy suite executing, not a zero-suite success.
- PASS: `npm --workspace apps/backend run typecheck`.
- PASS: `node scripts/mb-lint.mjs` (`118 files`).
- PASS: `git diff --check` with line-ending warnings only.
- PASS: raw packet/task SHA-256 comparison:
  `sha256:f73171ab6f86227deba33dfd8a742a2295f043de33defba52ca92f891bca784c`.
- FAIL: concurrent mixed-session probe returned
  `{"successfulSessionActor":"cus-race","failingCallbackCode":"auth_session_failed","customerStillDurable":false}`.
- FAIL: injected post-create identity-read failure returned
  `{"created":true,"linked":true,"cleanupAvailable":false}`.

VERDICT: FAIL

Scheduler recommendation: do not close TASK-029 or promote dependents. Keep the
account-resolution lock/ownership valid through session save and compensation, and
ensure every failure after a successful new-account workflow can invoke supported,
attempt-owned cleanup. Add mixed concurrent success/failure and post-create failure
assertions, then repeat independent `/verify` and `/red-verify`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
