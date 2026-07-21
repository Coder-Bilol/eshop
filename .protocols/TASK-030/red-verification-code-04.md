# TASK-030 Independent Red Verification Code 04

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Run: operator-approved recovery 1/1 beyond retry 2/2

SEMANTIC_VERDICT: semantic-fail

## Findings

- HIGH purpose/security fit failure: the recovery restores real Google/VK provider
  capability, but it does not implement the exact fail-closed destination policy
  approved for that exceptional retry. Same-backend arbitrary/cross-provider
  callback paths are accepted, explicit default ports are normalized away and
  accepted, and return-like fragment data bypasses the query guard.
- MEDIUM false-success risk: the auth-client suite claims that ports, callback, and
  return-path destination abuse fail closed, while its matrix omits every reproduced
  accepted case. All standard gates are green despite the policy mismatch.

## Hostile Assessment

- Purpose fit: partial but not sufficient for T3 closure. The installed Google and
  project VK providers both produce start locations accepted by the storefront, so
  the code-03 capability failure is corrected. The security half of the recovery
  outcome remains incomplete.
- Anti-goals and autonomy: respected. No backend callback implementation, login or
  checkout page, cart merge semantic, order/payment behavior, browser token store,
  lifecycle decision, or sync work was added.
- Scope: recovery runtime changes remain inside the allowed auth-client boundary.
  Reviewer writes are limited to code-04 verification artifacts.
- Auth/session state: all earlier stale-read, duplicate logout, pending-restore,
  failed DELETE, `401`, and cleanup-only retry findings remain corrected.
- Cart/storage: confirmed logout still clears through the public cart boundary; a
  cleanup fault remains retryable without false guest or duplicate DELETE. Safe
  return-path storage remains one-shot under read/removal faults.
- Redirect boundary: exact approved origins reject ordinary external, lookalike,
  credential-bearing, downgraded, and non-default-port values. The remaining gaps
  are parser normalization and insufficient callback/fragment shape validation,
  not an arbitrary external-origin acceptance.
- Privacy/data: no JWT, provider token, customer payload, Authorization header, or
  parallel identity store was found. No migration, durable deletion, or data-loss
  path belongs to this task.
- Operations/recovery: the handoff recovery note is credible. Disable affected
  providers to stop login starts; rotate provider/signing secrets and invalidate
  sessions after suspected compromise while preserving durable Auth/Customer/cart
  records.
- Maintenance: an origin-only helper plus incomplete hostile tests will let later
  provider changes silently widen callback shape while evidence continues to claim
  exact destination enforcement.

## Hidden Assumptions And How This Could Still Be Wrong

- The implementation assumes WHATWG origin equality is equivalent to rejecting an
  explicitly supplied port. It is not: explicit `:443` is erased during parsing.
- It assumes any path/query on the configured backend origin is a safe callback.
  The normative contract instead fixes one exact callback URL per provider.
- It assumes only query parameters can carry callback/return navigation state.
  Real starts need no fragment, so preserving arbitrary fragment data has no
  demonstrated compatibility requirement.
- Browser E2E remains assigned to `TASK-034`; that later coverage cannot make this
  independently reproduced T3 policy gap closure-eligible.

## Critical T3 Assessment

- Security/privacy: token and identity non-persistence pass; exact destination
  validation fails for default ports and callback/return shape.
- Runtime/production: real Google/VK start locations now work. A malformed or
  corrupted backend start response can still pass destination validation in the
  reproduced classes and may cause provider failure or unsafe callback routing.
- Irreversible/data-loss/compliance: none introduced by TASK-030.
- Human checkpoint: the operator-approved recovery decision is recorded and the
  exact marker is present in the implementation handoff.
- Rollback/recovery: present and credible in `.protocols/TASK-030/handoff.md`.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth.ts:309-369` and focused destination tests.
- Expected: a real-provider-compatible but exact fail-closed backend/Google/VK
  destination policy.
- Observed: provider capability passes, while default-port and callback/fragment
  abuse cases remain accepted.
- Likely category: code|verification
- Recommended next action: scheduler keeps `TASK-030` and dependents unclosed,
  records the failed recovery outcome, and routes any further correction through an
  explicit owner decision before repeating both verification stages.
- Requires replan: yes

## Closure Recommendation

- `REQUEST_CHANGES`. `TASK-030` is not closure-eligible and its dependents should
  remain unpromoted. Reviewer did not fix, execute implementation, sync, close,
  fail, block, or promote lifecycle state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
