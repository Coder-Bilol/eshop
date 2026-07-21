# OAuth Provider Redirect Allowlist Bug

- Source task: `TASK-030`
- Severity: HIGH
- Status: second recovery failed; operator decision required
- Functional verdict: FAIL
- Semantic verdict: semantic-fail
- Retry budget: exhausted (2/2)

## Problem

The storefront accepts an OAuth start destination only when it matches the backend
origin. The VK ID provider legitimately returns `https://id.vk.com/authorize`, so
the completed backend/provider path is rejected as `auth_invalid_response`.

## Required Resolution

Implement the approved Google/VK authorization-destination allowlist in `TASK-030`
while rejecting arbitrary external, credential-bearing, downgrade, callback, and
return-path destinations. Independently verify the recovery before closing the task
or promoting dependents.

## Operator Decision

- Approved authorization origins: `https://accounts.google.com`,
  `https://id.vk.com`.
- Approved one reviewed recovery attempt for `TASK-030` beyond the default retry
  budget.
- The temporary `TASK-043` follow-up was removed before execution; recovery remains
  in the original authoritative task.

## Recovery Result

The recovery accepted the approved Google/VK origins and real provider starts, but
independent verification rejected origin-only backend trust: arbitrary backend and
wrong-provider paths, explicit `:443`, and fragment payloads remained accepted.
`TASK-043` now captures the unresolved exact-path contract. Another `TASK-030`
recovery requires explicit operator approval.

## Second Operator Decision

- Allowed exact destinations: `https://accounts.google.com/o/oauth2/v2/auth` and
  `https://id.vk.com/authorize`.
- Backend destinations, explicit ports, credentials, fragments, and all other paths
  are forbidden.
- One additional reviewed recovery attempt is approved; temporary `TASK-043` is
  removed before execution.

## Second Recovery Result

Exact origins/paths and standard hostile URL variants now pass review, but malformed
raw query forms, invalid escapes, encoded controls, empty segments, and double-encoded
callback/return keys remain fail-open. `TASK-043` captures this final parser gap.

## Evidence

- `.tasks/TASK-030/TASK-030-S-VERIFY-final-report-code-03.md`
- `.tasks/TASK-030/TASK-030-S-RED-VERIFY-final-report-code-03.md`
