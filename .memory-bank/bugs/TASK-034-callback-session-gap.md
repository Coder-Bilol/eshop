---
description: Active TASK-034 real browser callback-to-session acceptance failure.
status: active
owner: verify
last_updated: 2026-08-04
source_of_truth:
  - .memory-bank/tasks/TASK-034.task.json
  - .protocols/TASK-034/verification.md
---
# TASK-034 Callback Session Gap

## Summary

The real Google provider-double callback reaches the production callback route and
redirects with a sanitized `success` status, but the browser does not obtain a usable
customer session. Storefront completion resolves to `auth_failed` and the real
current-customer request returns `401`.

## Impact

- Google browser acceptance fails before cart merge or checkout readiness.
- VK, replay, session expiry, and logout acceptance are not reached.
- TASK-034 cannot receive functional PASS or proceed to per-task semantic
  verification.

## Evidence

- `.protocols/TASK-034/verification.md`
- `.tasks/TASK-034/verify-functional-gates-code-01.md`
- `.tasks/TASK-034/playwright/real-runtime-progress.log`
- `.tasks/TASK-034/playwright/real-medusa-failure.png`

## Required Resolution

- Determine why a successful callback does not leave the browser with a usable
  Medusa customer session.
- Keep the correction in the owning auth/session implementation task; acceptance
  code must not alter production auth behavior to force a pass.
- Prove both Google and VK callbacks through the real session/current-customer
  boundary, then continue cart merge, checkout, replay, expiry, and logout checks.
- Repeat `/verify TASK-034`; run `/red-verify TASK-034` only after functional PASS.

## Remediation Status

- Repository remediation now reacquires `req.session` after `regenerate()` before
  writing and saving customer `auth_context`.
- A focused regression simulates Express replacing the session object and rejects
  any save through the stale object.
- This bug remains active until the corrected backend is deployed and the real
  browser callback/current-customer boundary is repeated successfully.

## Root Cause

- Coarse browser diagnostics prove the callback returns `302` with Set-Cookie, the
  browser stores a changed non-Secure session cookie, and the current-customer
  request sends that cookie, but still receives `401`.
- `establishCustomerSession` receives the current Session object and calls its
  `regenerate()` method. Express replaces `req.session` during regeneration, but the
  helper then writes `auth_context` and calls `save()` on the stale pre-regeneration
  object.
- The cookie therefore references the regenerated empty session while customer auth
  context is not available to later session authentication.
- Correct remediation must use the refreshed `req.session` object after regeneration
  and add a regression assertion; this is backend auth behavior outside the current
  TASK-034 write scope.
