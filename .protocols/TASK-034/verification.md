# TASK-034 Independent Functional Verification

VERDICT: FAIL

## Context Gates

- Manual `/verify TASK-034`; no lifecycle transition or closure ownership inferred.
- Indexed task is T3 and its dependencies `TASK-031`, `TASK-032`, and `TASK-033`
  are done.
- Required `PACKET-TASK-034-R2` was `ready`, T3, and hash-matched before
  verification evidence was added.
- Linked FT-004 auth/session/cart specifications are present and consistent with
  the task acceptance criteria.
- Full execution protocol files `context.md`, `plan.md`, and `progress.md` were
  absent at verification start. This independently prevents T3 closure.

## Acceptance Assessment

| Verification target | Result | Evidence |
|---|---|---|
| Google and VK provider-double redirects establish a signed customer session | FAIL | The run stopped in the Google flow. The backend callback redirected with `success`, but the completion UI became `auth_failed`; `/store/customers/me` returned `401`. |
| Guest cart merge precedes checkout and conflict retry recovers | FAIL / NOT REACHED | The Google merge hook recorded zero attempts because no customer session was established. VK was not reached. |
| Guest gate, callback cleanup, cancel/failure/replay, expiry, and logout are buyer-visible | PARTIAL | Guest redirect, clean callback URL, and cancellation were observed. Success, replay, expiry, and logout could not complete after session establishment failed. |
| Evidence contains no credential, callback-state, session, PII, or full cart identifiers | FAIL | The generated Medusa log contained raw OAuth state, callback code, and full cart IDs. The unsafe artifact was deleted after a redacted count-only scan. |
| Purpose and success outcome are observable end-to-end | FAIL | The complete buyer-visible login-before-payment and cart-continuity outcome was not achieved. |
| Anti-goals and forbidden scope remain respected | PASS | No live providers, production data, checkout fields, orders, inventory, payments, or backend behavior edits were used by this verification. |

## Commands

- `npm --workspace apps/storefront run test:e2e -- auth` -> FAIL. Google
  completion state was `auth_failed`, current-customer status was `401`, merge
  attempts were `0`, and the expected `merge_blocked` state timed out.
- `npm --workspace apps/storefront run test` -> PASS; all storefront suites,
  including auth UI/state and checkout gate, passed.
- `npm run typecheck` -> PASS for storefront and backend.
- `npm run build` -> PASS for storefront and backend.
- `node scripts/mb-lint.mjs` -> PASS, 120 files before verification evidence.
- `node scripts/mb-doctor.mjs --strict` -> PASS before evidence, with the expected
  TASK-034 planned-to-ready warning and unrelated TASK-040 upstream warning.
- `node --check` for both changed E2E CommonJS files -> PASS.
- `git diff --check` -> PASS with line-ending warnings only.
- Count-only artifact privacy scan -> FAIL before sanitization: two raw OAuth
  state values, one callback code, and two full cart IDs were present in the
  generated backend log. No session cookie, fixture email, or secret label matched.

## Bugs And Recovery

- `.memory-bank/bugs/TASK-034-callback-session-gap.md` records the failed real
  callback/session boundary.
- `.memory-bank/bugs/TASK-034-evidence-sanitization-gap.md` records unsafe generated
  evidence.
- Recovery: fix or correctly exercise the callback-to-session boundary without
  changing production behavior from acceptance code; sanitize generated request
  logs before writing evidence; rerun `/execute`, then repeat `/verify TASK-034`.
- Per-task `/red-verify TASK-034` must wait for functional PASS.

## Lifecycle Recommendation

- Recommended status: `failed` or bounded implementation retry by the explicit
  owner/scheduler.
- Current task status remains unchanged because this manual `/verify` does not own
  T3 closure or scheduler transitions.
- T3 closure is not eligible: functional verification failed, full execution
  protocol is incomplete, per-task semantic verification has not passed, and the
  human checkpoint is pending.

HUMAN_CHECKPOINT: pending
ROLLBACK_RECOVERY_NOTE: present
