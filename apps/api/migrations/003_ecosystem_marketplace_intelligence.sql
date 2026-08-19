CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 10 AND 2000),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_modules (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  position INTEGER NOT NULL CHECK (position > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (learning_path_id, position)
);

CREATE TABLE IF NOT EXISTS learning_enrollments (
  learning_path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learning_path_id, user_id)
);

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'authorized', 'captured', 'refunded', 'cancelled', 'webhook_recorded')),
  provider_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_intent_id, event_type, provider_event_id)
);

CREATE TABLE IF NOT EXISTS settlement_runs (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  payment_intent_id UUID NOT NULL UNIQUE REFERENCES payment_intents(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'settled', 'failed', 'reversed')),
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'SAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS service_disputes (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  service_request_id UUID NOT NULL UNIQUE REFERENCES service_requests(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  resolution TEXT,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS community_federation_links (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  remote_base_url TEXT NOT NULL CHECK (remote_base_url ~ '^https://'),
  remote_community_key TEXT NOT NULL CHECK (length(remote_community_key) BETWEEN 3 AND 160),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'revoked')),
  trust_level TEXT NOT NULL DEFAULT 'verified' CHECK (trust_level IN ('verified', 'restricted')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, remote_base_url, remote_community_key)
);

CREATE INDEX IF NOT EXISTS expert_profiles_availability_index ON expert_profiles (availability, is_verified);
CREATE INDEX IF NOT EXISTS learning_paths_status_created_at_index ON learning_paths (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_intent_created_at_index ON payment_events (payment_intent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_disputes_status_created_at_index ON service_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_federation_links_community_status_index ON community_federation_links (community_id, status);
