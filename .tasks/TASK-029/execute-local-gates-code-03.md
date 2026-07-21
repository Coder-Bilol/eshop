# TASK-029 Retry 2/2 Execute Local Gates

- Packet context: `PACKET-TASK-029-R5`, ready derivative context.
- Scope: final bounded fixes for callback cleanup ownership and post-create
  identity-read compensation only.

## Gate Results

- `npm --workspace apps/backend run test:integration -- auth-completion` -> PASS.
  Output explicitly reports `cleanupRace` as
  `identity-owned-through-session-and-compensation` and `postCreateReadFailure` as
  `new-customer-and-link-compensated`. Existing account, replay, collision,
  redirect, rate-limit, sanitization, and token-omission assertions remain green.
- `npm --workspace apps/backend run test:integration -- auth-vkid` -> PASS. TASK-028
  provider behavior remains green.
- `npm --workspace apps/backend run test:integration` -> PASS on the completed run.
  It executed `auth-completion`, `auth-vkid`, and all seven legacy suites: `catalog`,
  `product-detail`, `cart-merge-persistence`, `cart-merge-plan`,
  `cart-merge-lifecycle`, `cart-merge-api`, and `cart-merge-acceptance`.
- `npm --workspace apps/backend run typecheck` -> PASS.
- `node scripts/mb-lint.mjs` -> PASS, 118 files.
- `git diff --check` -> PASS with pre-existing CRLF conversion warnings only.

## Adversarial Evidence

- A first callback creates a customer, enters session save, and is deliberately held
  there while a second callback for the same provider identity starts. The second
  callback cannot enter session establishment until the first session fails and its
  customer/link compensation completes. It then creates and saves a replacement;
  only the failed actor is removed, and the successful session's customer/link
  remains.
- A successful create followed by the third (post-create) identity read throwing
  invokes exactly one cleanup, never calls session establishment, and leaves no new
  customer or auth link.
- An existing-customer session failure invokes no account cleanup and preserves the
  existing customer/link.

## Boundary Evidence

- Creation and compensation use Medusa 2.16 exported
  `createCustomerAccountWorkflow` and `removeCustomerAccountWorkflow`.
- No direct core table write, Medusa Core change, storefront/cart/checkout change,
  automatic email link, provider token persistence, or live credential was added.
- The first no-argument gate attempt was terminated by the tool runner through
  `ChildProcess.kill` without test output. Process inspection found no remaining
  integration child; the subsequent completed run passed every suite listed above.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
