# TASK-029 Independent Red Verification Code 03

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Retry: final bounded retry 2/2

## Findings

- No actionable substantive findings.

## Hostile Assessment

- Purpose fit: complete for the TASK-029 boundary. Validated Google/VK identities
  resolve one Medusa customer, establish only a server-side session, and reach one
  fixed sanitized completion redirect.
- False-success assessment: no remaining false success was found. The prior cleanup
  race and post-create read gap were reproduced as hostile interleavings by an
  independent probe and now pass. The default integration command also executes all
  registered suites rather than succeeding with zero tests.
- Lock/cleanup ownership: coherent. One provider-identity owner covers reads,
  nested email serialization, resolve/create, post-create confirmation, session
  save, and compensation. Cleanup finishes before a waiting callback can resolve
  that identity, so a failing callback cannot delete a concurrent successful actor.
- State/data consistency: a failed newly-created account attempt leaves no new
  customer/link/session when compensation succeeds; a successful waiting attempt
  creates and retains its own actor. Existing actors never receive new-attempt
  cleanup ownership.
- Replay/collision/session: replay fails closed; duplicate valid login is serialized;
  same-email cross-provider collision creates no link/session; session save is
  awaited before redirect.
- Security/privacy: provider/callback tokens are not transferred to session or URL;
  redirect status and errors are coarse; HMAC-keyed retained maps are bounded; no raw
  sensitive logging or direct core-table access was found.
- Boundary/autonomy: no email auto-linking, storefront/cart/checkout/payment change,
  Medusa Core modification, custom identity store, Redis, live provider mutation, or
  scope widening was found.
- Operations: process-local coordination matches the documented single-process MVP.
  The rollback/recovery note is credible: disable providers, revert callback files,
  rotate compromised secrets when necessary, and preserve durable records for
  investigation. No migration exists.
- Maintenance cost: the lock boundary is explicit in one completion function and
  uses existing Medusa workflows; the added complexity is proportional to required
  T3 failure atomicity and has direct regression coverage.

## Critical T3 Review

- No new secret exposure, authorization bypass, cross-provider takeover, destructive
  existing-customer cleanup, or callback-token persistence path was found.
- Compensation failure or process crash cannot be made transactionally atomic with
  the process-local session store. This is a documented operational limit, not a
  newly introduced false claim; real workflow/PostgreSQL behavior remains TASK-033.
- Multi-instance coordination remains outside the explicitly single-process FT-004
  contract. A future multi-instance deployment must add a shared edge/lock design.
- Human checkpoint and recovery markers are present and supported by the retry-2/2
  operator request plus `.protocols/TASK-029/handoff.md` recovery evidence.

## How This Could Still Be Wrong

- Real Medusa/PostgreSQL and real session middleware may reveal workflow or
  persistence behavior not represented by synthetic doubles; TASK-033 owns that
  acceptance and must remain required before feature completion.
- A process crash during the create/session/compensation interval can leave recovery
  work for later acceptance/operations. The current solution correctly prevents the
  in-process destructive race requested by this retry.
- Live Google/VK provider behavior remains manual/staging UAT and must never reuse
  production secrets as automated evidence.

## Evidence Checked

- Task record, packet R5/hash, linked feature/specs/contracts/state, implementation
  plan, all prior FAIL findings, code-03 implementation diff/evidence, production
  helper/route/limiter code, Medusa 2.16 workflow/session source, and all required
  plus adjacent regression commands.
- Independent hostile probe:
  `.tasks/TASK-029/independent-adversarial-probe-code-03.cjs`.

SEMANTIC_VERDICT: semantic-pass

Scheduler recommendation: `APPROVE`. With functional `VERDICT: PASS`, TASK-029 is
eligible for scheduler closure. Scheduler retains lifecycle, task-record evidence,
dependent promotion, and `/mb-sync` ownership.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
