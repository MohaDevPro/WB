# ADR-005: Scoped Authorization and Profile Visibility

**Status:** Accepted for the identity foundation
**Date:** 2026-08-18
**Decision owners:** Security & Trust Guardian, Product Architect, Developer Lead
**Related plan:** `WB_IMPLEMENTATION_PLAN.md`, Phase 3

## Context

WB requires one identity with additive roles, scoped organizational permissions, explicit user privacy choices, explainable trust signals, and least-privilege operational control. The first profile workflow must avoid making unreviewed professional, contact, location, organization, or activity data public merely because it is present in a profile. [1] [2]

## Decision

WB will use a **deny-by-default policy model** that separates identity claims, global roles, resource ownership, and scoped permissions. The initial implementation exposes only the minimal member/profile scope and establishes interfaces that later domains can extend.

| Layer | Initial rule |
|---|---|
| Identity | A validated identity context establishes the internal `userId` and authenticated state; it does not grant resource access by itself. |
| Global roles | The initial member role is additive and grants no administration, moderation, verification, payment, audit, or organization authority. Future roles are assigned through reviewed policy and retain explicit scope. |
| Ownership | A user can read and edit only their own private profile representation. Ownership is derived from authenticated context, never from request data. |
| Profile visibility | Every public-facing field is classified explicitly. The profile begins private; no public profile exists until a future product workflow defines the public surface, consent copy, search behavior, and abuse controls. |
| Privileged actions | Identity verification, role grants, suspension, moderation enforcement, sensitive-data access, financial actions, and audit administration are not part of the initial member role and require separate policy/approval design. |
| Failure behavior | Missing or invalid identity returns an authentication failure; a valid identity without required scope returns an authorization failure. Responses avoid resource-existence disclosure where the requested resource is not accessible. |
| Audit | Authentication, authorization denials, profile changes, visibility changes, and role changes require structured audit events once persistence is enabled. Logs exclude secrets and unnecessary personal data. |

## Alternatives Considered

| Alternative | Decision | Rationale |
|---|---|---|
| A broad `admin` role to simplify initial development | Rejected | It contradicts least privilege and segregation of duties. |
| Field visibility defaults to public | Rejected | It conflicts with data minimization, transparency, and user-controlled visibility. |
| Ownership is provided by client request body or route parameter alone | Rejected | It enables insecure direct-object-reference behavior. |
| Deny-by-default, resource-scoped authorization | Accepted | It supports incremental domains, keeps privilege explicit, and permits future community/organization scopes without widening the member role. |

## Consequences

The identity/profile slice will use policy functions that accept an authenticated identity context and a resource owner identifier. API controllers call policies before mutation or private retrieval. The initial profile data model is limited to display name, biography, selected skills, and explicit account locale; it excludes contact details, location, social links, organization memberships, employment history, verification evidence, and trust badges until their privacy, verification, and retention rules are separately approved.

The first slice will not implement public profile search, relationship graphs, role management, identity verification, organization membership, account suspension, or staff/admin panels. Introducing any of these requires a domain-specific authorization matrix and, when material, a new ADR.

## Security and Privacy Considerations

The profile is private by default. API validation rejects unexpected fields. Authorization must be tested with negative cases as well as successful ownership cases. Future sensitive fields must be classified before persistence; profile updates must not bypass audit or user-consent controls. The model prevents a single operational role from automatically combining identity, security administration, financial settlement, and audit-evidence control.

## References

[1]: ../IDENTITY_AND_PROFILES.md "Identity and Professional Profiles"
[2]: ../PRIVACY_AND_DATA_GOVERNANCE.md "Privacy and Data Governance"
[3]: ../SECURITY_RULES.md "Security Rules"
[4]: ../GOVERNANCE.md "Governance"
