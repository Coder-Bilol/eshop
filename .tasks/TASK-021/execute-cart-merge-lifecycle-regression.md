---
description: TASK-021 regression evidence for TASK-020 lifecycle.
status: complete
---
# TASK-021 Lifecycle Regression Evidence

## Command

```powershell
npm --workspace apps/backend run test:integration -- cart-merge-lifecycle
```

## Result

PASS

## Purpose

TASK-021 calls the TASK-020 lifecycle workflow through a new HTTP boundary.
This regression confirms the existing lifecycle behavior still passes after
adding the route and API smoke.

