# TASK-MB-REVIEW Remediation Report

- Role: GENERAL
- Date: 2026-08-21
- Trigger: final scheduler review S-01/S-02 `REJECT`
- Scope: bounded durable-document remediation; no task status or production
  implementation change

## S-01 Architecture Remediation

1. Aligned `system-architecture.md` and `testing/index.md` with tier policy:
   T2 task `/verify PASS`, T2 feature `semantic-pass`, and T3 per-task
   `semantic-pass` plus checkpoint/recovery.
2. Defined one expiry mapping: global/native order state is `canceled`, while
   FT-007 `checkout_state: expired` is the timeout reason projection used for
   audit and retry guards.
3. Distinguished PostgreSQL as the only durable structured/database store from
   deployment-owned persistent media as the durable blob store; `DEPLOYMENT.md`
   now treats database dumps and media archives as one recovery set.
4. Reconciled the global backbone and architecture after verified FT-007:
   pending-order status, reservation, expiry/release, and idempotency ownership
   are resolved; FT-008/FT-009 retain only finalization/Admin projection work.
5. Made `ADR-000` explicitly non-normative and recorded the KISS policy that
   authoritative SDD specs are accepted decision records; separate ADRs are
   optional for cross-spec rationale/supersession.
6. Added missing FT-007 entries to architecture, contract, domain, state, and
   tech-spec folder routers.

## S-02 Scope And RTM Remediation

1. Removed the unsupported Telegram identity-label delta from the PRD, RTM,
   EP-002/FT-004, and linked auth SDD specs instead of inventing an owner/user
   decision. Functional requirements were compacted back to the traceable
   FR-001..FR-030 sequence.
2. FT-004 and EP-002 now claim only verified REQ-010..REQ-012 and
   REQ-006..REQ-012 scope respectively.
3. Synchronized REQ-030 and sole-feature EP-005 to `verified` from FT-011 and
   TASK-001..TASK-004 semantic evidence.
4. Updated the Analysis router to the current completed framing/backbone and
   remaining FT-008..FT-010 route.

## S-03 Hygiene Remediation

- Added `IMPL-FT-007.md` to the implementation-plan router.
- Added completed follow-up TASK-043 to `IMPL-FT-004.md` with closure evidence.

## Deterministic Gates

- `node scripts/mb-lint.mjs`: PASS, 138 files.
- `node scripts/mb-doctor.mjs --strict --json`: PASS, 0 errors, 0 warnings;
  53 total tasks and 53 `done`.
- `git diff --check`: PASS; line-ending warnings only.
- Stale semantic-pattern scan: no old T2/T3, PostgreSQL-only, FT-007-open,
  REQ-031/FR-031, or Telegram requirement wording remains in active Memory Bank
  documents.

## Decision

Remediation is ready for repeated fresh-context S-01 and S-02 review. Historical
`REJECT` reports remain unchanged as audit evidence.

## Repeated S-01 Follow-up

The first repeated S-01 confirmed all six original findings resolved but found
one additional policy contradiction. `system-architecture.md` no longer permits
a task record to downgrade mandatory T3 work: auth/security, payment/webhook,
deploy/runtime/production, destructive/data-loss-risk, and compliance work is
mandatory T3; order/inventory/API/state/data is at least T2 and escalates on any
critical dimension. The two non-blocking pre-design hint files were also updated
to distinguish resolved FT-007 choices from open FT-008/FT-009 work.

## S-02 Low Hygiene Follow-up

- The Analysis evidence footer now distinguishes historical 2026-06-18
  observations from current BR-002, feature lifecycle, app, and queue state.
- FT-007 now says its pending order remains eligible for FT-009 payment retry;
  it no longer implies FT-007 owns provider retry behavior.

## S-04 External Security Blocker

The repeated security review found the last verified public VPS policy still
permits password authentication for `root`. The operator explicitly requires
that setting to remain enabled, and the VPS provider currently blocks server
access while resolving provider-side errors. The authoritative runbook and
process/handoff docs now forbid SSH hardening and record this as an external
production-security blocker. No live SSH mutation or re-verification is possible
from this workspace.

## Repeated S-01 Local-runtime Tier Clarification

The next S-01 pass found that the word `runtime` was still broad enough to make
historical FT-011/TASK-003 T2 routing contradict policy. The owner-level policy
is now explicit: remote/shared deployment and staging/production runtime impact
is mandatory T3; safe non-production local-development process scripts,
environment templates, and disposable runtime tooling route T1/T2 by blast
radius and cross-module/data scope. FT-011 is synchronized to that distinction;
task records still cannot waive a mandatory T3 dimension.

## S-05 Task-generation Route Synchronization

The active `/prd-to-tasks` command now applies the same owner-level split as
tier policy: remote/shared deploy and staging/production runtime impact is T3;
safe local-only non-production runtime/tooling is T1/T2 by blast radius and
cross-module/data scope. No historical task tier, packet, status, or closure
evidence changed.
