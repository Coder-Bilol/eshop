---
description: Resolved TASK-033 gap in real session-cookie and restart-logout acceptance evidence.
status: archived
owner: verify
last_updated: 2026-07-31
source_of_truth:
  - .memory-bank/tasks/TASK-033.task.json
  - .memory-bank/packets/TASK-033.packet.json
  - .protocols/TASK-033/verification.md
---
# TASK-033 Session Restart Acceptance Gap

## Summary

TASK-033 proves real Medusa Auth/Customer PostgreSQL persistence but does not exercise
the required runtime session-cookie and restart-logout boundary. The acceptance uses
an in-memory session recorder and reports restart loss by checking that persisted
Auth/Customer JSON has no session-like fields.

## Impact

- A green acceptance summary can claim cookie creation/destruction and restart logout
  without any HTTP `Set-Cookie`, cookie reuse, logout request, or backend restart.
- TASK-033 cannot receive functional PASS or proceed to semantic verification.
- Durable customer/identity evidence remains valid and synthetic fixture cleanup
  passes; no production data or behavior was changed.

## Evidence

- `.protocols/TASK-033/verification.md`
- `.tasks/TASK-033/verify-functional-gates-code-01.md`
- `.tasks/TASK-033/TASK-033-S-VERIFY-final-report-code-01.md`

## Required Resolution

- Start the real local Medusa HTTP boundary with synthetic/local provider setup.
- Capture and use the actual session cookie to prove current-customer access.
- Prove logout invalidates that cookie.
- Restart the backend process and prove an old cookie is rejected while the durable
  Auth/Customer link remains readable.
- Keep output sanitized and cleanup unconditional, then repeat `/verify TASK-033` and
  run `/red-verify TASK-033` only after PASS.

## Remediation Implemented

- Implemented on 2026-07-31 inside the existing TASK-033 acceptance scope.
- Real compiled Medusa HTTP session creation, Set-Cookie, current-customer access,
  logout invalidation, full process restart, and stale-cookie rejection now pass.
- Durable linkage is re-read after restart and cleanup asserts zero auth/customer/API
  key fixtures; private runtime state is removed.
- Independent repeated `/verify TASK-033` returned PASS after reproducing the real
  HTTP cookie/logout/restart flow, durable-link read, cleanup, and privacy gates.
- Resolved and archived on 2026-07-31. T3 closure still requires per-task
  `/red-verify TASK-033` semantic-pass.
