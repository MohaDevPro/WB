# Database Architecture

PostgreSQL is the transactional system of record.

Core concepts include users, identities, organizations, roles, permissions, communities, memberships, profiles, skills, verification records, events, courses, services, orders, transactions, ledger entries, payouts, disputes, messages, notifications, reviews, trust signals, advertisements, AI tasks, audit records, and compliance evidence.

Use non-guessable identifiers for externally exposed resources. Store timestamps consistently in UTC.

Financial records are append-oriented and auditable. Corrections use compensating entries rather than rewriting historical ledger entries.

Sensitive fields require explicit classification and protection rules.
