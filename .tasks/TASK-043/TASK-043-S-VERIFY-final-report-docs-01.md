# TASK-043 Functional Verification Report Docs 01

VERDICT: FAIL

## Findings

- HIGH: post-decode invalid/truncated/mixed percent escapes are accepted. Independent
  probes passed `state=%25`, `state=%252`, `state=%2520%25`, and
  `callback_url%25=x` because `decodeQueryComponent()` fails open after round zero.
- MEDIUM: encoded blank/delimiter names (`%20`, `+`, `%3D`) and resource-unbounded
  queries (1 MB value, 10,000 segments) are accepted outside the focused suite.

## Evidence

- PASS: bare/empty segments, raw malformed escapes, encoded controls/NUL, duplicate
  ambiguity through bounded decoding, callback/return aliases and case variants,
  and over-deep encodings reject.
- PASS: realistic Google/VK OAuth/PKCE starts and every prior TASK-030 session,
  logout, storage, cart, path/origin, callback, credentials, and token non-persistence
  regression remain green.
- PASS: focused/full storefront tests, typechecks, VK smoke, lint, Memory Bank lint,
  strict doctor with packet R3, direct storefront/backend builds, root build, and
  diff check.
- Full evidence: `.protocols/TASK-043/verification.md`.

## Recommendation

- REQUEST_CHANGES. Do not close TASK-043 or promote dependents. Apply the bounded
  parser/test fix described in the full report, then repeat both verification gates.
  Reviewer changed no implementation, lifecycle, task/packet state, sync, or bug
  record.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
