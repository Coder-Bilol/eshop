---
description: Operational decision log for FT-011 task decomposition.
status: active
---
# FT-011 Decision Log

## 2026-06-20
- Scope: local development foundation only; production deployment and live provider secrets are out of scope.
- Design depth: feature hub tech spec is required because local runtime spans storefront, backend, PostgreSQL, env configuration, and smoke verification.
- Tier decision: generated implementation tasks are T2 because they cross modules and include local runtime/persistence; production deploy, live secrets, destructive data, auth, and payments remain T3 stop conditions.
- User-specific requirement: create an explicit task for database initialization and project scaffold files.

## 2026-06-23
- User decision: local development must run natively on Windows 10, not in Docker containers.
- Docker boundary: Docker may be used later only for remote server deployment; it is out of scope for FT-011 local foundation tasks.
- Task impact: `TASK-003` and `TASK-004` must use Windows-native npm/local PostgreSQL gates instead of `docker compose` gates.
