# TASK-028 Adversarial Semantic Verification

SEMANTIC_VERDICT: semantic-fail

## Top Substance Risk

- HIGH false success: the provider contract suite passes because both production
  code and its double use `client_secret`. VK ID requires `service_token` for a
  confidential application's authorization-code exchange. The implementation is
  structurally compatible with Medusa but cannot achieve the actual VK login
  purpose at the external provider boundary.

## Purpose Fit And Anti-goals

- Purpose fit: failed. A provider that cannot exchange a real authorization code
  does not add usable VK ID identity to Medusa.
- Anti-goals: respected. No customer/session/UI/account-linking behavior, live
  credentials, provider-token persistence, or parallel auth system was added.
- Scope/autonomy: respected for the reviewed implementation surface. Verification
  wrote evidence only and did not alter code or lifecycle state.

## Cross-boundary Assessment

- Medusa boundary: compatible with v2.16 module-provider loading, provider ID, and
  authenticate/callback interfaces.
- VK boundary: incompatible at the confidential token-exchange request field.
- State/data: local opaque TTL/single-use state, S256 verifier storage, stable
  subject, required normalized email, and token non-persistence are otherwise
  consistent with linked specs for the single-process MVP.
- Security/operations: failures are sanitized and no token/log exposure was found.
  The principal operational symptom would be every live callback returning the same
  coarse failure, hiding an integration contract error behind expected sanitization.
- Maintenance: the provider double currently institutionalizes the wire-contract
  error. Without correcting both code and test, future green runs preserve the
  defect.

## How This Could Still Be Wrong

- No live VK credentials or account were used, as required. The verdict relies on
  the current official VK ID API specification rather than live UAT.
- The double proves missing `device_id` rejection and forwarding, but not a
  mismatched code/device/verifier tuple; it should model VK's binding rejection.
- Existing DB-backed integration suites were not rerun, so regression confidence is
  bounded to typecheck, config smoke, loader compatibility, wrapper audit, lint, and
  diff checks.

## Failure / Blocker

- Status: failed
- Where: `apps/backend/src/modules/auth-vkid/service.ts:256` and
  `apps/backend/src/scripts/smoke-auth-vkid.ts:251`
- Expected: confidential token exchange sends `service_token` and the provider
  double rejects the incorrect field.
- Observed: exchange sends and the double requires `client_secret`.
- Likely category: code
- Recommended next action: correct the request contract and its double, add
  mismatched `device_id`/code binding coverage, then rerun both verification passes.
- Requires replan: no

## Scheduler Recommendation

- Do not close TASK-028 and do not promote TASK-029.
- Recommend `status: failed` and a bounded implementation retry.
- The recorded human checkpoint and recovery note remain credible but do not
  override the semantic failure.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
