# Decision Log

Initial decisions:
- Model C direction: AI-native Community Super-Platform.
- Free core community plus paid ecosystem services.
- Modular monolith first.
- Google Cloud primary with cloud-agnostic architecture.
- Arabic and English first-class with Arabic-first UX.
- Provider-agnostic AI.
- Hybrid AI plus human moderation.
- Level 5 autonomy architecture, Level 2–3 launch.
- Unified trust engine with understandable badges.
- Payment abstraction with multiple provider adapters.
- Escrow-like orchestration through compliant financial infrastructure.
- Saudi compliance by design.
- Proprietary licensing strategy.
- Single repository initially.

## Foundation Decisions — 2026-08-18

The repository will begin as a `pnpm` workspace containing a Next.js web application, a NestJS API application, and small shared packages for contracts and typed configuration. This is one versioned, modular-monolith product boundary rather than a microservice estate; the API application will own future domain rules, authorization, persistence access, and audit boundaries. See `decisions/ADR-001-initial-modular-monolith-topology.md`.

The workspace will use a committed `pnpm` lockfile, Node.js 22.x, explicit package ownership, and root quality scripts. Dependencies will be introduced only through deliberate security, maintenance, license, performance, and operational review. See `decisions/ADR-002-pnpm-workspace-and-dependency-policy.md`.

The foundation supports local development and CI only. It uses validated environment variables and a safe `.env.example`, but does not create or deploy a cloud environment, process external-service credentials, or assume a production hosting decision. See `decisions/ADR-003-foundation-environment-and-configuration.md`.
