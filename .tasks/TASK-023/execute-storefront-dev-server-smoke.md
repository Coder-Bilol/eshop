---
description: Storefront dev server smoke evidence for TASK-023.
status: complete
---
# TASK-023 Storefront Dev Server Smoke

- Command: `npm --workspace apps/storefront run dev -- --port 3000`
- Result: PASS
- URL: `http://localhost:3000`
- Smoke: `GET http://localhost:3000/cart`
- HTTP status: `200`

Notes:

- First request needed a longer timeout while Next/Turbopack compiled the route.
- Dev server stderr contains a slow-filesystem warning, not a route failure.
- Logs:
  - `.tasks/TASK-023/storefront-dev-server-3000.out.log`
  - `.tasks/TASK-023/storefront-dev-server-3000.err.log`

