# TASK-043 Progress

- Preflight complete: task, packet R2, T3 protocol, linked auth contract, TASK-030
  code-05 failures, current validator/tests, dependencies, and dirty worktree checked.
- Added raw query validation before WHATWG URL parsing.
- Added malformed syntax, invalid encoding, encoded control/NUL, bounded-decoding
  navigation key, and decoded duplicate regressions.
- Preserved exact Google/VK destination and existing provider callback validation.
- Focused and full storefront tests, workspace typecheck, separate storefront/backend
  builds, lint, Memory Bank lint, and diff checks pass.
- Root `npm run build` encountered a tool-level `ChildProcess.kill` error without
  compiler output; both workspace builds then passed independently.
- Final scope audit: only the two allowed runtime/test files plus TASK-043 protocol
  and report artifacts were changed by this implementation.

## 2026-07-19 Implementer Bounded Retry 1/2

- Read packet R4 and both independent Reviewer FAIL reports before editing.
- Added explicit 4096-character raw-query and 32-segment caps before component parsing.
- Changed repeated decoding to reject malformed percent syntax immediately after
  every decode round instead of returning a partially decoded value.
- Restricted decoded names to OAuth-safe unreserved characters, rejecting reproduced
  `%20`, `+`, and `%3D` names.
- Added all reproduced malformed-percent/name/resource probes and exact cap boundary
  cases while retaining realistic Google/VK starts and the prior hostile matrix.
- Passed focused auth-client tests, all eight storefront suites, storefront and
  workspace typechecks, VK provider smoke, workspace lint, Memory Bank lint, the
  root storefront/backend production build, and whitespace checks.
- Final scope audit: no backend provider, cart, checkout/order/payment, browser
  token storage, task lifecycle, verification, red-verification, sync, or changelog
  changes were made by this retry.
