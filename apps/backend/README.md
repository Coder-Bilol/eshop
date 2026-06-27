# Eshop Backend

Medusa v2 backend baseline for the MVP internet shop.

## Local database path

The backend owns the local PostgreSQL initialization scripts used by the FT-011
foundation. Copy `.env.example` to `.env` for local overrides, or use the
default local PostgreSQL URL:

```bash
npm --workspace apps/backend run db:check
npm --workspace apps/backend run db:migrate
npm --workspace apps/backend run db:seed
npm --workspace apps/backend run smoke:db
```

`db:check` verifies that the configured Windows-native PostgreSQL service is
reachable and reports whether the target database already exists. The migration
creates only scaffold smoke tables. The seed data is local, non-production data
for verification. Windows-native startup and smoke scripts are owned by later
FT-011 tasks. Docker is reserved for a future remote server deployment path, not
local development.
