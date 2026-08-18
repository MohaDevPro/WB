# Database Architecture

PostgreSQL is the transactional system of record. WB uses non-guessable identifiers for externally exposed resources, UTC timestamps, migration-managed schema changes, constraints, and transaction boundaries. Sensitive fields require explicit classification and protection rules.

## Implemented Identity and Profile Foundation

The first migration is `apps/api/migrations/001_identity_profile.sql`. It is applied through the transaction-safe `pnpm --filter @wb/api db:migrate` command after `DATABASE_URL` is explicitly configured.

| Table | Purpose | Current controls |
|---|---|---|
| `users` | Internal primary WB identity and explicit account locale | UUID primary key, nullable explicit locale, UTC creation/update timestamps. |
| `user_identities` | OIDC issuer/subject link to an internal user | Unique issuer/subject pair, foreign-key ownership, last authenticated timestamp. External OIDC subject never becomes the internal primary key. |
| `profiles` | Initial private professional-profile fields | One profile per user, required bounded display name, bounded optional biography, JSON array constraint for skills, UTC timestamps. |
| `identity_audit_events` | Non-sensitive identity/profile audit events | Actor reference, event type, UTC event time, JSON-object metadata constraint, actor/time index. |
| `schema_migrations` | Applied migration record | Migration name primary key and UTC application timestamp. |

The profile migration creates the `pgcrypto` extension for UUID generation. It does not store password hashes, bearer tokens, session cookies, email addresses, contact information, location, verification evidence, trust scores, payment data, or AI content.

## Migration Rules

Migrations are ordered by filename and applied one at a time inside a database transaction. A migration is recorded in `schema_migrations` only after its SQL completes successfully. The migration command refuses to run when `DATABASE_URL` is absent. Schema rollback or forward-fix strategy must be assessed for each future migration; financial history remains append-oriented and uses compensating entries rather than silent rewrites.

## Future Data Scope

Core concepts will eventually include organizations, roles, permissions, communities, memberships, events, courses, services, orders, transactions, ledger entries, payouts, disputes, messages, notifications, reviews, trust signals, advertisements, AI tasks, audit records, and compliance evidence. Each domain owns its transactional data and must expose it through interfaces or published events rather than direct cross-domain table coupling.
