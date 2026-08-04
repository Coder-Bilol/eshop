# TASK-033 Plan

- Tier: T3
- Task record: `.memory-bank/tasks/TASK-033.task.json`
- Packet context: `.memory-bank/packets/TASK-033.packet.json` R4, status `ready`

## Goal Interpretation

- Purpose: prove durable and security-sensitive FT-004 backend behavior through the
  real Medusa/PostgreSQL boundary before browser acceptance.
- Success outcome: Google/VK synthetic identities and customer links survive a fresh
  process, failures leave no partial customer/link/session, and provider/session/
  CORS/rate-limit/restart expectations have sanitized deterministic evidence.
- Anti-goals: no live providers, production secrets/data, production auth changes,
  in-memory substitution for persistence, or new auth behavior.
- Allowed write scope: the five task paths plus protocol/evidence artifacts.
- Forbidden scope: production auth behavior, storefront, live providers/credentials,
  production data, checkout, order, and payment.
- Stop conditions: real Auth/Customer PostgreSQL persistence cannot be exercised,
  evidence needs sensitive values, or a runtime defect requires production edits.

## Boundary Notes

- Linked contracts: auth runtime persistence/data ownership, auth/session security
  verification rules, and customer auth/session failure/retry lifecycle.
- Responsibility boundary: acceptance creates synthetic fixtures through supported
  Auth Module and customer workflows; production callback/provider code is read-only.
- Boundary drift risk: reporting in-memory doubles as persistence proof, leaking test
  identity/session details, or mutating core tables directly.

## Steps

1. Add `auth-acceptance` to the real integration dispatcher with isolated
   write/read/cleanup Medusa processes.
2. Create synthetic Google/VK Auth identities through the real Auth Module and run
   production completion logic against real Customer workflows/PostgreSQL.
3. Verify repeat login, collision/missing-email atomicity, fresh-process linkage, and
   cleanup without printing identifiers or customer data.
4. Run local provider/config/completion doubles behind a sanitized output boundary.
5. Run packet gates, evidence privacy scan, and record implementation handoff.

## Local Gates

- `npm --workspace apps/backend run test:integration -- auth-acceptance`
- `npm --workspace apps/backend run typecheck`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`

## Ownership

- GENERAL became the explicit standalone manual owner through the continued task run,
  completed `/verify TASK-033` and `/red-verify TASK-033`, and owns final lifecycle
  reconciliation through `/mb-sync`.
