---
description: Project Constitution — governing principles for AI-first development.
status: active
version: 1
project_principles: ratified
ratified: 2026-06-18
last_updated: 2026-06-18
---
# Project Constitution

## Purpose

This Constitution defines the non-negotiable principles that guide AI agents when planning, implementing, verifying, and synchronizing this project.

## Core Principles

### 0. Project Principles Status

Project principles are ratified for a medium-complexity MVP internet shop. Evidence sources: `.memory-bank/analysis/product-brief.md`, `.memory-bank/analysis/brainstorming/BR-001.md`, and the `/constitution` interview on 2026-06-18.

### I. AI-First Spec-Driven Development

Agents MUST derive implementation work from explicit product, requirement, feature, task, and workflow artifacts. Agents MUST NOT invent product scope without evidence or user instruction.

### II. Memory Bank Is Durable Project Knowledge

`.memory-bank/` is the durable source of project knowledge. Chat context is temporary. Agents MUST update Memory Bank after meaningful changes.

### III. DO NOT Overengineering

The project level is `medium`, not enterprise. Agents MUST prefer KISS, avoid microservices and enterprise abstractions, and MUST NOT modify Medusa Core. Use API -> Workflows -> Modules and isolate external integrations as modules.

### IV. Tier-Based Definition of Done

Tasks MUST use the current schema-backed JSON task record model and `tier: T0|T1|T2|T3` routing. Definition of Done follows `.memory-bank/workflows/tier-policy.md`: T0/T1 may use compact evidence, T2/T3 require tier-appropriate verification, and T3 requires human checkpoint plus rollback/recovery evidence.

### V. Evidence Before Done

A task MUST NOT be marked done without verification evidence appropriate to its tier and scope. Payments, auth, order state, stock reservation, production/deploy, destructive data operations, and compliance-sensitive work are high-risk areas and MUST follow the higher tier when in doubt.

### VI. Scoped Agent Autonomy

Agents may work autonomously inside approved specs and scoped tasks. Human checkpoint is required for T3 work, secrets, production writes/deploys, destructive operations, payment/compliance ambiguity, and source-of-truth conflicts that change behavior, public contracts, security, cost, or data.

### VII. Critical Non-Negotiables

Security/privacy, no data loss, payment correctness, and low maintenance are non-negotiable. These principles apply especially to customer identity, personal data, carts, orders, inventory reservations, payment webhooks, and status transitions.

### VIII. No Legacy Fallback and No Speculation

Agents MUST NOT rely on deprecated task formats, old risk models, or undocumented assumptions. Unknowns MUST be recorded as blockers or explicit assumptions.

### IX. Context Discipline

Agents SHOULD read the smallest sufficient context for the task. Higher-tier or cross-cutting tasks MUST read relevant normative docs such as invariants, contracts, states, testing, and workflow policies.

### X. Synchronization

After meaningful changes, agents MUST synchronize affected Memory Bank docs, task state, changelog, and routing files.

## Interview Notes

- Project level: `medium`; add explicit anti-overengineering principle.
- Architecture priority: KISS.
- Definition of Done: tier-based checks from `.memory-bank/workflows/tier-policy.md`.
- Agent autonomy: scoped autonomy inside approved specs/tasks; human checkpoint for T3 and sensitive ambiguity.
- Critical non-negotiables: security/privacy, no data loss, payment correctness, low maintenance.

## Governance

- Constitution has precedence over workflow habits and generated plans.
- MBB, spec-index, spec-backbone, invariants, contracts, states, testing, and workflow docs refine this Constitution; they must not contradict it.
- Amendments must include rationale and update affected docs if needed.
- Constitution should stay short. Put concrete project rules into `invariants.md`, `contracts/*`, `states/*`, or workflow policy docs.

**Version**: 1 | **Ratified**: 2026-06-18 | **Last updated**: 2026-06-18
