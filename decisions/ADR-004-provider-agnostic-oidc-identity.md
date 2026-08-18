# ADR-004: Provider-Agnostic OIDC Identity and Session Boundary

**Status:** Accepted for the identity foundation
**Date:** 2026-08-18
**Decision owners:** Security & Trust Guardian, Product Architect, Developer Lead
**Related plan:** `WB_IMPLEMENTATION_PLAN.md`, Phase 3

## Context

WB requires secure authentication, one primary platform identity per person, additive roles, user-controlled profile visibility, Arabic/English support, auditability, and a future path to stronger controls such as MFA. The repository has no approved user-credential lifecycle, identity provider, email/SMS service, database, or production environment. Storing passwords or inventing an email-verification flow inside the first identity increment would introduce unnecessary sensitive-data and operational responsibilities. [1] [2]

## Decision

WB will use **OpenID Connect (OIDC) authorization code flow with PKCE** as the primary authentication protocol. The product will integrate through a small provider-agnostic identity adapter rather than embedding any provider SDK throughout domain modules.

| Area | Decision |
|---|---|
| Primary identifier | WB creates a non-guessable internal `userId`; externally supplied OIDC claims never become primary database keys. |
| External identity link | An identity link consists of the OIDC issuer and immutable subject (`sub`); email remains an attribute, not identity proof by itself. |
| Browser authentication | The web application uses authorization code flow with PKCE. Password collection, recovery, MFA challenges, and credential storage remain the identity provider’s responsibility. |
| API authentication | The API verifies access tokens through the configured issuer, audience, signature/JWKS, expiry, issuer, and nonce/state safeguards appropriate to the flow. It never trusts browser-supplied user IDs or profile ownership fields. |
| Session boundary | Browser session artifacts must be `HttpOnly`, `Secure` outside local development, `SameSite=Lax` or stricter, short lived, and renewable only through approved provider behavior. The API is the future authorization enforcement point. |
| Account locale | An explicit account locale is stored independently from browser/session detection. Explicit account choice has precedence over session, browser, and default locale. |
| Development | Development authentication may use a dedicated test issuer or local fixture configured only through non-production environment values. Header-based impersonation, static production-like tokens, and bypass routes are prohibited. |

## Alternatives Considered

| Alternative | Decision | Rationale |
|---|---|---|
| Store email/password credentials in the WB application | Rejected | It adds password hashing, recovery, verification, MFA, breach response, and credential-lifecycle responsibilities before the required infrastructure and security controls are established. |
| Bind the platform directly to a proprietary authentication SDK | Rejected | It weakens provider agility and couples business modules to a vendor. |
| Use provider-agnostic OIDC with an internal adapter | Accepted | It uses a mature interoperable protocol, keeps WB identity and profile data under WB’s domain model, and allows controlled provider selection later. |
| Trust a development header as authentication | Rejected | It is too easy to expose accidentally and violates the no-bypass requirement. |

## Consequences

The first identity implementation may establish claims, identity-link, profile, session-policy, and authorization interfaces without enabling an internet-facing sign-in route until the OIDC provider, redirect URIs, keys, issuer/audience, email/phone policy, and production environment are approved. API routes that become protected must require a validated identity context; they may not accept ownership identifiers from request bodies.

A later identity-provider selection ADR must name the provider, data-processing agreement, regional/data-residency implications, MFA and account-recovery policies, user-deletion/export behavior, event/webhook verification rules, and operational ownership. Changing the protocol or provider requires review because it affects security, privacy, user experience, and account migration.

## Security and Privacy Considerations

OIDC token validation must fail closed. Logs and audit events must never include bearer tokens, authorization codes, session cookies, passwords, or unnecessary profile data. Identity link data is confidential; only explicitly permitted profile fields can be public. Account suspension, identity verification decisions, and privileged configuration remain high-impact workflows requiring human or explicitly policy-controlled authorization.

## References

[1]: ../PROJECT_INSTRUCTIONS.md "WB Project Instructions"
[2]: ../IDENTITY_AND_PROFILES.md "Identity and Professional Profiles"
[3]: ../SECURITY_RULES.md "Security Rules"
[4]: ../ARABIC_ENGLISH_LOCALIZATION.md "Arabic and English Localization"
