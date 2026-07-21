# TASK-043 Independent Red Verification

- Role: Reviewer
- Mode: scheduler
- Tier: T3

SEMANTIC_VERDICT: semantic-fail

## Findings

- HIGH purpose/security fit failure: the change closes every TASK-030 reproduced
  raw malformed case but retains an explicit fail-open branch for malformed percent
  syntax discovered after decoding. Green normal tests therefore do not establish
  the stated outcome that only structurally valid legitimate OAuth queries pass.
- MEDIUM false-success risk: decoded blank/delimiter names and resource-unbounded
  query shapes pass outside the focused matrix, while its output broadly claims
  malformed query coverage.

## Hostile Assessment

- Purpose fit: insufficient. Exact Google/VK starts work, controls and duplicates
  fail closed, and dangerous aliases are detected through the decode bound, but the
  remaining malformed-percent branch directly contradicts TASK-043's purpose.
- Anti-goals and autonomy: respected. Provider origins/paths were not broadened;
  backend exchange, cart semantics, checkout/order/payment, browser token storage,
  lifecycle, and sync were not changed.
- Scope: runtime/test changes stay within the task's allowed files. Reviewer writes
  are verification artifacts only.
- Boundary impact: exact-path and provider-bound callback checks remain intact. The
  defect is local to raw-query validation before WHATWG normalization.
- State/data consistency: prior customer/session/logout/cart behavior remains green;
  no migration, durable mutation, destructive action, or data-loss path was added.
- Operational impact: malformed backend responses may still be forwarded to a
  provider, and very large responses can consume browser CPU/memory before rejection.
- Maintenance cost: a special `round === 0` malformed-escape exception is subtle,
  untested, and makes future decoder assumptions capable of widening the boundary.

## Hidden Assumptions And How This Could Still Be Wrong

- The implementation assumes malformed percent syntax matters only in the original
  raw component. The task instead requires validation after bounded decoding.
- It assumes any non-empty decoded name is structurally legitimate. Encoded spaces
  and delimiters demonstrate otherwise.
- It assumes fixed decode depth is a sufficient resource bound. Query length and
  segment count remain unbounded.
- Live provider UAT is external and cannot repair a deterministic parser failure;
  mocked realistic Google/VK starts already prove the bounded fix can preserve
  legitimate behavior.

## Critical T3 Assessment

- Security/privacy: token/session privacy and exact destination checks pass; the
  malformed-query fail-closed requirement does not.
- Runtime/production: independent storefront/backend builds and the root wrapper
  pass. The earlier implementation-side `ChildProcess.kill` was not reproduced and
  is separate from this semantic failure.
- Irreversible/data-loss/compliance: none introduced by TASK-043.
- Human checkpoint: recorded by the operator and exact implementation markers.
- Rollback/recovery: present and credible; disable provider starts or revert the
  query helper/tests, rotate secrets and invalidate sessions after suspected
  compromise, and preserve durable Auth/Customer/cart records.

## Bounded Counterproposal

- Return `null` for malformed percent syntax at every decode round; do not return a
  partially decoded malformed value.
- Reject decoded names that are blank or outside a conservative OAuth parameter-name
  grammar, including decoded whitespace and query delimiters.
- Add explicit raw-query length and segment-count caps sized above observed Google/VK
  starts, then regress the accepted 1 MB and 10,000-segment cases.
- Add post-decode malformed percent probes at rounds one through the limit plus the
  current legitimate Google/VK matrix; do not alter destination origins, paths, or
  backend exchange.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth.ts:347-399` and
  `apps/storefront/src/auth-client.test.cjs:183-225`.
- Expected: structurally malformed or ambiguous queries fail closed before URL
  normalization, including after bounded decoding.
- Observed: post-decode malformed percent syntax and invalid decoded names pass; the
  parser also has no total-size or segment-count bound.
- Likely category: code|verification
- Recommended next action: scheduler routes the bounded parser/test fix without
  closing TASK-043 or promoting dependents, then repeats both independent gates.
- Requires replan: no

## Closure Recommendation

- REQUEST_CHANGES. TASK-043 is not scheduler closure-eligible. A bounded local fix
  is sufficient; no architecture or public-contract change is required.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
