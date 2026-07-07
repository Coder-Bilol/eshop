---
description: TASK-021 cart merge API integration evidence.
status: complete
---
# TASK-021 Cart Merge API Integration Evidence

## Command

```powershell
npm --workspace apps/backend run test:integration -- cart-merge-api
```

## Result

PASS

## Output Summary

```json
{
  "suite": "cart-merge-api",
  "status": "ok",
  "sourceBoundary": "medusa-route-workflow-module-postgresql",
  "assertions": {
    "middlewareRegistered": true,
    "authRequired": true,
    "emptyBodyOnly": true,
    "transferOutcome": true,
    "foreignSourceDenied": true,
    "existingTargetMerged": true,
    "journalFirstReplay": true,
    "replayDoesNotDuplicate": true,
    "replayForeignCustomerDenied": true,
    "pendingJournalReturnsInProgress": true,
    "stockConflictStable": true
  }
}
```

## Coverage

- Customer auth middleware is registered for the merge endpoint.
- Unauthenticated requests return `401` with stable
  `cart_merge_auth_required`.
- Non-empty request bodies are rejected with stable
  `cart_merge_invalid_request`.
- No-target source cart transfer returns `transferred`.
- Existing target cart merge returns `merged`.
- Replaying a completed source merge returns `already_merged` without
  duplicating target quantity.
- Completed replay validates journal customer ownership before target retrieval.
- Foreign source carts are denied.
- Pending journal returns `cart_merge_in_progress`.
- Stock conflict returns `cart_merge_stock_conflict` and keeps carts unchanged.

