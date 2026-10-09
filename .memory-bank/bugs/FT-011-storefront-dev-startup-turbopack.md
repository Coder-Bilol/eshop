---
description: W1 semantic blocker for Windows-native storefront dev startup.
status: archived
owner: red-verify
last_updated: 2026-06-25
source_of_truth:
  - .memory-bank/features/FT-011-windows-native-local-development.md
  - .memory-bank/tech-specs/FT-011-windows-native-local-development.md
  - .protocols/FT-011/red-verification.md
---
# FT-011 Storefront Dev Startup Turbopack Failure

## Summary

Historical W1/FT-011 red-verification blocker: the documented/default Windows-native storefront startup path failed on this machine.

`npm --workspace apps/storefront run dev -- --hostname 127.0.0.1 --port 3010` exited with code `1` because Next.js tried Turbopack, could not use native bindings, and recommended `next dev --webpack`.

## Impact

Resolved. Recheck on 2026-06-25 showed the same default storefront dev path starts and returns HTTP 200.

## Evidence

- The FT-011 red-verification protocol records that the local environment check
  passed with `dockerRequired:false`, the local smoke reached typecheck, the
  default startup initially failed because of the Turbopack/native binding, and
  the recheck returned `GET / 200`.

## Resolution

Resolved by repairing the local Next.js native startup path. W1/FT-011 is no longer blocked. Optional future hardening: add a bounded startup smoke that starts the storefront dev server and checks HTTP 200.
