---
description: Planning protocol for FT-004 feature design and task decomposition.
status: complete
---
# FT-004 Planning Protocol

## Goal

Complete feature-level SDD for Google/VK ID customer authentication, Medusa
session ownership, post-auth cart handoff, and checkout authentication gating,
then create an implementation plan, schema-backed tasks, and required packets.

## Done Criteria

- Existing Medusa Auth/Customer and FT-003 boundaries are reused.
- Google, VK ID, callback, session, account collision, redirect, logout, privacy,
  abuse-control, cart handoff, and checkout-gate decisions are concrete.
- REQ-010 through REQ-012 are covered by bounded T3 task slices.
- PostgreSQL Auth/Customer persistence and browser acceptance have distinct tasks.
- Every task has a canonical ready or ready-with-gaps Execution Packet.
- Memory Bank lint and strict doctor pass before execution handoff.

## Quality Gates

- `node scripts/mb-lint.mjs`
- schema/index/task/packet consistency
- required packet hash verification
- strict `/mb-doctor` before `/execute`

## Scope Notes

- Use Medusa v2.16 built-in Google provider and one custom VK ID provider.
- Use signed `HttpOnly` Medusa sessions; no browser-persisted auth token.
- Reject automatic cross-provider email linking.
- Live provider credentials are a human UAT input, not an automated-test input.
