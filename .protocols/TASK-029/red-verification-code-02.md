# TASK-029 Independent Red Verification Code 02

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: bounded retry 1/2

## Findings

- HIGH: `created` is treated as permanent exclusive cleanup ownership even after
  the resolution lock is released. Another callback can successfully adopt the
  same customer and establish a session before the creator's failed session causes
  deletion. The local isolated cleanup test cannot rule out this destructive
  interleaving.
- MEDIUM: compensation starts too late in the call graph. A failure in the
  post-create auth-link read occurs before a completion object reaches the wrapper,
  leaving the newly created customer/link outside cleanup.

## Hostile Assessment

- Purpose fit: incomplete. Normal first/repeat login, collision, replay, session,
  redirect, limiter, and privacy paths fit the specs, but one provider identity is
  not guaranteed to retain one durable usable customer under concurrent failure.
- False-success risk: confirmed. The new smoke assertions prove isolated new versus
  existing account behavior but omit the mixed concurrent session outcome and the
  post-create/read-failure boundary where the implementation is unsafe.
- Anti-goals and scope: respected. No email auto-link, browser token handoff, direct
  core write, custom identity/session store, storefront/cart/checkout expansion, or
  live provider operation was found.
- Cross-boundary/state impact: a valid session can reference a deleted customer, or
  a failed callback can leave an unreported customer/link. Both contradict the
  authoritative `auth_failed` pre-session cleanup and durable actor model.
- Operational impact: transient session-store or Auth Module reads can create
  inconsistent durable/session state. Process-local replay protection does not
  prevent separate valid states for the same identity.
- Maintenance cost: the dispatcher repair is small and correct, but cleanup
  ownership split across resolution and session helpers obscures the transaction
  boundary and permits future false-green tests.
- Security/privacy regression: none found in redirect, error, token, PII, raw-IP,
  rate-limit key, or direct-write handling.

## How This Could Still Be Wrong

- The probes use synthetic module/session state. TASK-033 still must test real
  Medusa/PostgreSQL behavior and may expose additional rollback or workflow failure
  modes.
- A process crash between account creation and session completion cannot be made
  fully atomic by in-process compensation. The required implementation still must
  avoid deleting an actor already adopted by another successful callback and must
  define recoverable handling for uncertain compensation outcomes.
- Multi-instance replay/rate coordination remains outside FT-004 by explicit spec;
  it is not the basis for this verdict.

## Failure / Blocker

- Status: failed
- Where: `apps/backend/src/auth/complete-customer-auth.ts:131-171,213-231` and
  `apps/backend/src/api/auth/customer/[provider]/complete/route.ts:102-134`
- Expected: a failed new-customer completion leaves no new customer/link/session,
  without deleting an actor retained by an existing or successful concurrent path.
- Observed: cleanup ownership survives lock release and can delete a customer behind
  a successful session; post-create identity-read failure has no cleanup owner.
- Likely category: code|verification
- Recommended next action: make resolution/session/compensation ownership coherent,
  add both adversarial assertions, and rerun the T3 verification pair.
- Requires replan: no

SEMANTIC_VERDICT: semantic-fail

Scheduler recommendation: `REQUEST_CHANGES`; keep TASK-029 non-closure-eligible and
dependents unpromoted. Lifecycle mutation and `/mb-sync` remain scheduler-owned.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
