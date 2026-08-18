# Identity and Professional Profiles

Each person has one platform identity that can participate in multiple roles. Roles are additive: a person may be a member, expert, provider, mentor, partner, and organization administrator simultaneously. A validated identity does not itself grant access to a resource; access is determined by explicit scoped authorization and ownership rules.

## Implemented Foundation

The current API provides a private-by-default self-profile boundary at `GET` and `PUT /api/v1/me/profile`. It accepts only the following initial fields:

| Field | Classification | Current behavior |
|---|---|---|
| Display name | Personal data | Required; validated as a trimmed string of 1–120 characters; visible only through the private self-profile API. |
| Biography | Personal data | Optional; validated as a trimmed string of at most 1,000 characters; private by default. |
| Skills | Personal/professional data | Optional; at most 20 unique trimmed strings, each at most 60 characters; private by default. |
| Preferred locale | Account preference | Required as Arabic (`ar`) or English (`en`); stored separately from browser/session detection and applied with explicit-account precedence. |

The API derives ownership only from a validated OIDC issuer and subject. It creates a non-guessable internal user identifier and links the external issuer/subject to that internal identity. Client-supplied ownership identifiers are not accepted.

## Authentication and Authorization Boundary

WB uses provider-agnostic OIDC authorization code flow with PKCE as the approved authentication direction. Browser credential collection, recovery, MFA, and provider-specific session behavior remain responsibilities of a future selected identity provider. Profile routes remain unavailable until a complete OIDC issuer, audience, and JWKS URL are configured together and PostgreSQL profile storage is configured.

The first member role has no administration, moderation, verification, payment, audit, or organization authority. Profile data starts private: public profile search, public visibility controls, contact details, location, social links, organizations, employment history, verification evidence, and trust badges are deferred until their domain-specific privacy, retention, authorization, and abuse controls are approved.

## Privacy and Audit

Explicit privacy choices override defaults. The implemented profile payload allow-lists known fields and rejects unexpected data. Profile updates create a non-sensitive `profile.updated` audit event that records only the changed field names; access tokens, credentials, biography text, skills, and other profile values are not stored in the audit metadata.

## Future Profile Scope

A professional profile may eventually include skills, experience, education, certifications, portfolio, services, expertise, languages, availability, location, interests, organization memberships, verification, trust badges, and selected activity. Each future field requires data classification, a visibility policy, validation, authorization, retention, audit, localization, and user-control decisions before implementation.
