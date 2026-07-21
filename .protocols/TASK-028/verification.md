# TASK-028 Independent Verification

VERDICT: FAIL

## Finding

- HIGH: `apps/backend/src/modules/auth-vkid/service.ts:256` sends the configured VK
  confidential-app service token as `client_secret`. The official VK ID OAuth 2.1
  contract requires the POST parameter `service_token` for authorization-code
  exchange. The synthetic double asserts the same incorrect `client_secret` name
  at `apps/backend/src/scripts/smoke-auth-vkid.ts:251`, so its passing result cannot
  prove a real VK exchange. This violates the task success outcome and packet stop
  condition because start can succeed while every confidential callback exchange
  fails upstream.

## Context Gates

- Indexed task exists, remains `in_progress`, and is `T3` in scheduler mode.
- Full protocol files are present. Linked FT-004 auth architecture, security, and
  state specs were read.
- Packet `PACKET-TASK-028-R3` is `ready`; its raw-file SHA-256 exactly matches the
  current task record:
  `sha256:9361390b57f9ede5553cdfd31c61a7a39a80a848d3c36c4ede3f976c47d23ba6`.
- No task lifecycle, dependent promotion, code, Memory Bank, or mb-sync change was
  made by this verifier.

## Functional Evidence

- Medusa 2.16 loader check with synthetic options: pass. The module imports through
  `loadModuleProvider`, registers module `auth`, service ID `vkid`, and the expected
  `AbstractAuthModuleProvider` service.
- Opaque state: pass by source audit and contract test; 32 random bytes produce a
  43-character base64url state with no embedded customer/cart/return data.
- TTL and single use: pass for the specified single-process runtime. Provider state
  expires after ten minutes, is overwritten as consumed before exchange, rejects
  sequential replay, and uses a singleton-provider in-process claim for concurrent
  replay.
- PKCE: pass. A fresh 43-character verifier is retained server-side, only its S256
  challenge is sent at start, and the original verifier is sent during exchange.
- `device_id`: partial evidence only. Missing values fail and supplied values are
  forwarded to exchange, but the permissive double does not reject a mismatched
  value as VK would when binding code, verifier, and device.
- Identity: pass locally. Token/profile `user_id` must be stable, numeric, and equal;
  email is required, normalized, and obtained from token-authorized user-info.
- Failures: pass locally for cancel, missing callback fields, network failure,
  replay, expiry, stored-verifier tampering, returned-state mismatch, missing email,
  and token/profile subject mismatch. All return `VK authentication failed`.
- Persistence/logging: pass by data-flow audit and synthetic markers. Tokens are
  used only for callback-local user-info retrieval and are absent from provider
  state, identity create input, logger calls, and normal command output.
- Scope: TASK-028 runtime additions are within the indexed allowed write scope;
  forbidden product surfaces were not added. Existing unrelated dirty changes were
  not attributed to or modified by verification.
- Regression checks: backend typecheck, auth configuration smoke, Memory Bank lint,
  and `git diff --check` pass. Existing DB-backed integration suites were not run;
  the wrapper delegation path was source-audited.

## Commands

- `npm --workspace apps/backend run test:integration -- auth-vkid` -> exit 0, but
  false-success for real VK compatibility because the double expects
  `client_secret`.
- `npm --workspace apps/backend run typecheck` -> exit 0.
- `node scripts/mb-lint.mjs` -> exit 0, `118 files`.
- `npm --workspace apps/backend run smoke:auth-config` -> exit 0.
- Synthetic `loadModuleProvider` Node/ts-node check -> exit 0.
- `git diff --check` -> exit 0 with line-ending warnings only.
- PowerShell SHA-256 comparison of task and packet -> exact match.
- Official VK ID API reference inspection, no credentials or authorization flow:
  `https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description`.

## Recommendation

- Scheduler should recommend `status: failed`, keep dependents unpromoted, correct
  the token request field to `service_token`, make the provider double enforce the
  official request, and repeat `/verify` and `/red-verify`.
- No bug/task/lifecycle artifact was created because this reviewer was restricted
  to verification evidence paths.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
