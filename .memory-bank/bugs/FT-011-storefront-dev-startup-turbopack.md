---
description: W1 semantic blocker for Windows-native storefront dev startup.
status: archived
owner: red-verify
last_updated: 2026-06-25
source_of_truth:
  - .memory-bank/features/FT-011-windows-native-local-development.md
  - .memory-bank/tech-specs/FT-011-windows-native-local-development.md
  - .tasks/FT-011/red-verify-w1-storefront-default-next-dev-2026-06-25.log
  - .protocols/FT-011/red-verification.md
---
# FT-011 Storefront Dev Startup Turbopack Failure

## Summary

Historical W1/FT-011 red-verification blocker: the documented/default Windows-native storefront startup path failed on this machine.

`npm --workspace apps/storefront run dev -- --hostname 127.0.0.1 --port 3010` exited with code `1` because Next.js tried Turbopack, could not use native bindings, and recommended `next dev --webpack`.

## Impact

Resolved. Recheck on 2026-06-25 showed the same default storefront dev path starts and returns HTTP 200.

## Evidence

- `.tasks/FT-011/red-verify-w1-check-local-env-2026-06-25.txt`: local env check passed with `dockerRequired:false`.
- `.tasks/FT-011/red-verify-w1-smoke-local-2026-06-25.txt`: local smoke passed, but storefront readiness is only typecheck.
- `.tasks/FT-011/red-verify-w1-storefront-default-next-dev-2026-06-25.log`: storefront default dev startup failed with Turbopack/native binding error.
- `.tasks/FT-011/recheck-storefront-default-dev-2026-06-25.log`: storefront default dev startup recheck passed and returned `GET / 200`.

## Resolution

Resolved by repairing the local Next.js native startup path. W1/FT-011 is no longer blocked. Optional future hardening: add a bounded startup smoke that starts the storefront dev server and checks HTTP 200.
