# API Architecture

APIs must be versioned, authenticated, authorized, validated, observable, rate-limited, and documented.

Every write endpoint defines authorization, validation, idempotency, error semantics, audit requirements, and business invariants.

Public APIs expose stable domain concepts rather than database details.

Never leak secrets, stack traces, internal authorization information, or unnecessary personal data.
