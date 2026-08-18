CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE wb_locale AS ENUM ('ar', 'en');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred_locale wb_locale,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_authenticated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_identities_issuer_subject_key UNIQUE (issuer, subject)
);

CREATE INDEX user_identities_user_id_index ON user_identities(user_id);

CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  display_name VARCHAR(120) NOT NULL,
  biography TEXT,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_skills_must_be_array CHECK (jsonb_typeof(skills) = 'array'),
  CONSTRAINT profiles_biography_length CHECK (biography IS NULL OR char_length(biography) <= 1000)
);

CREATE TABLE identity_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT identity_audit_events_metadata_must_be_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX identity_audit_events_actor_occurred_index
  ON identity_audit_events(actor_user_id, occurred_at DESC);
