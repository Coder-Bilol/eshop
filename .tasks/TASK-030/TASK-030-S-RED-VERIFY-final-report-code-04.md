# TASK-030 Semantic Verification Report Code 04

SEMANTIC_VERDICT: semantic-fail

## Findings

- HIGH: code-04 restores actual Google/VK start capability but still misses the
  exact fail-closed destination policy that justified the exceptional recovery.
  Default ports and arbitrary/cross-provider callback destinations pass, and
  return-like fragments bypass validation.
- MEDIUM: green focused tests overclaim callback/return abuse coverage because none
  of the independently reproduced accepted cases is asserted.

## Evidence

- Real installed Google and project VK authorization starts pass through the
  storefront client. All previously corrected session, logout, storage, cart, 401,
  credentials, and token non-storage behavior remains correct under focused/full
  regressions.
- Scope, anti-goals, durable-data safety, human checkpoint, and rollback/recovery
  evidence remain intact.
- Full adversarial assessment:
  `.protocols/TASK-030/red-verification-code-04.md`.

## Recommendation

- `REQUEST_CHANGES`. `TASK-030` is not closure-eligible; dependents should remain
  unpromoted. Reviewer did not fix, execute implementation, sync, or mutate
  lifecycle state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
