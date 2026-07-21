# TASK-029 Functional Verification Report

VERDICT: FAIL

## Findings

- HIGH: first-login `session.save` failure destroys the session but retains the
  newly created customer and auth-to-customer link. The existing smoke test asserts
  only session cleanup, contrary to the linked state verification target requiring
  no customer/session/link after a pre-session failure.
- MEDIUM: `npm --workspace apps/backend run test:integration` now exits 0 without
  running a suite; before the dispatcher replacement, no arguments selected all
  legacy integration suites.

## Evidence

- Packet R3 is `ready` and its source hash matches TASK-029 exactly.
- Required named integration, backend typecheck, Memory Bank lint, VK regression,
  and diff check pass.
- Independent route probe passes exactly-one existing actor resolution, replay
  rejection, same-email cross-provider no-link/no-session behavior, server-side
  session save, fixed redirect, and provider-token omission.
- Independent first-login/session-failure probe reports session cleanup but one
  retained customer and retained `customer_id` auth link.
- Installed Medusa 2.16 declarations/source confirm the implementation uses the
  supported customer-account workflow and Auth/Customer module contracts.
- Current tests are synthetic. Real Medusa/PostgreSQL persistence remains TASK-033
  and was neither required here nor falsely credited as completed acceptance.

## Recommendation

- Scheduler should recommend `status: failed`, keep dependents unpromoted, resolve
  the first-login failure policy against the state spec, restore default integration
  dispatch, and rerun both verification passes.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
