---
description: FT-003 cart access, ownership, credential, privacy, and safety contract.
status: active
owner: spec-improve
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/constitution.md
  - .memory-bank/invariants.md
  - .memory-bank/contracts/api-guidelines.md
---
# Cart Access And Security Contract

## Credential Classes

- `x-publishable-api-key` scopes Store API access to configured sales channels;
  it is public configuration, not customer authentication.
- Medusa session cookie or bearer token supplies authenticated `customer` actor
  context for merge.
- Browser cart ID is an opaque cart reference. It is not customer identity and
  must be treated as untrusted input at every backend boundary.
- OAuth credentials, JWT signing secrets, cookie secrets, and provider tokens
  never enter cart payloads, local storage, logs, merge journal, or evidence.

## Access Matrix

| Action | Guest | Authenticated customer | Guard |
|---|---|---|---|
| Create/retrieve/mutate guest cart | allowed through Medusa Store API | allowed for current cart | Publishable-key scope and Medusa validation. |
| Merge guest source | denied | allowed | Auth actor required; source guest or actor-owned. |
| Choose destination/customer | denied | denied | Backend resolves from actor context. |
| Merge foreign customer cart | denied | denied | `403`, no existence/data disclosure. |
| Retrieve/mutate consumed source | not found | not found | Source is Cart Module soft-deleted after existing-target merge. |
| Read merge journal directly | denied | denied | Internal module/workflow only. |

## Ownership Guards

- Merge source with non-null `customer_id` is allowed only when it equals the
  authenticated actor ID.
- Destination candidates are queried by authenticated actor ID, never by a
  client-supplied customer or cart ID.
- Completed carts cannot be source or destination.
- Source and destination must share region, currency, and sales channel.
- Recorded journal customer must equal the current actor on replay.
- Completed replay is journal-first because the consumed source cart no longer
  resolves through ordinary Store cart queries.
- Merge locks and journal uniqueness must prevent cross-request quantity races.

## Browser Safety

- Use the versioned local-storage key only for the cart reference.
- Never persist auth tokens through the cart adapter.
- Clear malformed/stale references; do not trust cached cart snapshots.
- A consumed source reference is treated as stale by ordinary cart CRUD. Only
  an authenticated merge replay may resolve it to the recorded target.
- Do not render raw backend error details that may identify foreign resources.
- Session-cookie requests use configured CORS, credentials, secure production
  cookie policy, and CSRF protections supplied by the chosen Medusa auth mode.
  FT-004 owns final auth-mode integration.

## Logging And Evidence

- Logs may contain operation ID, outcome, HTTP status, and redacted cart ID
  suffixes when needed.
- Logs/evidence must not contain full session cookies, bearer tokens, secrets,
  customer email/contact data, or live production cart payloads.
- Local integration fixtures use synthetic customers, carts, and variants.

## Safety Rules

- No silent quantity truncation.
- No merge on ambiguous/foreign ownership.
- No partial success response.
- Soft-delete the source only after target mutations succeed; restore it during
  compensation if journal completion or a later workflow step fails.
- Never hard-delete or clear the source cart as part of merge success.
- No direct mutation of Medusa core tables outside supported modules/workflows.
- No destructive production data operation in FT-003.
- T3 implementation/verification applies to the authenticated merge boundary and
  requires the tier-policy human/recovery markers before closure.
