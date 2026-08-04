---
description: Active TASK-034 generated browser evidence sanitization failure.
status: active
owner: verify
last_updated: 2026-08-04
source_of_truth:
  - .memory-bank/tasks/TASK-034.task.json
  - .protocols/TASK-034/verification.md
---
# TASK-034 Evidence Sanitization Gap

## Summary

The real-browser harness pipes Medusa request logs directly into the task evidence
directory. The failed run persisted raw OAuth state values, a callback code, and full
cart IDs, contrary to the linked auth/cart logging and evidence contracts.

## Impact

- TASK-034 artifact privacy acceptance fails even though the values are synthetic.
- A future successful run could still produce contract-violating evidence unless
  sanitization occurs before persistence.
- The unsafe generated log from this verification was deleted after a count-only
  scan; no live credentials or production data were used.

## Evidence

- `.protocols/TASK-034/verification.md`
- `.tasks/TASK-034/verify-functional-gates-code-01.md`

## Required Resolution

- Redact callback query values and full cart/customer/session identifiers before
  writing backend runtime logs under `.tasks/TASK-034/`.
- Scan text, screenshots, traces, reports, browser storage, console, and network
  artifacts without printing matched sensitive values.
- Repeat the complete browser acceptance and require a clean artifact scan before
  functional PASS.
