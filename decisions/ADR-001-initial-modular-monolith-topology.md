# ADR-001: Initial Modular-Monolith Topology

**Status:** Accepted for the foundation increment
**Date:** 2026-08-18
**Decision owners:** Product Architect, Developer Lead, Security & Trust Guardian
**Related plan:** `WB_IMPLEMENTATION_PLAN.md`, Phase 1

## Context

WB requires a production-oriented modular monolith, with Next.js/React/TypeScript as the preferred experience stack and NestJS/TypeScript as the preferred backend stack. The repository contains no executable application. The initial topology must create clear ownership boundaries without introducing a microservice estate or exposing persistence and security controls to the browser. [1] [2]

## Decision

WB will begin as a **single `pnpm` workspace repository** containing two applications and shared internal packages:

| Area | Initial location | Responsibility |
|---|---|---|
| Web experience | `apps/web` | Next.js application; Arabic-first RTL/LTR experience; presentation and browser-facing route handling only. |
| API application | `apps/api` | NestJS modular-monolith backend; domain rules, authentication, authorization, API contracts, persistence ownership, audit/observability boundary. |
| Shared contracts | `packages/contracts` | Transport-safe, framework-neutral public DTO and error-contract types. No domain business logic or persistence access. |
| Shared configuration | `packages/config` | Typed, validated, server-safe configuration definitions. No secret values in source. |

The two applications are **not microservices**. They are two deployable interfaces to one modular-monolith product boundary, remain versioned and released together, use one primary transactional database when persistence is introduced, and do not communicate through an independently operated event bus or service mesh. Domain modules and data ownership will be established inside `apps/api`; `apps/web` will never access the database directly.

## Alternatives Considered

| Alternative | Decision | Rationale |
|---|---|---|
| A single Next.js application with integrated server routes | Rejected for the initial foundation | It is simpler, but does not align as directly with the documented NestJS backend direction and makes the backend domain boundary less explicit. |
| Next.js web application plus NestJS API application in one workspace | Accepted | It respects the preferred stack, isolates browser-facing concerns from core domain/security concerns, and preserves one-repository modular-monolith delivery. |
| Independently deployed domain microservices | Rejected | It conflicts with the modular-monolith-first rule and would add premature operational, security, observability, and deployment complexity. |

## Consequences

The foundation increment will create only a minimal web route and a minimal API health endpoint. It will not create business domains, database access, authentication, external integrations, queues, or WebSockets. Future API contracts must be versioned, validated, authorized, observable, and documented. `apps/api` owns all future transactional data access; cross-domain behavior will use explicit interfaces and only later use events where decoupling is justified. [1] [3]

This topology requires consistent TypeScript and quality configuration across applications. It also creates a browser-to-API boundary that must use explicit CORS, error, authentication, and rate-limiting policies before protected user flows are exposed.

## Security and Privacy Considerations

Browser code must not contain secrets, direct database credentials, privileged authorization rules, or private operational configuration. The API application becomes the enforcement point for future validation, authorization, audit, and data-minimization controls. The foundation’s health endpoint contains no sensitive system state, secrets, dependency versions, or stack traces.

## Reversibility and Review

The decision is reversible but not cost-free. Before persistence or an externally consumed API is introduced, this topology must be re-reviewed against actual delivery needs. Any decision to split deployments, introduce separate data stores, add asynchronous infrastructure, or create independently operated services requires a new ADR and explicit review.

## References

[1]: ../PROJECT_INSTRUCTIONS.md "WB Project Instructions"
[2]: ../TECHNOLOGY_STACK.md "Technology Stack"
[3]: ../PLATFORM_ARCHITECTURE.md "Platform Architecture"
