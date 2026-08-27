---
description: Router for architecture specifications.
status: active
---
# Architecture

- [.memory-bank/architecture/system-architecture.md](system-architecture.md): global modular-monolith architecture, source-of-truth, storage, security, and testing guardrails.
- [.memory-bank/architecture/cart-runtime.md](cart-runtime.md): FT-003 cart persistence, merge boundary, runtime, and event model.
- [.memory-bank/architecture/auth-runtime.md](auth-runtime.md): FT-004 Medusa authentication, provider, session, and persistence boundary.
- [.memory-bank/architecture/checkout-delivery-runtime.md](checkout-delivery-runtime.md): FT-006 authenticated checkout validation runtime, Shipping Options source, and downstream handoffs.
- [.memory-bank/architecture/pending-order-runtime.md](pending-order-runtime.md): FT-007 native pending-order creation, inventory reservation, idempotency, and expiry runtime.
- [.memory-bank/architecture/order-lifecycle-admin-runtime.md](order-lifecycle-admin-runtime.md): FT-008 logical lifecycle workflow, native Medusa event projection, reservation consumption, and Admin visibility.
