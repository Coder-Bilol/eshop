# TASK-029 Progress

- Retry 2/2 preflight complete: task, R5 packet, linked specs, latest Reviewer
  code-02 FAIL reports, supported Medusa extension points, and dependencies read.
- Added completion through Auth/Customer Modules and
  `createCustomerAccountWorkflow`; no core table is accessed directly.
- Added provider allowlisting, provider-state replay claims, serialized
  email/customer resolution, no-email-link collision behavior, server-side session
  regeneration/save, and fixed sanitized redirects.
- Added bounded start/completion counters, replay claims, and resolution locks. All
  retained keys are salted HMAC digests; capacity exhaustion fails closed.
- Added synthetic integration coverage for first/repeat/concurrent completion,
  cross-provider collision, missing email, rate/replay bounds, redirect cleanup,
  session persistence/failure cleanup, and token non-transfer.
- Added first-login session-failure compensation through Medusa's supported
  `removeCustomerAccountWorkflow`; existing-account session failures never delete
  durable actors.
- Restored no-argument integration dispatch across auth-completion, auth-vkid, and
  every legacy suite so an empty selection cannot exit successfully.
- Extended provider-identity lock ownership through identity reads, customer
  resolve/create, session save, and any first-login compensation while retaining
  the email lock required for cross-provider collision safety.
- Post-create identity-read errors now compensate the newly created customer/link
  before releasing ownership; existing-customer failures still preserve the actor.
- Added adversarial regression cases proving a failed callback cannot delete the
  successful concurrent callback's actor/link and post-create read failure leaves
  no new customer/link/session.
- Focused auth-completion, auth-vkid regression, no-argument full integration,
  backend typecheck, Memory Bank lint, and diff checks pass. The first no-argument
  attempt was terminated by the tool runner without test output; no child remained,
  and the retry completed every auth and legacy suite successfully.
- Exact runtime write scope respected; forbidden scope and unrelated dirty changes
  untouched.

## Implementation Notes

- The create and compensation paths use Medusa-supported workflows. A session-store
  failure destroys the ephemeral session and compensates only a customer/link newly
  created by that completion attempt.
- Automated evidence uses only synthetic provider/module doubles. Real
  Medusa/PostgreSQL acceptance remains the already-planned TASK-033 boundary and was
  not pulled into this W2 implementation task.
- No raw provider failure, code, state, device ID, token, session ID, email, raw IP,
  customer object, or live credential is printed by the gate.
