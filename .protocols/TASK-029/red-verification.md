# TASK-029 Adversarial Semantic Verification

SEMANTIC_VERDICT: semantic-fail

## Top Substance Risks

- HIGH false acceptance: the implementation and smoke suite describe session-save
  failure as cleaned up, but the tested first-login customer/auth link survives the
  failed pre-session transition. The test checks only ephemeral session cleanup and
  therefore cannot support the stronger state/task claim.
- MEDIUM regression: replacing the integration runner introduced an unqualified
  command that passes while running zero suites. This weakens system-wide regression
  protection while the named TASK-029 command remains green.

## Purpose Fit And Anti-goals

- Purpose fit is incomplete. The normal callback path correctly resolves one actor,
  establishes a server session, and redirects safely, but the required failure
  lifecycle is not implemented as specified.
- No automatic email linking, browser token transfer, direct Medusa Core/table
  write, storefront/cart/checkout expansion, live provider call, or custom durable
  identity/session store was found.
- Allowed runtime scope was respected. Verification changed only the required
  protocol and report artifacts and did not assume lifecycle ownership.

## False-success Assessment

- Named synthetic tests genuinely exercise helper behavior, and an independent
  route probe confirmed replay, collision, redirect, sanitization, and session
  ordering. They do not exercise a real Medusa container, session store, or
  PostgreSQL.
- That limitation is acceptable for TASK-029 only because TASK-033 explicitly owns
  real Medusa/PostgreSQL acceptance. It would be false to treat the current
  `persistence` output field or task `verify` wording as completed PostgreSQL proof.
- The partial-failure PASS is substantively false even within the synthetic scope:
  the independent probe shows the durable synthetic customer/link still present.

## Cross-boundary Assessment

- Medusa boundary: supported Auth/Customer services and the public
  `createCustomerAccountWorkflow` are used correctly; no unsupported write was
  found.
- State/data consistency: happy-path link creation is atomic inside the Medusa
  workflow, but session establishment is outside that workflow. A downstream
  session-store failure leaves the account transition completed while the specified
  pre-session transition says no customer/link should remain.
- Security/privacy: fixed redirects, coarse codes, HMAC key retention, bounded maps,
  token omission, and server-side session context are sound for the single-process
  MVP. No raw provider payload or PII logging path was found.
- Operations: process restart clears limiter/replay/lock state as documented. The
  rollback/recovery note is credible and preserves durable data, but it does not
  resolve the first-login failure contract conflict.
- Maintenance: a zero-suite default integration command and an overclaimed failure
  assertion create durable false confidence for later auth and unrelated backend
  work.

## How This Could Still Be Wrong

- No live provider, real session middleware/store, or PostgreSQL mutation was used.
  Those remain TASK-033 inputs and may expose additional defects.
- If the intended rule is to preserve a fully linked, retryable account after
  session failure, the implementation may be safer than destructive compensation,
  but the current authoritative state target and task evidence must be changed by an
  owner before this behavior can be accepted.
- Multi-instance rate/replay coordination is not provided, but the security contract
  explicitly scopes this defense to the single-process MVP.

## Failure / Blocker

- Status: failed
- Where: `apps/backend/src/auth/complete-customer-auth.ts:153-170,181-210`,
  `apps/backend/src/scripts/smoke-auth-completion.ts:268-293`, and
  `apps/backend/src/scripts/smoke-auth-completion.ts:52-55,325-334`
- Expected: pre-session failure behavior matches the authoritative state target, and
  the default integration command cannot pass without running tests.
- Observed: session failure leaves the newly created customer/auth link, while the
  smoke assertion checks only session destruction; the default integration command
  exits 0 with no suite.
- Likely category: code|verification|spec
- Recommended next action: owner resolves the durable-account failure policy,
  implementation/test evidence is aligned to that decision, and default suite
  dispatch is restored before both verification passes are repeated.
- Requires replan: no for dispatcher; owner decision may be required for failure
  compensation semantics.

## Scheduler Recommendation

- Do not close TASK-029 and do not promote TASK-030/TASK-033.
- Recommend `status: failed` pending a bounded correction or explicit normative
  reconciliation, then repeat independent functional and semantic verification.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
