# TASK-030 Plan

- Task record: `.memory-bank/tasks/TASK-030.task.json`
- Tier: T3
- Packet: `.memory-bank/packets/TASK-030.packet.json` R14
- Run: bounded code-06 Reviewer FAIL recovery

## Goal Interpretation

- Purpose: provide one cookie-session-backed storefront customer boundary.
- Success outcome: allowlisted auth start, current-customer resolution, safe
  return-path storage, and confirmed logout are deterministic and token-free.
- Anti-goals: no callback backend, page design, cart merge semantics, checkout,
  order/payment behavior, or browser token storage.
- Allowed write scope: the scoped storefront files plus required protocol and
  evidence artifacts.
- Forbidden scope: backend auth, login/checkout pages, cart semantics,
  orders/payments, and browser token persistence.
- Stop conditions: a required browser token, mixed callback/return-path state, or
  inability to clear the cart through `CartProvider.clearLocalReference()`.

## Boundary Notes

- Linked contracts: auth/session security, customer auth/session state, and cart
  access/security.
- Responsibility: the HTTP client uses Medusa cookie sessions; the state controller
  owns in-memory transitions; AuthProvider invokes the existing cart cleanup
  boundary only after confirmed session deletion.
- Boundary drift risk: treating client state as identity proof, clearing local
  state before logout confirmation, accepting an open return path, or persisting a
  provider/Medusa token.

## Steps

1. Add a credentials-including Medusa auth client and strict versioned
   sessionStorage return-path adapter.
2. Add deterministic auth state for start, current-customer resolution, 401 guest
   behavior, and confirmed logout ordering.
3. Mount AuthProvider inside the existing CartProvider and use only its public
   cleanup boundary.
4. Add focused client/state regression suites and register them.
5. Run packet-sourced local tests, typecheck, Memory Bank lint, and diff checks.

## Retry 1 Corrective Steps

1. Restrict provider login destinations to the configured backend origin.
2. Fail closed and tombstone a consumed return path when storage removal throws.
3. Make logout single-flight and dominant over current-customer restoration.
4. Keep post-DELETE cleanup incomplete and retryable until the public cart cleanup
   boundary succeeds; never emit completed guest while cleanup still fails.
5. Add adversarial destination, storage, stale-read, concurrent-logout, and cleanup
   failure tests without changing cart implementation.

## Retry 2 Corrective Steps

1. Tombstone the return-path consume attempt before `sessionStorage.getItem`, so a
   transient read fault cannot expose the old envelope on a later consume.
2. Track the last backend-confirmed auth state separately from transient resolution
   state and restore it with a recoverable error when session DELETE fails.
3. Prove a stale restore response cannot overwrite that failed-logout state.
4. Preserve all retry-1 redirect, single-flight, logout-precedence, and cleanup-only
   retry behavior without changing cart implementation.

## Intended Local Gates

- `npm --workspace apps/storefront run test -- auth-client`
- `npm --workspace apps/storefront run test -- auth-state`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`
- `git diff --check`
- `npm --workspace apps/storefront run test`
- `npm --workspace apps/storefront run build`
- `npm --workspace apps/backend run smoke:auth-vkid`

## Operator-Approved Recovery

1. Accept the configured backend origin and the exact HTTPS origins
   `https://accounts.google.com` and `https://id.vk.com`.
2. Reject every other origin, provider HTTP downgrade, URL userinfo, external or
   malformed callback destinations, and return-path parameters.
3. Add positive Google/VK values shaped like real authorization locations plus
   hostile destination regressions.
4. Run all packet gates and full storefront regressions without changing the prior
   concurrency, storage, cart cleanup, or token non-storage fixes.

## Operator-Approved Recovery 2

1. Accept only `https://accounts.google.com/o/oauth2/v2/auth` for Google and
   `https://id.vk.com/authorize` for VK ID, with optional duplicate-free OAuth query
   parameters.
2. Forbid backend top-level destinations, every other origin/path, explicit ports
   including `:443`, URL credentials, fragments, relative values, and parser path
   normalization variants.
3. If `redirect_uri` is present, require exactly one provider-bound backend
   `/auth/customer/{provider}/complete` value; reject callback aliases, return-path
   fields, nested callback data, and case-insensitive duplicate parameters.
4. Add a hostile matrix covering the approved contract and rerun packet gates plus
   the full prior regression/build/smoke set without changing state/storage/cart
   behavior.

## Code-06 Bounded Recovery

1. Treat only logout `AuthClientError` status `401` as authoritative session
   absence and continue through the existing return-path/cart cleanup phase.
2. Preserve confirmed customer/cart state for every genuine logout error and retain
   the existing single-flight, stale-restore suppression, and cleanup-only retry.
3. Reject any raw provider location containing literal `#` before URL parsing,
   including empty trailing fragments, without changing TASK-043 query/path rules.
4. Add focused adversarial regressions and run packet commands plus the full latest
   Reviewer gate set.

Scheduler owns `/verify`, `/red-verify`, lifecycle, dependent promotion, and
`/mb-sync`.
