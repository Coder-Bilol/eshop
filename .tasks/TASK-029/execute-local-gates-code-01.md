# TASK-029 Execute-Local Gates

## Required Commands

### Auth completion integration

Command: `npm --workspace apps/backend run test:integration -- auth-completion`

Result: PASS

Sanitized output summary:

```json
{"command":"test:integration","status":"ok","suites":["auth-completion"],"persistence":"medusa-customer-account-workflow-and-customer-module","replay":"single-use-bounded-hashed-state","collision":"same-email-cross-provider-rejected","redirect":"fixed-sanitized-storefront-completion","rateLimit":"bounded-salted-hash-keys","session":"server-side-saved-before-redirect","browserTokens":"none","credentials":"synthetic-doubles-only"}
```

Assertions include first/repeat/concurrent customer resolution, same-email
cross-provider collision, missing email, bounded salted-hash key storage, replay,
fixed redirect cleanup, session save/failure cleanup, and provider-token
non-transfer. The output contains no raw IP/state/code/device ID, token value,
session ID, customer email/object, provider payload, or live credential.

### Backend typecheck

Command: `npm --workspace apps/backend run typecheck`

Result: PASS (`tsc --noEmit`, exit 0). The first development run found an incorrect
`AuthContext` import source; it was corrected to the public framework HTTP export,
and the final required run passed.

### Memory Bank lint

Command: `node scripts/mb-lint.mjs`

Result: PASS (`mb-lint passed (118 files)`).

## Additional Commands

- `npm --workspace apps/backend run test:integration -- auth-vkid`: PASS; existing
  TASK-028 state/PKCE/device ID/token-safety suite remains green.
- `npm ci --ignore-scripts --dry-run`: PASS; package/lock dependency resolution
  accepted, no files written.
- `git diff --check`: PASS; exit 0 with only pre-existing Windows line-ending
  warnings.

## Scope And Safety

- Medusa extension boundary: Auth/Customer Modules,
  `createCustomerAccountWorkflow`, and Medusa's server session contract only.
- Direct core writes: none.
- Automatic email linking: none; collision fails closed.
- Browser token handoff/storage: none.
- Live credentials/provider calls: none.
- Forbidden scope touched: no.
- Real PostgreSQL route acceptance: intentionally remains TASK-033; this run does
  not widen W2 scope or claim that later independent acceptance gate.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
