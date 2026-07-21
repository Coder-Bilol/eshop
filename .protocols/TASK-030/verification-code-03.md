# TASK-030 Independent Functional Verification Code 03

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: final bounded retry 2/2
- Packet: `PACKET-TASK-030-R5` (`ready`), with matching task SHA-256

VERDICT: FAIL

## Findings

- HIGH: provider login start rejects the valid external authorization location
  produced by the configured VK ID provider. `allowedBackendLocation()` in
  `apps/storefront/lib/auth.ts:290-302` accepts only the configured Medusa backend
  origin. The VK provider returns `https://id.vk.com/authorize` at
  `apps/backend/src/modules/auth-vkid/service.ts:118-127`, and Medusa returns that
  provider `location` unchanged from its auth route at
  `node_modules/@medusajs/medusa/dist/api/auth/[actor_type]/[auth_provider]/route.js:17-20`.
  The independent storefront probe therefore produced
  `vkid:REJECTED:auth_invalid_response`. This breaks TASK-030's required
  allowlisted provider start and the FT-004 VK login outcome.

## Final Edge Fixes

- PASS: a return-path consume attempt is tombstoned before `getItem()`. An
  independent read-fault probe returned `/` for both attempts and removed the
  later-readable stale envelope.
- PASS: failed session DELETE during a pending restore retains the last
  backend-confirmed customer with a normalized recoverable error. The late restore
  response was stale-suppressed and could not overwrite that state.

## Earlier Regression Coverage

- PASS: successful logout dominates an older current-customer response.
- PASS: restore requested during logout joins the terminal logout result.
- PASS: concurrent logout calls share one backend DELETE and one cart cleanup.
- PASS: return-path removal failure fails closed and cannot replay in the runtime.
- PASS: post-DELETE cart cleanup failure remains `logging_out`; retry performs only
  cleanup, reaches `guest`, and does not issue another DELETE.
- PASS: current-customer success remains the only identity proof and `401` becomes
  `guest` without deleting durable customer/cart data.
- PASS: requests use `credentials: "include"`; no Authorization header, JWT,
  provider token, customer payload, or auth `localStorage` persistence was found.
- FAIL: origin enforcement is safe against arbitrary origins but is functionally
  incompatible with the actual allowlisted VK provider origin. The focused client
  test models provider start with backend-origin locations and therefore misses the
  real cross-boundary contract.

## Context And Scope Gates

- The indexed task exists, remains `in_progress`, and has `tier: T3`; scheduler owns
  lifecycle and dependent promotion.
- The R5 packet task hash matches exactly:
  `sha256:553249f9de4b531bd02fbc39675bfaa7b2b2f037b4572eff4ce3d31fe1b9b16a`.
- Task, packet, FT-004 feature/plan, linked auth architecture/security/state specs,
  cart access contract, all prior findings, latest implementation report, source,
  tests, and current diff/evidence were checked.
- Runtime scope and anti-goals remain respected. No browser token persistence,
  backend callback change, login/checkout markup, cart merge semantic, order,
  payment, lifecycle, or sync change is attributed to this Reviewer run.
- Reviewer writes are limited to the required code-03 verification artifacts.

## Commands And Evidence

- PASS: raw SHA-256 comparison between the authoritative task and R5 packet.
- PASS: `npm --workspace apps/storefront run test -- auth-client`.
- PASS: `npm --workspace apps/storefront run test -- auth-state`.
- PASS: `npm --workspace apps/storefront run test`, all eight storefront suites.
- PASS: `npm --workspace apps/storefront run typecheck`.
- PASS: `npm --workspace apps/storefront run build`.
- PASS: `node scripts/mb-lint.mjs`, 118 files.
- PASS: `node scripts/mb-doctor.mjs --strict`, zero errors and warnings.
- PASS: `git diff --check`, with existing line-ending warnings only.
- PASS: independent combined storage/concurrency/cart probe.
- PASS: independent auth runtime token-storage scan.
- PASS: `npm --workspace apps/backend run smoke:auth-vkid`; its source assertion
  verifies the provider start location origin is `https://id.vk.com`.
- FAIL: independent storefront external-provider-location probe rejected both the
  VK ID location and a representative Google authorization location with
  `auth_invalid_response`.

## Failure / Budget

- Status: failed
- Where: `apps/storefront/lib/auth.ts:120-140,278-305` and
  `apps/storefront/src/auth-client.test.cjs:54-78,132-153`.
- Expected: accept only the explicitly allowlisted authorization origins required
  for Google and VK ID while rejecting unrelated origins.
- Observed: every non-backend origin is rejected, including the configured VK ID
  provider's real authorization location.
- Likely category: code|verification
- Recommended next action: scheduler records final failure, keeps dependents
  unpromoted, and routes a new owner-scoped correction with provider-origin contract
  coverage if work is to continue.
- Requires replan: yes
- Retry budget: exhausted (`2/2`). No further TASK-030 retry is available.

Scheduler recommendation: `REQUEST_CHANGES`; recommend `status: failed`. Do not
close TASK-030, promote TASK-031/TASK-032/TASK-039, or run `/mb-sync` from this
Reviewer session.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
