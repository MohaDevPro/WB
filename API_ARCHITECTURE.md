# API Architecture

APIs are versioned, authenticated where required, authorized, validated, observable, rate-limited, and documented. Every write endpoint defines authorization, validation, idempotency, error semantics, audit requirements, and business invariants. Public APIs expose stable domain concepts rather than database details and never leak secrets, stack traces, internal authorization information, or unnecessary personal data.

## Implemented Foundation Routes

| Route | Authentication | Purpose | Current behavior |
|---|---|---|---|
| `GET /api/health` | None | Minimal liveness response | Returns only `{ "status": "ok" }`; it does not expose versions, environment variables, dependencies, or configuration. |
| `GET /api/v1/me/profile` | OIDC bearer access token | Reads the caller’s own private profile | Ownership derives only from the verified OIDC issuer and subject. Missing profile returns a safe not-found response to the authenticated caller. |
| `PUT /api/v1/me/profile` | OIDC bearer access token | Creates or replaces the caller’s private profile | Allow-lists display name, biography, skills, and explicit account locale; rejects unknown or malformed fields; writes a non-sensitive audit event. |

The profile controller has a ten-request-per-minute route limit. A global sixty-request-per-minute default applies to API routes in the single-instance foundation. Before multi-instance deployment, rate-limit storage and proxy behavior must move to an approved shared operational design.

## Authentication and Error Behavior

Profile routes use provider-agnostic OIDC token verification. The API validates bearer tokens against the configured issuer, audience, signature/JWKS, and standard token-expiry behavior. It derives internal ownership from verified claims and never accepts a user identifier from the request body.

The profile routes intentionally return a safe service-unavailable response when OIDC or PostgreSQL configuration is absent. This is a controlled prerequisite state, not an authentication bypass. Invalid or missing bearer credentials return an authentication failure once OIDC is configured. No OIDC provider, user sign-in UI, public profile, organization role, or staff/admin route is enabled by this foundation.

## Future Contract Rules

Future write routes must define idempotency, structured validation, authorization policy, audit requirements, rate limits, safe errors, API documentation, and privacy behavior before implementation. Additional public API versioning, OpenAPI publication, client SDKs, webhook verification, CORS policy, and domain-event contracts remain staged work.
