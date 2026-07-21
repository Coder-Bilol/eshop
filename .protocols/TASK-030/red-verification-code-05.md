# TASK-030 Independent Red Verification Code 05

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Run: operator-approved recovery 2

SEMANTIC_VERDICT: semantic-fail

## Findings

- HIGH purpose/security fit failure: recovery 2 correctly narrows provider starts
  to exact Google/VK paths and preserves real OAuth parameters, but still does not
  implement the explicitly requested fail-closed boundary for malformed query and
  encoded callback/return abuse. Valueless, unnamed, invalid-percent, encoded-NUL,
  empty-segment, and double-encoded navigation-alias inputs pass independently.
- MEDIUM false-success risk: all standard gates are green and the focused test
  advertises malformed/encoded coverage, but it omits the accepted forms. The
  evidence therefore cannot support T3 closure despite correcting every prior
  session/logout/storage/cart and destination-origin finding.

## Hostile Assessment

- Purpose fit: partial but insufficient. Realistic Google/VK starts now pass and the
  session boundary remains deterministic, but the exceptional recovery's complete
  hostile destination/query outcome is not achieved.
- Anti-goals and autonomy: respected. No backend provider/callback implementation,
  login/checkout page, cart merge semantic, order/payment behavior, browser token
  persistence, lifecycle decision, or sync work was added.
- Scope: recovery runtime/test changes remain inside the allowed auth client and
  focused test boundary. Reviewer writes are limited to code-05 verification
  artifacts.
- Redirect boundary: exact raw provider bases prevent origin/path confusion before
  WHATWG normalization. Backend destinations, explicit ports, credentials,
  fragments, path normalization, ordinary callback/return aliases, provider
  mismatch, duplicate names, and exact-callback violations fail closed.
- Query boundary: `URLSearchParams` silently normalizes malformed syntax. Because no
  raw query grammar check precedes it, malformed and encoded navigation-like names
  survive as apparently ordinary OAuth parameters.
- Auth/session state: all earlier stale-current-customer, concurrent logout,
  pending-restore, failed DELETE, `401`, and cleanup-only retry defects remain fixed.
- Cart/storage: logout still uses the public cart cleanup boundary only after
  confirmed session deletion; cleanup faults remain retryable without false guest.
  Safe return-path state remains internal-only and one-shot under storage faults.
- Privacy/data: no JWT, provider token, bearer/Authorization credential, customer
  payload, or auth `localStorage` store was found. No migration, durable mutation,
  destructive action, or data-loss path belongs to this recovery.
- Operations/recovery: exact-path acceptance works for realistic provider starts.
  Malformed accepted locations can cause provider/runtime failures and create
  ambiguous behavior if any downstream layer performs additional decoding.
- Maintenance: a forgiving parser plus overclaiming tests makes future navigation
  aliases or decoder changes capable of widening behavior without a failing gate.

## Hidden Assumptions And How This Could Still Be Wrong

- The implementation assumes that anything parsed by `URLSearchParams` after the
  exact path is a syntactically legitimate OAuth parameter. WHATWG parsing is
  intentionally forgiving and does not provide that validation.
- It assumes one decoded query-name pass is enough to classify callback/return
  aliases. Double-encoded or control-suffixed forms remain accepted as unrelated
  names and may be interpreted differently by another layer.
- It assumes rejecting duplicate names and bare `?` covers malformed queries. It
  does not cover missing values/names, invalid percent escapes, encoded controls, or
  empty segments.
- Browser E2E remains assigned to `TASK-034`; later E2E cannot make this reproduced
  TASK-030 T3 contract gap closure-eligible.

## Critical T3 Assessment

- Security/privacy: token/session/customer privacy properties pass; complete
  fail-closed query validation does not.
- Runtime/production: valid Google/VK-shaped locations are compatible. Corrupted or
  hostile backend responses in the reproduced malformed classes are still trusted
  and forwarded to the provider.
- Irreversible/data-loss/compliance: none introduced by TASK-030.
- Human checkpoint: operator approval for recovery 2 is recorded and the exact
  marker is present in the implementation handoff.
- Rollback/recovery: present and credible. Disable providers or revert the
  destination helper/tests; rotate provider/signing secrets and invalidate sessions
  after suspected compromise while preserving durable Auth/Customer/cart records.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth.ts:318-367` and focused destination tests.
- Expected: exact provider paths plus only syntactically valid, duplicate-free OAuth
  query parameters, with malformed/encoded callback and return abuse rejected.
- Observed: prior destination defects are fixed, but malformed query and encoded
  alias classes remain accepted.
- Likely category: code|verification
- Recommended next action: scheduler keeps `TASK-030` and dependents unclosed,
  obtains operator ownership for any further recovery, and requires corrected
  hostile regressions plus repeated independent verification.
- Requires replan: yes

## Closure Recommendation

- `REQUEST_CHANGES`. `TASK-030` is not closure-eligible and its dependents should
  remain unpromoted. Reviewer did not fix or execute implementation, sync, close,
  fail, block, or promote lifecycle state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
