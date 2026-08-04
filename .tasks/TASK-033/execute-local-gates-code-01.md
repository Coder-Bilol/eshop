# TASK-033 Execute Local Gates Code 01

| Command | Result | Summary |
|---|---|---|
| `npm --workspace apps/backend run test:integration -- auth-acceptance` | PASS | Real PostgreSQL write/read, provider contracts, and asserted cleanup pass. |
| `npm --workspace apps/backend run test:integration -- auth-completion` | PASS | Existing completion/atomicity/session/redirect/rate-limit contract remains passing through dispatcher. |
| `npm --workspace apps/backend run test:integration -- auth-vkid` | PASS | Existing state/expiry/replay/PKCE/device/token-safety contract remains passing through dispatcher. |
| `npm --workspace apps/backend run typecheck` | PASS | Backend TypeScript compiles without errors. |
| `npm run smoke:local` | PASS | Windows-native env, PostgreSQL migration/seed/smoke, and workspace typechecks pass. |
| `node scripts/mb-lint.mjs` | PASS | Final result recorded after documentation update. |

## Evidence Privacy

- Acceptance output contains coarse assertions/counts only.
- Provider child output is checked before summary emission.
- No fixture ID/email, token, session ID, raw IP, secret, production data, or live
  provider result is recorded here.

## Cleanup

- Final cleanup process is unconditional.
- Cleanup queries assert zero remaining TASK-033 synthetic auth identities/customers.
