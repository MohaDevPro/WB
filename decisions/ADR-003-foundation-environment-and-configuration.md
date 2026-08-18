# ADR-003: Foundation Environment and Configuration Boundary

**Status:** Accepted for the foundation increment
**Date:** 2026-08-18
**Decision owners:** DevOps/SRE, Security & Trust Guardian, Compliance
**Related plan:** `WB_IMPLEMENTATION_PLAN.md`, Phase 1

## Context

WB requires externalized configuration, secure secrets management, separated environments, observability, rollback planning, and region-aware deployment decisions. The repository contains no runtime, environment contract, cloud account, infrastructure definition, secret store, or approved production deployment target. [1] [2]

## Decision

The foundation increment will support only **local development** and **continuous integration**. It will not deploy an environment. Configuration is supplied through validated environment variables, with a committed `.env.example` containing names and safe placeholder values only.

| Area | Decision |
|---|---|
| Supported environments in this increment | Local development and CI only. |
| Configuration source | Process environment, validated by a typed configuration package at application startup. |
| Committed configuration | `.env.example` only; it contains no live URLs, credentials, tokens, private keys, database credentials, or personal data. |
| Secrets | Provided through local developer secret storage or CI secret configuration; never logged, returned by health endpoints, or committed. |
| Health behavior | API exposes a liveness/readiness-safe health response with status only; no environment inventory, version dump, stack trace, or secret values. |
| Logging | Foundation uses structured application logs without credentials, authentication tokens, payment data, or unnecessary personal data. |
| Deployment | Deferred pending D-06 review of cloud, data residency, secret management, backups, network controls, compliance, and operational ownership. |

## Alternatives Considered

| Alternative | Decision | Rationale |
|---|---|---|
| Provision a cloud environment during bootstrap | Rejected | The required cloud, region, legal entity, data classification, access model, backup, and operational ownership decisions are not approved. |
| Commit local configuration values for convenience | Rejected | Conflicts with WB’s secrets, privacy, and security requirements. |
| Use unvalidated environment variables directly throughout application code | Rejected | Produces inconsistent failure behavior and risks unsafe defaults. |
| Local and CI configuration with an explicit validated contract | Accepted | Enables reproducible foundation work without fabricating or deploying production infrastructure. |

## Consequences

The first application commit includes a small typed configuration module and an example environment file. The initial web and API applications must fail fast with safe, actionable messages if required non-secret configuration is absent, except where a feature is intentionally disabled in the foundation. No database, Redis, S3, payment provider, external AI provider, email, SMS, or third-party service is configured until its dedicated milestone, ADR, and security review.

CI receives configuration through non-secret test values suitable for compilation and smoke tests. The CI workflow must use least-privileged permissions and never print environment variables.

## Security, Privacy, and Compliance Considerations

The decision prevents premature commitments regarding cloud provider, Saudi data residency, secret storage, network topology, retention, backups, disaster recovery, and production access. It also prevents the foundation health endpoint from becoming a reconnaissance source. Before any environment that processes personal, transactional, or sensitive data exists, the platform must define ownership, data classification, access control, logging/monitoring, retention, backup/restore, and incident-response controls.

## Reversibility and Review

This decision is deliberately narrow and reversible. A later deployment/environment ADR must supersede it before staging or production deployment. That ADR must address cloud provider and region, infrastructure as code, IAM, secrets, network, TLS, databases, backup/restore objectives, monitoring/alerting, change approval, and rollback.

## References

[1]: ../INFRASTRUCTURE.md "Infrastructure"
[2]: ../DEVOPS.md "DevOps"
[3]: ../PROJECT_INSTRUCTIONS.md "WB Project Instructions"
[4]: ../DISASTER_RECOVERY.md "Disaster Recovery"
