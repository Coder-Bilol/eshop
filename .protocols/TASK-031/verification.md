# TASK-031 Independent Functional Verification

## Findings

- HIGH: `apps/storefront/components/auth-completion.tsx:78-83` treats every
  non-null CartProvider handoff as `merged` and ignores `handoff.state`.
  `apps/storefront/components/cart-provider.tsx:98-107` can return a validated
  merge result together with `backend_error` or `empty` after target-cart restore.
  The completion then sets `authenticated_ready` at lines 152-156 and consumes the
  return path at lines 176-185. A hostile probe reproduced
  `backend_error -> merged -> authenticated_ready` and
  `empty -> merged -> authenticated_ready`. This can continue checkout after the
  active target cart failed to load or its reference was cleared.
- MEDIUM: `apps/storefront/src/auth-ui.test.cjs` does not mount the login/completion
  components. It tests exported helpers and source-text patterns, so double-click,
  stale async completion, auth-state change during merge, and unmount/remount
  behavior are not exercised. In particular, an in-flight merge operation is not
  invalidated when lines 167-173 change the view to `auth_failed`; its later
  fulfillment can still satisfy the unchanged operation check at lines 153-155.

- Role: Reviewer
- Mode: scheduler
- Tier: T3
- Packet: `PACKET-TASK-031-R8`, status `ready`
- Packet hash: exact match,
  `sha256:c62c46ce4dbb6ac150a28309399e55e65181a7e1df67013ee215c113e240f4a1`

VERDICT: FAIL

## Acceptance Results

- PASS: Login source presents equal Google and VK ID buttons, disables both from
  provider pending state, uses only `AuthProvider.startLogin()`, and exposes bounded
  pending/failure/retry copy.
- PASS: Completion accepts exactly one allowlisted `provider` and one coarse
  `status`, rejects extra/duplicate/unknown parameters and any fragment, and calls
  `history.replaceState()` before visible completion state.
- PASS: Current-customer truth comes from the existing AuthProvider
  `restoreSession()` boundary. No customer object or customer PII is rendered.
- PASS: No-source skips the merge request and reaches readiness after current-
  customer retrieval.
- PASS: A rejected merge renders a sanitized blocked state, retains the source via
  the unchanged FT-003 handoff, and exposes retry. Source-level retry guards prevent
  a second attempt after the retry view has been replaced.
- FAIL: A non-null merge result is sufficient for `authenticated_ready` even when
  the accompanying cart state is `backend_error` or `empty`. Cart readiness and
  checkout blocking are therefore not truthful for a recoverable target-refresh
  failure.
- PASS: `consumeAuthenticatedReturnPath()` invokes storage consumption only for
  `authenticated_ready`; `returnPathConsumed` prevents a second component-level
  consumption. The failed readiness classification makes this guard reachable too
  early in the defect above.
- PASS: Source/privacy review found no rendered provider code/state/token, raw
  backend/provider error, customer ID/email, dangerous HTML, or browser auth-token
  persistence in TASK-031 changes.
- PASS: Runtime/test changes stay in packet allowed scope. Backend auth/provider,
  FT-003 merge semantics, checkout form, order, inventory, and payment files were
  not changed by TASK-031.
- PASS with test gap: semantic headings, native buttons/links, `role=status`,
  `role=alert`, disabled pending controls, existing responsive layout, and mobile
  button stacking are present. A mounted browser accessibility run was not obtained.

## Commands And Evidence

- PASS: raw SHA-256 comparison of R8 packet and authoritative task.
- PASS: `node scripts/mb-doctor.mjs --strict`; 0 errors, two unrelated upstream
  dependency warnings.
- PASS: `npm --workspace apps/storefront run test -- auth-ui`.
- PASS: `npm --workspace apps/storefront run test`; all nine storefront suites.
- PASS: `npm --workspace apps/storefront run typecheck`.
- PASS: `npm --workspace apps/storefront run build`; `/login` and
  `/auth/complete` generated.
- PASS: `node scripts/mb-lint.mjs`; 118 files.
- PASS: `git diff --check`; no whitespace errors, existing line-ending warnings.
- FAIL: independent hostile CartProvider handoff probe. Both
  `{ result: merge, state: { status: "backend_error" } }` and
  `{ result: merge, state: { status: "empty" } }` returned `merged`, which the
  component maps to `authenticated_ready`.
- TOOL GAP: Playwright's bundled Chromium is not installed. A system-Chrome attempt
  timed out under the PowerShell child-process wrapper, so no mounted browser result
  is claimed for double-click/unmount/accessibility behavior.

## T3 And Scheduler Recommendation

- REQUEST_CHANGES. Keep TASK-031 non-closure-eligible and do not promote checkout
  dependents. Completion must require truthful ready cart state, and focused tests
  must cover the failed handoff-state cases plus stale async/auth/unmount races.
- Human checkpoint evidence is explicit in the operator instruction and worker
  handoff. The rollback/recovery note is credible: revert the bounded UI/test files
  or disable provider starts; rotate compromised provider/session secrets and
  invalidate sessions while preserving durable customer/cart records.
- Reviewer did not modify implementation, task/packet lifecycle, dependencies,
  changelog, or run `/mb-sync`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
