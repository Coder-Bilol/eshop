# TASK-030 Semantic Verification Report Code 06

## Findings

- HIGH: the session boundary can contradict backend authority and retain a previous
  customer's cart reference after an expired-session logout `401`.
- MEDIUM: the exact provider URL boundary still accepts a trailing empty fragment
  delimiter, so the no-fragment claim is broader than the implementation.

SEMANTIC_VERDICT: semantic-fail

## Evidence

- Green standard gates and TASK-043 evidence genuinely cover prior malformed-query,
  bounded-input, race, storage, and cleanup defects, but omit both reproduced cases.
- Real installed Google/VK start URLs are accepted without broadening origins/paths;
  no token persistence, forbidden-scope work, durable mutation, or architecture
  drift was found.
- Full adversarial assessment: `.protocols/TASK-030/red-verification-code-06.md`.

## Closure Recommendation

- REQUEST_CHANGES. Scheduler should not close TASK-030 or promote TASK-031,
  TASK-032, or TASK-039 until repeated `/verify` is PASS and `/red-verify` is
  semantic-pass. Reviewer performed no implementation, lifecycle, or sync action.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
