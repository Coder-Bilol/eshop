---
description: Feature FT-011 - Docker Compose local development.
status: draft
lifecycle: planned
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
- Run `/prd-to-tasks FT-011`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: local service boundaries, environment variables, non-secret config, local webhook strategy.
- Use standalone `/spec-improve FT-011` only for repair/refresh without creating or updating task records.
