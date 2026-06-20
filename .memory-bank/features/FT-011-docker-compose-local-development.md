---
description: Feature FT-011 - Docker Compose local development.
status: draft
lifecycle: planned
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-011-docker-compose-local-development.md
---
# FT-011 Docker Compose Local Development

## Use Cases

- Developer starts local storefront/backend/database stack.
- Developer runs local smoke checks against required services.
- Developer configures local integrations without production secrets.

## Acceptance Criteria

- Covers REQ-030.
- Docker Compose local path starts required storefront/backend/database services.
- Local setup supports later integration/e2e verification.

## Edge Cases & Failure Modes

- Required environment variables are missing.
- Ports conflict locally.
- ЮKassa/webhook local setup requires tunneling or mock mode.

## Test Strategy Pointers

- Smoke: Docker Compose starts required services.
- Integration readiness: local stack can support future API/e2e checks.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/testing/index.md](../testing/index.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md).
- Feature tech spec: [.memory-bank/tech-specs/FT-011-docker-compose-local-development.md](../tech-specs/FT-011-docker-compose-local-development.md).
- Run `/prd-to-tasks FT-011` for implementation planning, task records, and packet generation.
- Use standalone `/spec-improve FT-011` only for repair/refresh if the linked feature tech spec becomes stale, incomplete, or contradictory.
- `/prd-to-tasks` set `spec_design_status: complete` on 2026-06-20.

## Spec Design Notes

- Feature design depth: feature hub only.
- Local development is scoped to a non-production Docker Compose path for storefront, backend, and PostgreSQL.
- Database initialization and project scaffold tasks are explicit implementation tasks because FT-011 is the executable baseline for later feature work.
- Production deployment, live provider credentials, real payment mutations, and provider webhook correctness remain outside FT-011 and require later high-tier work.
