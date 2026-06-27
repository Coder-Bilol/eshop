---
description: Epic EP-005 - local development foundation.
status: draft
lifecycle: planned
---
# EP-005 Local Development Foundation

## Value

Give the development team a reproducible Windows 10 native local development path for storefront, backend, and database.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/testing/index.md](../testing/index.md)

## Features

- [FT-011 Windows Native Local Development](../features/FT-011-windows-native-local-development.md)

## Success Metrics

- Local storefront/backend processes and local PostgreSQL can be started or verified on Windows 10 without Docker containers.
- Required services are documented and smoke-testable.

## Acceptance Criteria

- Covers REQ-030.
- Local development path supports later integration/e2e verification.

## Constraints / Invariants

- Keep setup KISS and low-maintenance.
