# TASK-028 Adversarial Semantic Verification After Retry 1/2

SEMANTIC_VERDICT: semantic-pass

## Findings

- No actionable semantic findings.

## Hostile Hypotheses And Results

- False success at the VK wire boundary: rejected. Production code now uses the
  officially required `service_token` POST field, and the double fails if
  `client_secret` appears or the expected service token is absent.
- Superficial `device_id` pass-through: rejected. A mismatched value reaches the
  synthetic token boundary, is rejected as not bound to the code tuple, causes no
  user-info request or identity creation, and exposes no raw upstream response.
- Replay/expiry bypass: not found for the specified single-process runtime. State is
  opaque, short-lived, marked consumed before exchange, and guarded against
  concurrent claims by the singleton provider instance.
- PKCE/state substitution: not found. S256 verifier/challenge binding and returned
  state equality are checked before identity resolution.
- Identity drift or email-keying: not found. Provider identity is keyed by stable VK
  `user_id`; token/profile subjects must match, and email is validated metadata, not
  the entity key.
- Token or raw-data retention: not found. Provider tokens are callback-local and
  absent from state, identity metadata, logs, normal output, and evidence.
- Medusa boundary drift: not found. The implementation is one Medusa Auth Module
  Provider with ID `vkid`; it does not create a parallel auth/session/customer
  system or modify Medusa Core.
- Scope inflation: not found. Requested scope remains `email`, and customer/session,
  account collision/linking, UI, checkout, and payment remain in their assigned
  later slices.

## Purpose Fit And Anti-goals

- Purpose fit: satisfied. Start and callback can produce a validated Medusa provider
  identity through state, S256 PKCE, confidential server-side exchange, callback
  `device_id`, stable VK subject, and required email without retaining tokens.
- Anti-goals: respected. No live credentials, customer/session/UI/account-linking
  behavior, provider-token persistence, or parallel auth system was introduced.
- Scope/autonomy: respected. Retry implementation stayed in the authorized provider
  and test surfaces; this review changed only non-conflicting verification reports.

## Cross-boundary Assessment

- VK ID: corrected request matches the official confidential-app contract. The
  configured `.com` endpoints responded at the same public boundary as documented
  `.ru` endpoints during credential-free reachability checks; successful provider
  UAT remains intentionally deferred.
- Medusa 2.16: module/provider loading, identifier, interface methods, option shape,
  and singleton provider lifetime are compatible with installed runtime code.
- State/data: state is non-durable auth cache with a shorter internal expiry than
  Medusa's cache TTL. Durable identity receives only entity ID and minimal normalized
  user metadata.
- Operations/security: upstream and malformed failures collapse to one coarse error;
  requests have a ten-second timeout. Disable-provider, secret rotation, optional
  signing-secret rotation, and preservation of durable customer/cart data form a
  credible recovery path; no migration or destructive operation exists.
- Maintenance: the implementation remains one small provider and one synthetic
  contract script. The corrected double now guards the external field and device
  binding that previously allowed false confidence.

## How This Could Still Be Wrong

- No valid live VK authorization code or credential was used, so a successful real
  account flow is not claimed. Official documentation plus strict doubles are the
  approved automated boundary; live/staging UAT remains a human follow-up.
- Replay protection is intentionally process-local. A future multi-instance runtime
  would need a shared atomic consume primitive and is outside FT-004's current
  single-process architecture.
- Durable identity/customer linking, session establishment, and same-email collision
  behavior are assigned to later tasks and must not be inferred from this verdict.

## Scheduler Recommendation

- TASK-028 is closure-eligible: `/verify` is `PASS`, this per-task T3 verdict is
  `semantic-pass`, packet/spec/protocol gates pass, and the required T3 markers and
  credible recovery note are present.
- Scheduler may mark TASK-028 `done` and then evaluate TASK-029 promotion. This
  reviewer does not perform lifecycle, promotion, `/mb-sync`, or feature closure.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
