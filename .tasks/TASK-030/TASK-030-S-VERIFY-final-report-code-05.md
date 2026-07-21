# TASK-030 Functional Verification Report Code 05

VERDICT: FAIL

## Findings

- HIGH: exact provider paths are enforced, but malformed OAuth query parameters
  still pass. Independent probes accepted valueless/unnamed parameters, invalid
  percent escapes, percent-encoded NUL, empty `&` segments, and malformed or
  double-encoded `callback_url`/`return_url` aliases.
- MEDIUM: the focused hostile suite does not cover these accepted forms while its
  output claims malformed/encoded callback and return abuse fails closed.

## Evidence

- Packet R11 is `ready`; strict doctor accepted its current task hash.
- Realistic Google and VK authorization locations with legitimate OAuth/PKCE query
  parameters pass. Backend destinations, explicit default/nondefault ports,
  credentials, fragments, origin/path confusion, encoded/dot-segment path tricks,
  ordinary callback/return abuse, duplicates, and wrong callbacks reject.
- Every prior session/logout race, failed-logout retention, cart cleanup retry,
  one-shot storage, `401`, credentials-include, and no-token fix remains green.
- Focused/full storefront tests, workspace typecheck/build, backend VK smoke, Memory
  Bank lint/strict doctor, token scan, and diff check pass.
- Full evidence: `.protocols/TASK-030/verification-code-05.md`.

## Recommendation

- `REQUEST_CHANGES`. Do not close `TASK-030` or promote dependents. Route any
  further recovery through operator/scheduler ownership, then repeat `/verify` and
  `/red-verify`. Reviewer changed no code, lifecycle, task/packet/bug state, sync,
  or dependency state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
