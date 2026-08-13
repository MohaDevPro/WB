# Infrastructure

## Target

Initial deployment targets approximately 1,000 users while keeping the architecture capable of horizontal scaling.

## Primary Cloud

Google Cloud is the recommended primary provider, using a Saudi region where service availability and regulatory requirements permit. The platform remains portable.

## Baseline

CDN/load balancing → web application → API/application runtime → PostgreSQL → Redis → object storage → workers.

## Growth

Use containers and infrastructure-as-code. Introduce Kubernetes when evidence justifies the operational cost.

## Resilience

Backups, tested restoration, health checks, graceful degradation, retry policies, idempotency, rate limits, and disaster recovery are required for critical services.

## Sensitive Workloads

The architecture must permit sensitive data and regulated workloads to remain in approved Saudi infrastructure when required by law, contract, or risk assessment.
