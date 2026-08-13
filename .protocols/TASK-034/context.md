# TASK-034 Context

- Role: GENERAL implementer
- Mode: manual bounded implementation retry after functional FAIL
- Tier: T3
- Task record: `.memory-bank/tasks/TASK-034.task.json`
- Packet: `.memory-bank/packets/TASK-034.packet.json`
  (`PACKET-TASK-034-R3`, status `ready`)
- Status observed: `planned`; `/execute` does not change lifecycle state
- Dependencies: TASK-031, TASK-032, and TASK-033 are `done`

## Normative Inputs

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`

## Retry Trigger

- Functional verification observed Google callback `success` followed by current
  customer `401`; cart merge and downstream provider/session/logout coverage did not
  run.
- The generated backend log persisted raw callback and cart identifiers and was
  deleted by the verifier.
- Required T3 execution context, plan, and progress files were absent.

## Scope

- Runtime writes stay in the TASK-034 browser harness, local provider double,
  buyer-visible checkout logout control, focused test, package script, and changelog.
- The operator-approved prerequisite remediation in commit `b6e39a0` corrected only
  the production callback session regeneration defect and its focused backend
  regression. No further backend behavior change is included in this retry.
- Backend cart behavior remains read-only.
- Live providers, credentials, production data, checkout fields, orders, inventory,
  and payments remain forbidden.
