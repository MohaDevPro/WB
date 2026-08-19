CREATE TABLE IF NOT EXISTS local_accounts (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 5 AND 254),
  password_hash TEXT NOT NULL CHECK (length(password_hash) >= 40),
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 10 AND 500),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_memberships (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  group_id UUID REFERENCES community_groups(id) ON DELETE SET NULL,
  author_user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 12000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussion_comments (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discussion_reactions (
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'helpful' CHECK (reaction IN ('helpful', 'insightful', 'celebrate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (discussion_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 6000),
  event_type TEXT NOT NULL CHECK (event_type IN ('online', 'physical', 'hybrid')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  registration_state TEXT NOT NULL DEFAULT 'open' CHECK (registration_state IN ('draft', 'open', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlisted', 'cancelled', 'attended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS expert_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL CHECK (length(headline) BETWEEN 3 AND 180),
  specialties JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  availability TEXT NOT NULL DEFAULT 'open' CHECK (availability IN ('open', 'limited', 'unavailable')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 8000),
  opportunity_type TEXT NOT NULL CHECK (opportunity_type IN ('role', 'project', 'partnership', 'mentorship')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  provider_user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 240),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 8000),
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  service_id UUID NOT NULL REFERENCES services(id),
  requester_user_id UUID NOT NULL REFERENCES users(id),
  provider_user_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled', 'delivered', 'accepted_delivery', 'disputed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  service_request_id UUID NOT NULL UNIQUE REFERENCES service_requests(id),
  provider TEXT NOT NULL DEFAULT 'local-sandbox',
  provider_reference TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'requires_confirmation' CHECK (status IN ('requires_confirmation', 'authorized', 'captured', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  service_request_id UUID NOT NULL UNIQUE REFERENCES service_requests(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  subject_user_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 3 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('discussion', 'comment', 'profile', 'event', 'service')),
  resource_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_snapshots (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('expert', 'community', 'event', 'opportunity')),
  resource_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  score NUMERIC(5,4) NOT NULL CHECK (score BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  requested_by UUID NOT NULL REFERENCES users(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('summary', 'moderation', 'recommendation')),
  input_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'completed', 'rejected')),
  output_summary TEXT,
  approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  requested_by UUID NOT NULL REFERENCES users(id),
  workflow_type TEXT NOT NULL CHECK (workflow_type IN ('community_digest', 'event_follow_up', 'opportunity_match')),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'executed', 'cancelled')),
  input_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_audit_events (
  id UUID PRIMARY KEY DEFAULT wb_generate_uuid(),
  actor_user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussions_community_created_at_index ON discussions (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_starts_at_index ON events (starts_at);
CREATE INDEX IF NOT EXISTS notifications_user_created_at_index ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS opportunities_status_created_at_index ON opportunities (status, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_actor_created_at_index ON platform_audit_events (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'moderator', 'admin')),
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
