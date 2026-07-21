# TASK-030 Adversarial Semantic Verification

SEMANTIC_VERDICT: semantic-fail

## Top Substance Risks

- HIGH identity/state inconsistency: a successful server logout can be overwritten
  by a stale current-customer success and leave the UI authenticated against a
  destroyed session.
- HIGH concurrency failure: duplicate logout can restore `logging_out` with the old
  customer after another DELETE has already succeeded and cleared local state.
- MEDIUM shared-browser leakage: a local cart cleanup error after server logout
  leaves the old reference/state while auth transitions to guest.
- MEDIUM redirect/consume hardening gaps: provider destinations are scheme-checked,
  not origin-allowlisted, and a return path is returned even when consumption could
  not delete its envelope.

## Purpose Fit And Anti-goals

- Purpose fit is incomplete. Serial request behavior is deterministic, token-free,
  and session-backed, but the public state boundary is not deterministic under
  realistic overlapping calls. Its state can contradict the backend session truth.
- No callback backend logic, login/checkout page markup, cart merge semantic change,
  JWT/provider-token persistence, order/payment work, or Medusa Core change was
  attributed to TASK-030.
- Runtime allowed scope was respected. Verification artifacts are the only Reviewer
  writes, and scheduler lifecycle ownership remains unchanged.

## False-success Assessment

- Existing tests accurately prove `credentials: include`, provider ID rejection,
  serial `401 -> guest`, serial logout ordering/failure retention, strict normal
  return-path parsing, and no token persistence.
- The stale-response assertion is too narrow: it tests a GET started before logout,
  for which `operationSequence` works. It does not test a GET started while logout
  is pending or duplicate logout, which produce the opposite result.
- Full tests, typecheck, build, lint, and doctor therefore create false confidence
  for the central deterministic-session claim; all are green while the independent
  interleaving probes fail.

## Cross-boundary Assessment

- Auth/session boundary: FAIL. `logging_out -> guest` is not terminal after backend
  deletion, and browser state can claim a customer after session destruction.
- Cart boundary: serial ordering uses `clearLocalReference()` only after backend
  success, as required. Error handling is unsafe because that boundary can throw
  before clearing cart storage/in-memory state while auth still becomes guest.
- Redirect boundary: tested raw schemes, `//`, backslashes, controls, and encoded
  separators did not escape the storefront origin. Provider location validation,
  however, accepts any HTTP(S) origin rather than an allowlisted provider origin.
- Storage/privacy: no auth token persistence was found. The return-path envelope is
  minimal and versioned, but failed deletion breaks one-time consumption.
- Architecture/scope: no parallel identity/session store or unsupported boundary
  was introduced. The controller remains small, but one sequence counter is not a
  sufficient concurrency model for operations with destructive precedence.
- Operations/recovery: the implementation handoff's rollback/recovery note is
  credible and no migration/durable data mutation belongs to TASK-030. Disabling
  providers or removing the provider mount stops exposure, while durable
  Auth/Customer/cart records remain preserved.
- Maintenance: narrow serial tests will allow future UI tasks to build checkout and
  login behavior on an auth state that can deadlock or contradict the backend.

## Hidden Assumptions And How This Could Still Be Wrong

- The implementation assumes callers will not invoke restore/logout concurrently or
  double-submit logout. That assumption is absent from the public controller and
  linked state contract and is unsafe for React UI/network retries.
- The provider destination concern depends on whether the storefront must enforce
  the architecture's allowlisted-location statement or may fully trust Medusa's
  same-origin start response. The current task evidence overclaims this either way.
- Browser storage removal normally succeeds, but privacy controls, extensions, and
  storage exceptions are explicitly handled by this code, so the failure branch is
  part of the implementation contract rather than an unreachable condition.
- No real browser auth flow exists yet; TASK-034 may reveal more navigation and
  shared-browser failures, but later E2E ownership does not make these controller
  defects acceptable.

## Failure / Blocker

- Status: failed
- Where: `apps/storefront/lib/auth-state.ts:97-139`,
  `apps/storefront/lib/auth.ts:193-225,256-264`, and focused auth tests.
- Expected: successful logout dominates stale customer reads and duplicate calls,
  leaves guest state, and removes prior-customer browser references; provider start
  and return-path consumption satisfy their linked security contracts.
- Observed: late GET restores customer after DELETE, duplicate logout leaves
  `logging_out`, cart cleanup failure leaves a reference, arbitrary HTTPS provider
  destination is accepted, and failed envelope removal permits repeated consume.
- Likely category: code|verification
- Recommended next action: correct operation precedence and cleanup behavior, align
  provider-location enforcement/evidence with the authoritative design, add the
  adversarial interleavings, and rerun both verification stages.
- Requires replan: no

## Scheduler Recommendation

- Do not close TASK-030 and do not promote its dependents.
- Recommend `status: failed` pending a bounded correction and repeat independent
  `/verify` plus `/red-verify`.
- Do not run `/mb-sync` from this Reviewer session.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
