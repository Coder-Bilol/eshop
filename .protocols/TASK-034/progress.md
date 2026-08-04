# TASK-034 Progress

## Preflight

- PASS: task identity, T3 routing, dependencies, packet/spec links, expanded logout
  scope, and verification basis are consistent.
- PASS: strict doctor identifies TASK-034 as a planned-to-ready candidate; `/execute`
  does not perform that promotion.

## Initial Implementation

- Added Google/VK browser provider pages plus backend-process token/profile doubles;
  production provider start/callback/session routes remain in the path.
- Added real-browser guest gate, safe return path, cancel/failure, callback cleanup,
  merge conflict/retry, replay, expiry, checkout readiness, and logout assertions.
- Added a minimal checkout logout button using the existing AuthStateController.
- Focused checkout test and workspace static gates passed.

## Functional Verification Failure

- Google callback redirected with `success`, but current customer returned `401` and
  merge attempts remained zero; VK and downstream scenarios were not reached.
- Raw backend request output made the generated log unsafe; the verifier deleted it.
- Historical verdict remains `VERDICT: FAIL` until independent verification repeats.

## Bounded Remediation

- Auth backend output is now consumed but not persisted; the generated backend log
  contains only coarse suppression and process-exit markers.
- Callback diagnostics record only response status and boolean cookie properties,
  never header/cookie/state/code values.
- Session/root-cause remediation is in progress; no backend production behavior has
  been edited.

## Confirmed Session Root Cause

- Callback response: `302`; Set-Cookie present; browser cookie present and changed;
  cookie is non-Secure for local HTTP; current-customer request sends the cookie.
- Current customer still returns `401`, excluding browser storage/CORS/cookie-send
  failure as the cause.
- Express session regeneration replaces `req.session`; the production helper writes
  and saves through its stale pre-regeneration Session argument.
- Fix requires an explicit backend auth scope decision before implementation.
