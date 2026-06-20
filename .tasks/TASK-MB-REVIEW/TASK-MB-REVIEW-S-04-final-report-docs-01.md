# TASK-MB-REVIEW S-04 Final Report

Task: TASK-MB-REVIEW
Stage: S-04
Reviewer: Security
Artifact type: docs

## Verdict

VERDICT: APPROVE

Approval scope: proceed to mandatory `/spec-design` only.

This is not approval for `/prd-to-tasks`, `/execute`, `/autopilot`, production setup, live payment mutation, or secret handling. Those remain blocked until security design is made authoritative and linked into feature/task records.

## Scope Reviewed

- `.memory-bank/constitution.md`
- `.memory-bank/prd.md`
- `.memory-bank/requirements.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/invariants.md`
- `.memory-bank/contracts/boundary-map.md`
- `.memory-bank/states/lifecycle-map.md`
- `.memory-bank/domains/core-domain.md`
- `.memory-bank/features/FT-004-oauth-login-before-payment.md`
- `.memory-bank/features/FT-009-yookassa-payment-webhook-return.md`
- `.memory-bank/features/FT-011-docker-compose-local-development.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/index.json`
- `.memory-bank/architecture/` inventory
- `.memory-bank/runbooks/` inventory

## Blocking Constitution Contradictions

None found for the current pre-design state.

The Constitution requires high-tier handling for payments, auth, order state, stock reservation, production/deploy, destructive data operations, and compliance-sensitive work (`.memory-bank/constitution.md:37`, `.memory-bank/constitution.md:39`). It also requires human checkpoints for T3/secrets/production/payment-compliance ambiguity (`.memory-bank/constitution.md:41`, `.memory-bank/constitution.md:43`) and treats security/privacy, no data loss, and payment correctness as non-negotiable (`.memory-bank/constitution.md:45`, `.memory-bank/constitution.md:47`).

The current Memory Bank does not contradict that policy because:

- PRD explicitly treats payment/auth/security work as high-tier and non-negotiable (`.memory-bank/prd.md:122`, `.memory-bank/prd.md:123`, `.memory-bank/prd.md:223`).
- Invariants route auth, payments, order lifecycle, stock reservation, production/deploy, destructive operations, and compliance-sensitive tasks through high-tier policy (`.memory-bank/invariants.md:21`).
- Tier policy classifies auth, permissions, secrets, security-sensitive behavior, deploy/runtime, production, data loss, payments, compliance, and destructive operations as T3 (`.memory-bank/workflows/tier-policy.md:119`, `.memory-bank/workflows/tier-policy.md:121`, `.memory-bank/workflows/tier-policy.md:137`).
- Feature docs keep auth/payment/local-runtime work behind `/spec-design` and `/spec-improve` gates (`.memory-bank/features/FT-004-oauth-login-before-payment.md:42`, `.memory-bank/features/FT-004-oauth-login-before-payment.md:48`, `.memory-bank/features/FT-009-yookassa-payment-webhook-return.md:48`, `.memory-bank/features/FT-009-yookassa-payment-webhook-return.md:54`, `.memory-bank/features/FT-011-docker-compose-local-development.md:36`, `.memory-bank/features/FT-011-docker-compose-local-development.md:41`).
- Task queue is empty, so no high-risk task is ready for execution before security design (`.memory-bank/tasks/index.json:2`, `.memory-bank/tasks/index.json:3`).

## Security Risks To Resolve In Design

### S04-RISK-001: Security backbone is intentionally blocked

`.memory-bank/spec-backbone.md` still marks architecture, source of truth, data flow, storage, API contracts, event/message contracts, security/safety, testing strategy, and deployment as blocked or pending for `/spec-design` (`.memory-bank/spec-backbone.md:30`, `.memory-bank/spec-backbone.md:31`, `.memory-bank/spec-backbone.md:37`, `.memory-bank/spec-backbone.md:38`, `.memory-bank/spec-backbone.md:39`, `.memory-bank/spec-backbone.md:40`, `.memory-bank/spec-backbone.md:42`, `.memory-bank/spec-backbone.md:43`, `.memory-bank/spec-backbone.md:44`, `.memory-bank/spec-backbone.md:56`, `.memory-bank/spec-backbone.md:60`).

Impact: security approval cannot extend beyond the next design step. `/spec-design` must produce authoritative security decisions before feature decomposition or implementation.

Required design output:

- Auth/session boundary and trust model.
- Public/admin/API boundary and data-flow model.
- Payment webhook verification and replay/idempotency model.
- Secrets and environment configuration model.
- PII/admin visibility and retention/access model.
- Security test targets linked from feature/task records.

### S04-RISK-002: OAuth and session security are not specified yet

Requirements include Google OAuth, VK ID, and an authenticated payment gate (`.memory-bank/requirements.md:27`, `.memory-bank/requirements.md:28`, `.memory-bank/requirements.md:29`; `.memory-bank/prd.md:82`, `.memory-bank/prd.md:83`, `.memory-bank/prd.md:84`). FT-004 correctly names auth boundary, identity ownership, privacy/security, callback/config setup, and T3 risk as design focus (`.memory-bank/features/FT-004-oauth-login-before-payment.md:46`, `.memory-bank/features/FT-004-oauth-login-before-payment.md:47`).

Required design decisions:

- OAuth callback allowlist, redirect validation, state/nonce/PKCE expectations where applicable.
- Session/cookie properties, CSRF posture, logout/session invalidation behavior.
- Account linking rules for Google/VK identities and cart merge ownership.
- Abuse controls for login/callback endpoints, including error handling that does not leak sensitive state.

### S04-RISK-003: Webhook security and payment-event trust are not specified yet

Requirements and invariants correctly state that the payment webhook is authoritative and duplicate events must be idempotent (`.memory-bank/requirements.md:41`, `.memory-bank/requirements.md:42`, `.memory-bank/invariants.md:16`, `.memory-bank/invariants.md:17`). PRD also prevents return-page authority (`.memory-bank/prd.md:102`, `.memory-bank/prd.md:103`, `.memory-bank/prd.md:104`). FT-009 captures missing local/staging credentials and webhook URL setup (`.memory-bank/features/FT-009-yookassa-payment-webhook-return.md:29`) and identifies source-of-truth, idempotency, status mapping, webhook setup, compliance risk, and T3 classification (`.memory-bank/features/FT-009-yookassa-payment-webhook-return.md:52`, `.memory-bank/features/FT-009-yookassa-payment-webhook-return.md:53`).

Required design decisions:

- Provider event authentication/signature validation and secret source.
- Replay handling, event ID persistence, deduplication window, retry behavior, and raw-event storage policy.
- Status transition guardrails for conflicting or out-of-order events.
- Logging policy that preserves investigation evidence without exposing secrets or unnecessary PII.

### S04-RISK-004: PII/privacy and admin visibility controls are not specified yet

Checkout collects name, email, phone, city, address, and comment (`.memory-bank/requirements.md:30`; `.memory-bank/prd.md:88`). Medusa Admin must show contacts, products, delivery data, payment status, order status, total amount, and payment method (`.memory-bank/requirements.md:45`; `.memory-bank/prd.md:109`). Constitution makes personal data, carts, orders, payment webhooks, and status transitions non-negotiable security/privacy areas (`.memory-bank/constitution.md:47`).

Required design decisions:

- Data minimization for checkout/comment fields.
- Admin role/permission assumptions and access boundaries.
- Audit/logging expectations for operator access and status changes.
- Email content rules to avoid unnecessary PII exposure.
- Retention/deletion stance for carts, orders, webhook events, and notification logs.

### S04-RISK-005: Secrets/runbooks/OWASP controls are not yet authoritative

Operational open questions include YooKassa credentials, webhook URLs/tunneling, email provider/configuration, and fiscalization obligations (`.memory-bank/spec-backbone.md:21`, `.memory-bank/spec-backbone.md:22`, `.memory-bank/spec-backbone.md:25`; `.memory-bank/prd.md:180`, `.memory-bank/prd.md:182`, `.memory-bank/prd.md:183`, `.memory-bank/prd.md:184`, `.memory-bank/prd.md:185`). Boundary map stops on unclear payment/compliance, source-of-truth conflict, secret/prod/deploy ambiguity, or design requiring Constitution change (`.memory-bank/contracts/boundary-map.md:30`). Testing forbids production secrets, production writes, or live payment mutation as local proof (`.memory-bank/testing/index.md:50`).

Inventory result: `.memory-bank/architecture/` and `.memory-bank/runbooks/` currently exist but have no files. No authoritative OWASP-oriented checklist/runbook was found.

Required design/runbook decisions:

- Secret inventory: OAuth client secrets, webhook/payment secrets, email provider credentials, Medusa/admin secrets, database credentials.
- Local/staging/prod separation and safe webhook tunneling rules.
- Secret rotation and credential-compromise response.
- Minimum OWASP controls for this stack: input validation, output escaping/XSS posture, CSRF posture, CORS policy, open redirect prevention, auth/session hardening, rate limiting/abuse handling, secure headers, dependency and image hygiene.
- Incident/runbook notes for webhook compromise, OAuth credential leak, email provider leak, and admin account compromise.

## Positive Findings

- Payment source-of-truth and return-page anti-cheat are consistently represented in PRD, requirements, invariants, lifecycle hints, and testing (`.memory-bank/prd.md:102`, `.memory-bank/prd.md:104`, `.memory-bank/requirements.md:41`, `.memory-bank/requirements.md:43`, `.memory-bank/invariants.md:16`, `.memory-bank/invariants.md:25`, `.memory-bank/testing/index.md:45`).
- Duplicate webhook handling is called out in requirements, invariants, feature design focus, and testing (`.memory-bank/requirements.md:42`, `.memory-bank/invariants.md:17`, `.memory-bank/features/FT-009-yookassa-payment-webhook-return.md:20`, `.memory-bank/testing/index.md:46`).
- Production-secret misuse is explicitly disallowed as evidence (`.memory-bank/testing/index.md:50`).
- Boundary map identifies auth/payment/email/admin/inventory ownership and names secret/prod/deploy ambiguity as a stop condition (`.memory-bank/contracts/boundary-map.md:21`, `.memory-bank/contracts/boundary-map.md:22`, `.memory-bank/contracts/boundary-map.md:30`).

## Required Follow-Up

Before `/prd-to-tasks`, `/execute`, `/autopilot`, or any implementation:

1. Run `/spec-design` and make `security_safety`, `api_contracts`, `event_message_contracts`, deployment/runtime, and relevant data-flow/storage areas authoritative or explicitly not applicable.
2. Add or link a security architecture section/spec covering OAuth/session, webhook trust, secrets, PII/admin access, OWASP controls, and logging/audit boundaries.
3. Add minimal runbook coverage for secrets, local/staging webhook setup, credential compromise, and payment/webhook incident response.
4. Ensure FT-004, FT-009, FT-011, and any checkout/admin/email tasks link the authoritative security spec and remain T3 where auth, secrets, payments, deployment/runtime, or compliance are involved.
5. Keep using simulated/mocked providers for local proof unless a human-approved T3 checkpoint explicitly permits live external mutation.

