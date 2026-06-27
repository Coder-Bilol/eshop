---
description: Feature FT-011 - Windows native local development.
status: draft
lifecycle: verified
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-011-windows-native-local-development.md
---
# FT-011 Windows Native Local Development

## Use Cases

- Developer starts local storefront/backend processes on Windows 10.
- Developer uses a local Windows PostgreSQL service for backend persistence.
- Developer runs local smoke checks against required services.
- Developer configures local integrations without production secrets.

## Acceptance Criteria

- Covers REQ-030.
- Windows 10 native local path starts or verifies required storefront/backend/PostgreSQL services without Docker containers.
- Local setup supports later integration/e2e verification.

## Edge Cases & Failure Modes

- Node.js/npm is missing or an unsupported version is installed.
- Local PostgreSQL is missing, stopped, or not reachable at the configured connection URL.
- Required environment variables are missing.
- Ports conflict locally.
- ЮKassa/webhook local setup requires tunneling or mock mode.

## Test Strategy Pointers

- Smoke: Windows-native local scripts verify PostgreSQL, backend, and storefront readiness.
- Integration readiness: Windows-native local runtime can support future API/e2e checks.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/testing/index.md](../testing/index.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md).
- Feature tech spec: [.memory-bank/tech-specs/FT-011-windows-native-local-development.md](../tech-specs/FT-011-windows-native-local-development.md).
- Run `/prd-to-tasks FT-011` for implementation planning, task records, and packet generation.
- Use standalone `/spec-improve FT-011` only for repair/refresh if the linked feature tech spec becomes stale, incomplete, or contradictory.
- `/prd-to-tasks` set `spec_design_status: complete` on 2026-06-20.

## Spec Design Notes

- Feature design depth: feature hub only.
- Local development is scoped to a non-production Windows 10 native path for storefront, backend, and local PostgreSQL.
- Database initialization and project scaffold tasks are explicit implementation tasks because FT-011 is the executable baseline for later feature work.
- Production deployment, live provider credentials, real payment mutations, and provider webhook correctness remain outside FT-011 and require later high-tier work.

## W1 Closure

- W1 tasks `TASK-001` through `TASK-004` are verified and closed.
- W1 red-verification was rechecked on 2026-06-25 after the storefront native Next.js startup issue was repaired; the storefront default `next dev` path returned HTTP 200 without Docker.
