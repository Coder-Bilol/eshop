# TASK-028 Functional Verification Report

VERDICT: FAIL

## Finding

- HIGH: VK ID requires `service_token` for confidential authorization-code
  exchange, but `service.ts:256` sends `client_secret`; the provider double asserts
  the same incorrect field and produces a false PASS.

## Evidence

- Packet R3 hash/status gate: pass.
- Medusa v2.16 provider loader/interface: pass with synthetic options.
- State TTL/single use, S256 PKCE, required `device_id`, stable subject, required
  normalized email, replay/expiry/cancel/network/mismatch failures, sanitization,
  and token non-persistence: local checks pass.
- Required commands: integration exit 0, typecheck exit 0, mb-lint exit 0.
- Additional checks: auth-config smoke exit 0; diff check exit 0.
- Official contract source:
  `https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description`.
- No live credentials or live authorization flow was used.

## Scheduler Recommendation

- Recommend `status: failed`; do not close or promote dependents. Correct production
  request and provider double, then repeat independent verification.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
