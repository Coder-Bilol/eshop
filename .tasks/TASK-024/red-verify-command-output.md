---
description: Fresh command output evidence for TASK-024 red verification.
status: complete
---
# TASK-024 Red Verify Command Output

Date: 2026-07-10

## Packet Hash Check

- Command: `node -e "const fs=require('fs'); const crypto=require('crypto'); const task=fs.readFileSync('.memory-bank/tasks/TASK-024.task.json'); const packet=JSON.parse(fs.readFileSync('.memory-bank/packets/TASK-024.packet.json','utf8')); const actual='sha256:'+crypto.createHash('sha256').update(task).digest('hex'); console.log(JSON.stringify({task_id:packet.task_id, packet_status:packet.status, packet_hash:packet.source_task_hash, actual_hash:actual, hash_match:packet.source_task_hash===actual}, null, 2));"`
- Result: PASS

```json
{
  "task_id": "TASK-024",
  "packet_status": "ready",
  "packet_hash": "sha256:2d8aecc9de31328d84dac99ca3cdaa13f8d859301183e381f206ac1831bf4836",
  "actual_hash": "sha256:2d8aecc9de31328d84dac99ca3cdaa13f8d859301183e381f206ac1831bf4836",
  "hash_match": true
}
```

After the red-verification task-record evidence entry was added, the packet
`source_task_hash` was refreshed and rechecked:

```json
{
  "packet_hash": "sha256:219a13f13027af6f718d0d5d19cc36ec26d1594f5aca376db6be9edbede007e6",
  "actual_hash": "sha256:219a13f13027af6f718d0d5d19cc36ec26d1594f5aca376db6be9edbede007e6",
  "hash_match": true
}
```

## Cart Merge Tests

- Command: `npm --workspace apps/storefront run test -- cart-merge`
- Result: PASS

```json
{
  "suite": "cart-merge",
  "status": "ok",
  "dataSource": "store-cart-merge-contract-shaped-fixtures",
  "assertions": [
    "post-auth merge sends credentials: include with an empty request body",
    "client never sends destination cart or customer identity",
    "validated merged, transferred, and already_merged responses adopt the backend-selected target reference",
    "conflict, forbidden, in-progress, stale, invalid-response, and server failures retain the source reference",
    "stale consumed-source recovery can happen only through authenticated merge replay",
    "cart provider exposes provider-agnostic post-auth handoff without OAuth provider logic"
  ]
}
```

Final runner summary: `{"command":"storefront:test","status":"ok","suites":["cart-merge"]}`.

## Storefront Typecheck

- Command: `npm --workspace apps/storefront run typecheck`
- Result: PASS

```text
> @eshop/storefront@0.1.0 typecheck
> tsc --noEmit
```

## Memory Bank Lint

- Command: `node scripts/mb-lint.mjs`
- Result: PASS

```text
mb-lint passed (106 files).
```

## Strict Memory Bank Doctor

- Command: `node scripts/mb-doctor.mjs --strict`
- Result: PASS

```text
mb-doctor PASS (0 errors, 2 warnings, 2 info)
WARNING TASK_PLANNED_READY_CANDIDATE TASK-024: planned task has all dependencies done and can be promoted to ready.
WARNING TASK_PLANNED_READY_CANDIDATE TASK-025: planned task has all dependencies done and can be promoted to ready.
```

Warnings are readiness/status-transition candidates, not semantic failures.

## Source Pattern Checks

- Implementation files did not contain provider-specific `Google`, `VK ID`,
  `OAuth`, `destinationCartId`, `customerId`, `authorization`, bearer, or token
  handling.
- `cart-merge.ts` writes only `result.merge.target_cart_id` after response
  validation; no client destination/customer selector was found.
