# TASK-032 Semantic Remediation

## Trigger

- Functional verification: `VERDICT: PASS`.
- Adversarial verification: `SEMANTIC_VERDICT: semantic-concern`.
- Concern: `/checkout` existed both in sessionStorage and the `/login` query, while
  `.memory-bank/contracts/auth-session-security.md` requires local sessionStorage as
  the only storefront return-path source.

## Decision And Scope

- The operator instructed GENERAL to continue after the recommended bounded
  login-boundary remediation and its scope requirement were presented.
- TASK-032 now permits only the required neighboring login page/component,
  auth-state start behavior, and focused auth tests.
- Required packet refreshed to `PACKET-TASK-032-R8`; strict doctor reports PASS.

## Changes

- `prepareCheckoutLogin()` writes constant normalized `/checkout` through
  `writeReturnPath()` and returns clean `/login`.
- Login page no longer reads any `searchParams` or `return_path` query value.
- `AuthLogin` starts the provider without supplying a return path.
- `AuthStateController.startLogin()` writes a return path only when the caller
  explicitly supplies one; omission preserves existing sessionStorage state.
- Focused tests prove clean login URL, absent query parsing, preserved storage state,
  explicit-path compatibility, and all previous checkout/auth behavior.

## Local Evidence

- `npm --workspace apps/storefront run test -- checkout-auth-gate`: PASS.
- `npm --workspace apps/storefront run test -- auth-state`: PASS.
- `npm --workspace apps/storefront run test -- auth-ui`: PASS.
- `npm --workspace apps/storefront run test`: PASS, all 10 suites.
- `npm --workspace apps/storefront run typecheck`: PASS.
- `npm --workspace apps/storefront run build`: PASS; `/checkout` and `/login` build.
- `node scripts/mb-lint.mjs`: PASS, 118 files.
- `node scripts/mb-doctor.mjs --strict`: PASS, zero errors; one unrelated TASK-040
  upstream warning and two informational messages.
- `git diff --check`: PASS with line-ending warnings only.

## Handoff

- Implementation concern is remediated locally.
- Existing independent semantic-concern evidence remains unchanged.
- Repeat `/verify TASK-032` and `/red-verify TASK-032` before any T3 closure or
  `/mb-sync` decision.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
