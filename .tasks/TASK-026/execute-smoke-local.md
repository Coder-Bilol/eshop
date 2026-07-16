---
description: TASK-026 Windows-native local runtime smoke evidence.
status: complete
---
# TASK-026 Local Runtime Smoke

COMMAND: `npm run smoke:local`

EXIT_CODE: 0

RESULT: PASS

- Local environment check passed on Windows-native runtime.
- Local PostgreSQL availability and database smoke passed.
- Backend migration and local seed passed.
- Backend and storefront typechecks passed.
- No Docker, production data, live OAuth provider, or production secret was used.
