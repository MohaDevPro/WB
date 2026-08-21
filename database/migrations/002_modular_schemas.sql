-- WB Database Foundation
-- One PostgreSQL database per environment; one schema per application Module.
-- This migration creates the complete future model. Application activation remains staged by V0/V1.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS profile;
CREATE SCHEMA IF NOT EXISTS community;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS moderation;
CREATE SCHEMA IF NOT EXISTS verification;
CREATE SCHEMA IF NOT EXISTS event;
CREATE SCHEMA IF NOT EXISTS directory;
CREATE SCHEMA IF NOT EXISTS trust;
CREATE SCHEMA IF NOT EXISTS system;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.app_metadata (
  key VARCHAR(160) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- auth: identity, credentials, sessions, verification, security
-- ============================================================
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  platform_role VARCHAR(40) NOT NULL DEFAULT 'member'
    CHECK (platform_role IN ('platform_admin', 'member')),
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified_at TIMESTAMPTZ,
  email_changed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.user_phones (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 VARCHAR(16) NOT NULL UNIQUE
    CHECK (phone_e164 ~ '^\+[1-9][0-9]{1,14}$'),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  ip_hash CHAR(64),
  user_agent_hash CHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_type VARCHAR(40) NOT NULL CHECK (factor_type IN ('totp', 'webauthn')),
  secret_reference TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_id UUID NOT NULL REFERENCES auth.mfa_factors(id) ON DELETE CASCADE,
  challenge_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- profile: basic and future professional profile
-- ============================================================
CREATE TABLE IF NOT EXISTS profile.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(120) NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  avatar_object_key TEXT,
  bio VARCHAR(500) CHECK (char_length(bio) <= 500),
  locale VARCHAR(20) NOT NULL DEFAULT 'ar-SA',
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Riyadh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile.profile_visibility (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility VARCHAR(30) NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  organization_name VARCHAR(180) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  starts_on DATE NOT NULL,
  ends_on DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (NOT is_current OR ends_on IS NULL)
);

CREATE TABLE IF NOT EXISTS profile.educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  institution_name VARCHAR(180) NOT NULL,
  degree VARCHAR(180),
  field_of_study VARCHAR(180),
  description TEXT,
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS profile.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  issuer_name VARCHAR(180) NOT NULL,
  certificate_name VARCHAR(180) NOT NULL,
  credential_url TEXT,
  issued_on DATE,
  expires_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);

CREATE TABLE IF NOT EXISTS profile.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL UNIQUE,
  slug CITEXT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile.user_skills (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  skill_id UUID NOT NULL REFERENCES profile.skills(id) ON DELETE RESTRICT,
  proficiency VARCHAR(30) CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience NUMERIC(4,1) CHECK (years_experience IS NULL OR years_experience >= 0),
  visibility VARCHAR(30) NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS profile.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL UNIQUE,
  slug CITEXT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile.user_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES profile.services(id) ON DELETE RESTRICT,
  summary VARCHAR(500),
  visibility VARCHAR(30) NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);

CREATE TABLE IF NOT EXISTS profile.experience_visibility (
  experience_id UUID PRIMARY KEY REFERENCES profile.experiences(id) ON DELETE CASCADE,
  visibility VARCHAR(30) NOT NULL CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile.education_visibility (
  education_id UUID PRIMARY KEY REFERENCES profile.educations(id) ON DELETE CASCADE,
  visibility VARCHAR(30) NOT NULL CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile.certificate_visibility (
  certificate_id UUID PRIMARY KEY REFERENCES profile.certificates(id) ON DELETE CASCADE,
  visibility VARCHAR(30) NOT NULL CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- community: communities, memberships, groups and roles
-- ============================================================
CREATE TABLE IF NOT EXISTS community.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  slug CITEXT NOT NULL UNIQUE CHECK (slug::TEXT ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description TEXT NOT NULL DEFAULT '',
  visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('public', 'closed')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.community_settings (
  community_id UUID PRIMARY KEY REFERENCES community.communities(id) ON DELETE CASCADE,
  join_policy VARCHAR(30) NOT NULL CHECK (join_policy IN ('open', 'request', 'invite_only')),
  content_policy VARCHAR(30) NOT NULL DEFAULT 'members',
  default_visibility VARCHAR(30) NOT NULL DEFAULT 'community_only'
    CHECK (default_visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status VARCHAR(25) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected', 'removed', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community.membership_roles (
  membership_id UUID NOT NULL REFERENCES community.memberships(id) ON DELETE CASCADE,
  role_code VARCHAR(40) NOT NULL CHECK (role_code IN ('member', 'community_admin')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, role_code)
);

CREATE TABLE IF NOT EXISTS community.membership_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status VARCHAR(25) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason VARCHAR(500),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email CITEXT,
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (invited_user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS community.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, name)
);

CREATE TABLE IF NOT EXISTS community.group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community.groups(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status VARCHAR(25) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'removed', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS community.group_membership_roles (
  group_membership_id UUID NOT NULL REFERENCES community.group_memberships(id) ON DELETE CASCADE,
  role_code VARCHAR(40) NOT NULL CHECK (role_code IN ('member', 'moderator')),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_membership_id, role_code)
);

CREATE TABLE IF NOT EXISTS community.community_creation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  slug CITEXT NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- content: channels, posts, comments, reactions and attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS content.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  channel_type VARCHAR(30) NOT NULL CHECK (channel_type IN ('announcement', 'discussion', 'opportunities', 'events', 'general')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.community_channels (
  channel_id UUID PRIMARY KEY REFERENCES content.channels(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  slug CITEXT NOT NULL,
  UNIQUE (community_id, slug)
);

CREATE TABLE IF NOT EXISTS content.group_channels (
  channel_id UUID PRIMARY KEY REFERENCES content.channels(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES community.groups(id) ON DELETE RESTRICT,
  slug CITEXT NOT NULL,
  UNIQUE (group_id, slug)
);

CREATE TABLE IF NOT EXISTS content.channel_policies (
  channel_id UUID PRIMARY KEY REFERENCES content.channels(id) ON DELETE CASCADE,
  can_member_read BOOLEAN NOT NULL DEFAULT true,
  can_member_publish BOOLEAN NOT NULL DEFAULT false,
  can_moderator_publish BOOLEAN NOT NULL DEFAULT true,
  can_community_admin_publish BOOLEAN NOT NULL DEFAULT true,
  can_platform_admin_publish BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  status VARCHAR(20) NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.community_posts (
  post_id UUID PRIMARY KEY REFERENCES content.posts(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS content.group_posts (
  post_id UUID PRIMARY KEY REFERENCES content.posts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES community.groups(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS content.channel_posts (
  post_id UUID PRIMARY KEY REFERENCES content.posts(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES content.channels(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS content.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES content.posts(id) ON DELETE RESTRICT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status VARCHAR(20) NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.reactions (
  post_id UUID NOT NULL REFERENCES content.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reaction_type VARCHAR(30) NOT NULL DEFAULT 'like' CHECK (reaction_type = 'like'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS content.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  object_key TEXT NOT NULL UNIQUE,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content.post_attachments (
  post_id UUID NOT NULL REFERENCES content.posts(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES content.attachments(id) ON DELETE RESTRICT,
  position SMALLINT NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (post_id, attachment_id)
);

CREATE TABLE IF NOT EXISTS content.post_visibility (
  post_id UUID PRIMARY KEY REFERENCES content.posts(id) ON DELETE CASCADE,
  visibility VARCHAR(30) NOT NULL CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only', 'private')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION content.assert_post_scope(target_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE scope_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM content.posts WHERE id = target_post_id) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO scope_count
  FROM (
    SELECT post_id FROM content.community_posts WHERE post_id = target_post_id
    UNION ALL
    SELECT post_id FROM content.group_posts WHERE post_id = target_post_id
    UNION ALL
    SELECT post_id FROM content.channel_posts WHERE post_id = target_post_id
  ) scopes;
  IF scope_count <> 1 THEN
    RAISE EXCEPTION 'content.posts % must have exactly one scope row; found %', target_post_id, scope_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION content.check_post_scope_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM content.assert_post_scope(OLD.post_id);
  ELSIF TG_TABLE_NAME = 'posts' THEN
    PERFORM content.assert_post_scope(NEW.id);
  ELSE
    PERFORM content.assert_post_scope(NEW.post_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS posts_scope_guard ON content.posts;
CREATE CONSTRAINT TRIGGER posts_scope_guard
AFTER INSERT OR UPDATE ON content.posts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION content.check_post_scope_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['community_posts', 'group_posts', 'channel_posts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_scope_guard ON content.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_scope_guard AFTER INSERT OR UPDATE OR DELETE ON content.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION content.check_post_scope_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION content.assert_channel_scope(target_channel_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE scope_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM content.channels WHERE id = target_channel_id) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO scope_count
  FROM (
    SELECT channel_id FROM content.community_channels WHERE channel_id = target_channel_id
    UNION ALL
    SELECT channel_id FROM content.group_channels WHERE channel_id = target_channel_id
  ) scopes;
  IF scope_count <> 1 THEN
    RAISE EXCEPTION 'content.channels % must have exactly one scope row; found %', target_channel_id, scope_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION content.check_channel_scope_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM content.assert_channel_scope(OLD.channel_id);
  ELSIF TG_TABLE_NAME = 'channels' THEN
    PERFORM content.assert_channel_scope(NEW.id);
  ELSE
    PERFORM content.assert_channel_scope(NEW.channel_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS channels_scope_guard ON content.channels;
CREATE CONSTRAINT TRIGGER channels_scope_guard
AFTER INSERT OR UPDATE ON content.channels
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION content.check_channel_scope_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['community_channels', 'group_channels'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_scope_guard ON content.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_scope_guard AFTER INSERT OR UPDATE OR DELETE ON content.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION content.check_channel_scope_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

-- ============================================================
-- event: event aggregate, occurrences, audiences and attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS event.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(240) NOT NULL CHECK (char_length(title) BETWEEN 2 AND 240),
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event.events(id) ON DELETE RESTRICT,
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 1),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Riyadh',
  zoom_url_ciphertext TEXT NOT NULL,
  zoom_url_iv CHAR(16) NOT NULL,
  zoom_url_auth_tag CHAR(24) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, sequence_no),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS event.public_events (
  event_id UUID PRIMARY KEY REFERENCES event.events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event.private_community_events (
  event_id UUID PRIMARY KEY REFERENCES event.events(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS event.private_group_events (
  event_id UUID PRIMARY KEY REFERENCES event.events(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES community.groups(id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION event.assert_event_audience(target_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE audience_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM event.events WHERE id = target_event_id) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO audience_count
  FROM (
    SELECT event_id FROM event.public_events WHERE event_id = target_event_id
    UNION ALL
    SELECT event_id FROM event.private_community_events WHERE event_id = target_event_id
    UNION ALL
    SELECT event_id FROM event.private_group_events WHERE event_id = target_event_id
  ) audiences;
  IF audience_count <> 1 THEN
    RAISE EXCEPTION 'event.events % must have exactly one audience row; found %', target_event_id, audience_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION event.check_event_audience_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM event.assert_event_audience(OLD.event_id);
  ELSIF TG_TABLE_NAME = 'events' THEN
    PERFORM event.assert_event_audience(NEW.id);
  ELSE
    PERFORM event.assert_event_audience(NEW.event_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS events_audience_guard ON event.events;
CREATE CONSTRAINT TRIGGER events_audience_guard
AFTER INSERT OR UPDATE ON event.events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION event.check_event_audience_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['public_events', 'private_community_events', 'private_group_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audience_guard ON event.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_audience_guard AFTER INSERT OR UPDATE OR DELETE ON event.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION event.check_event_audience_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS event.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES event.occurrences(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE (occurrence_id, user_id),
  CHECK ((status = 'registered' AND cancelled_at IS NULL) OR (status = 'cancelled' AND cancelled_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS event.organizers (
  event_id UUID NOT NULL REFERENCES event.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  organizer_role VARCHAR(40) NOT NULL DEFAULT 'organizer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event.speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name VARCHAR(160) NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event.event_speakers (
  event_id UUID NOT NULL REFERENCES event.events(id) ON DELETE CASCADE,
  speaker_id UUID NOT NULL REFERENCES event.speakers(id) ON DELETE CASCADE,
  speaker_role VARCHAR(40) NOT NULL DEFAULT 'speaker',
  position SMALLINT NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (event_id, speaker_id)
);

CREATE TABLE IF NOT EXISTS event.attendance (
  occurrence_id UUID NOT NULL REFERENCES event.occurrences(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkin_method VARCHAR(30) NOT NULL CHECK (checkin_method IN ('manual', 'qr', 'import')),
  PRIMARY KEY (occurrence_id, user_id)
);

CREATE TABLE IF NOT EXISTS event.access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event.events(id) ON DELETE CASCADE,
  rule_type VARCHAR(40) NOT NULL CHECK (rule_type IN ('membership', 'verified_profile', 'allowlist')),
  rule_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- moderation: typed reports, actions and sanctions
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  community_id UUID REFERENCES community.communities(id) ON DELETE RESTRICT,
  reason VARCHAR(500) NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation.report_post_targets (
  report_id UUID PRIMARY KEY REFERENCES moderation.reports(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES content.posts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS moderation.report_comment_targets (
  report_id UUID PRIMARY KEY REFERENCES moderation.reports(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES content.comments(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS moderation.report_event_targets (
  report_id UUID PRIMARY KEY REFERENCES moderation.reports(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES event.events(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS moderation.report_user_targets (
  report_id UUID PRIMARY KEY REFERENCES moderation.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION moderation.assert_report_target(target_report_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE target_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM moderation.reports WHERE id = target_report_id) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO target_count
  FROM (
    SELECT report_id FROM moderation.report_post_targets WHERE report_id = target_report_id
    UNION ALL
    SELECT report_id FROM moderation.report_comment_targets WHERE report_id = target_report_id
    UNION ALL
    SELECT report_id FROM moderation.report_event_targets WHERE report_id = target_report_id
    UNION ALL
    SELECT report_id FROM moderation.report_user_targets WHERE report_id = target_report_id
  ) targets;
  IF target_count <> 1 THEN
    RAISE EXCEPTION 'moderation.reports % must have exactly one target row; found %', target_report_id, target_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION moderation.check_report_target_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM moderation.assert_report_target(OLD.report_id);
  ELSIF TG_TABLE_NAME = 'reports' THEN
    PERFORM moderation.assert_report_target(NEW.id);
  ELSE
    PERFORM moderation.assert_report_target(NEW.report_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reports_target_guard ON moderation.reports;
CREATE CONSTRAINT TRIGGER reports_target_guard
AFTER INSERT OR UPDATE ON moderation.reports
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION moderation.check_report_target_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['report_post_targets', 'report_comment_targets', 'report_event_targets', 'report_user_targets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_target_guard ON moderation.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_target_guard AFTER INSERT OR UPDATE OR DELETE ON moderation.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION moderation.check_report_target_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS moderation.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES moderation.reports(id) ON DELETE RESTRICT,
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action_type VARCHAR(40) NOT NULL CHECK (action_type IN ('hide', 'restore', 'dismiss', 'suspend_member')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation.sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  community_id UUID REFERENCES community.communities(id) ON DELETE RESTRICT,
  sanction_type VARCHAR(40) NOT NULL CHECK (sanction_type IN ('suspend', 'posting_restriction', 'event_restriction')),
  reason TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS moderation.sanction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanction_id UUID NOT NULL REFERENCES moderation.sanctions(id) ON DELETE RESTRICT,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- verification: administrative person/skill/service verification
-- ============================================================
CREATE TABLE IF NOT EXISTS verification.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  verification_type VARCHAR(30) NOT NULL CHECK (verification_type IN ('person', 'skill', 'service')),
  status VARCHAR(25) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'revoked')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification.person_targets (
  request_id UUID PRIMARY KEY REFERENCES verification.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS verification.skill_targets (
  request_id UUID PRIMARY KEY REFERENCES verification.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  skill_id UUID NOT NULL REFERENCES profile.skills(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, skill_id) REFERENCES profile.user_skills(user_id, skill_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS verification.service_targets (
  request_id UUID PRIMARY KEY REFERENCES verification.requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES profile.services(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, service_id) REFERENCES profile.user_services(user_id, service_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION verification.assert_request_target(target_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE target_count INTEGER;
DECLARE expected_type VARCHAR(30);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM verification.requests WHERE id = target_request_id) THEN
    RETURN;
  END IF;
  SELECT verification_type INTO expected_type FROM verification.requests WHERE id = target_request_id;
  SELECT count(*) INTO target_count
  FROM (
    SELECT request_id FROM verification.person_targets WHERE request_id = target_request_id
    UNION ALL
    SELECT request_id FROM verification.skill_targets WHERE request_id = target_request_id
    UNION ALL
    SELECT request_id FROM verification.service_targets WHERE request_id = target_request_id
  ) targets;
  IF target_count <> 1 THEN
    RAISE EXCEPTION 'verification.requests % must have exactly one target row; found %', target_request_id, target_count;
  END IF;
  IF expected_type = 'person' AND NOT EXISTS (SELECT 1 FROM verification.person_targets WHERE request_id = target_request_id) THEN
    RAISE EXCEPTION 'verification request % type person has the wrong target type', target_request_id;
  ELSIF expected_type = 'skill' AND NOT EXISTS (SELECT 1 FROM verification.skill_targets WHERE request_id = target_request_id) THEN
    RAISE EXCEPTION 'verification request % type skill has the wrong target type', target_request_id;
  ELSIF expected_type = 'service' AND NOT EXISTS (SELECT 1 FROM verification.service_targets WHERE request_id = target_request_id) THEN
    RAISE EXCEPTION 'verification request % type service has the wrong target type', target_request_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION verification.check_request_target_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM verification.assert_request_target(OLD.request_id);
  ELSIF TG_TABLE_NAME = 'requests' THEN
    PERFORM verification.assert_request_target(NEW.id);
  ELSE
    PERFORM verification.assert_request_target(NEW.request_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS requests_target_guard ON verification.requests;
CREATE CONSTRAINT TRIGGER requests_target_guard
AFTER INSERT OR UPDATE ON verification.requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verification.check_request_target_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['person_targets', 'skill_targets', 'service_targets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_target_guard ON verification.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_target_guard AFTER INSERT OR UPDATE OR DELETE ON verification.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verification.check_request_target_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS verification.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES verification.requests(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 CHAR(64),
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES verification.requests(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('approve', 'reject', 'request_changes')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES verification.requests(id) ON DELETE RESTRICT,
  from_status VARCHAR(25),
  to_status VARCHAR(25) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  badge_type VARCHAR(30) NOT NULL CHECK (badge_type IN ('person', 'verified_skill', 'verified_service')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification.badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  badge_id UUID NOT NULL REFERENCES verification.badges(id) ON DELETE RESTRICT,
  verification_request_id UUID NOT NULL REFERENCES verification.requests(id) ON DELETE RESTRICT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (verification_request_id, badge_id)
);

CREATE TABLE IF NOT EXISTS verification.person_badge_targets (
  award_id UUID PRIMARY KEY REFERENCES verification.badge_awards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS verification.skill_badge_targets (
  award_id UUID PRIMARY KEY REFERENCES verification.badge_awards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  skill_id UUID NOT NULL REFERENCES profile.skills(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, skill_id) REFERENCES profile.user_skills(user_id, skill_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS verification.service_badge_targets (
  award_id UUID PRIMARY KEY REFERENCES verification.badge_awards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES profile.services(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id, service_id) REFERENCES profile.user_services(user_id, service_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION verification.assert_badge_award_target(target_award_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE target_count INTEGER;
DECLARE award_user UUID;
DECLARE badge_type_value VARCHAR(30);
DECLARE request_status_value VARCHAR(25);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM verification.badge_awards WHERE id = target_award_id) THEN
    RETURN;
  END IF;
  SELECT ba.user_id, b.badge_type, r.status INTO award_user, badge_type_value, request_status_value
  FROM verification.badge_awards ba
  JOIN verification.badges b ON b.id = ba.badge_id
  JOIN verification.requests r ON r.id = ba.verification_request_id
  WHERE ba.id = target_award_id;
  SELECT count(*) INTO target_count
  FROM (
    SELECT award_id FROM verification.person_badge_targets WHERE award_id = target_award_id
    UNION ALL
    SELECT award_id FROM verification.skill_badge_targets WHERE award_id = target_award_id
    UNION ALL
    SELECT award_id FROM verification.service_badge_targets WHERE award_id = target_award_id
  ) targets;
  IF target_count <> 1 THEN
    RAISE EXCEPTION 'verification.badge_awards % must have exactly one typed target; found %', target_award_id, target_count;
  END IF;
  IF request_status_value <> 'approved' THEN
    RAISE EXCEPTION 'verification.badge_awards % requires an approved request', target_award_id;
  END IF;
  IF EXISTS (SELECT 1 FROM verification.person_badge_targets WHERE award_id = target_award_id)
     AND badge_type_value <> 'person' THEN
    RAISE EXCEPTION 'verification.badge_awards % badge type does not match person target', target_award_id;
  END IF;
  IF EXISTS (SELECT 1 FROM verification.skill_badge_targets WHERE award_id = target_award_id)
     AND badge_type_value <> 'verified_skill' THEN
    RAISE EXCEPTION 'verification.badge_awards % badge type does not match skill target', target_award_id;
  END IF;
  IF EXISTS (SELECT 1 FROM verification.service_badge_targets WHERE award_id = target_award_id)
     AND badge_type_value <> 'verified_service' THEN
    RAISE EXCEPTION 'verification.badge_awards % badge type does not match service target', target_award_id;
  END IF;
  IF EXISTS (SELECT 1 FROM verification.person_badge_targets WHERE award_id = target_award_id AND user_id <> award_user)
     OR EXISTS (SELECT 1 FROM verification.skill_badge_targets WHERE award_id = target_award_id AND user_id <> award_user)
     OR EXISTS (SELECT 1 FROM verification.service_badge_targets WHERE award_id = target_award_id AND user_id <> award_user) THEN
    RAISE EXCEPTION 'verification.badge_awards % target user does not match award user', target_award_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION verification.check_badge_award_target_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM verification.assert_badge_award_target(OLD.award_id);
  ELSIF TG_TABLE_NAME = 'badge_awards' THEN
    PERFORM verification.assert_badge_award_target(NEW.id);
  ELSE
    PERFORM verification.assert_badge_award_target(NEW.award_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS badge_awards_target_guard ON verification.badge_awards;
CREATE CONSTRAINT TRIGGER badge_awards_target_guard
AFTER INSERT OR UPDATE ON verification.badge_awards
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verification.check_badge_award_target_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['person_badge_targets', 'skill_badge_targets', 'service_badge_targets'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_target_guard ON verification.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_target_guard AFTER INSERT OR UPDATE OR DELETE ON verification.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verification.check_badge_award_target_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

-- ============================================================
-- directory: future discovery and admin-managed listings
-- ============================================================
CREATE TABLE IF NOT EXISTS directory.expert_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  headline VARCHAR(180) NOT NULL,
  summary TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS directory.expert_listing_communities (
  listing_id UUID NOT NULL REFERENCES directory.expert_listings(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  visibility VARCHAR(30) NOT NULL DEFAULT 'community_only'
    CHECK (visibility IN ('public', 'members_only', 'community_only', 'admins_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, community_id)
);

CREATE TABLE IF NOT EXISTS directory.service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_service_id UUID NOT NULL REFERENCES profile.user_services(id) ON DELETE RESTRICT,
  headline VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS directory.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS directory.opportunity_communities (
  opportunity_id UUID NOT NULL REFERENCES directory.opportunities(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, community_id)
);

CREATE TABLE IF NOT EXISTS directory.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS directory.partnership_communities (
  partnership_id UUID NOT NULL REFERENCES directory.partnerships(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES community.communities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (partnership_id, community_id)
);

-- ============================================================
-- trust: contribution signals, points, badges, reputation
-- ============================================================
CREATE TABLE IF NOT EXISTS trust.signal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust.contribution_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  signal_type_id UUID NOT NULL REFERENCES trust.signal_types(id) ON DELETE RESTRICT,
  value NUMERIC(12,2) NOT NULL CHECK (value >= 0),
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust.signal_post_sources (
  signal_id UUID PRIMARY KEY REFERENCES trust.contribution_signals(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES content.posts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS trust.signal_comment_sources (
  signal_id UUID PRIMARY KEY REFERENCES trust.contribution_signals(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES content.comments(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS trust.signal_event_sources (
  signal_id UUID PRIMARY KEY REFERENCES trust.contribution_signals(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL REFERENCES event.occurrences(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS trust.signal_attendance_sources (
  signal_id UUID PRIMARY KEY REFERENCES trust.contribution_signals(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL,
  user_id UUID NOT NULL,
  FOREIGN KEY (occurrence_id, user_id) REFERENCES event.attendance(occurrence_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS trust.signal_moderation_sources (
  signal_id UUID PRIMARY KEY REFERENCES trust.contribution_signals(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES moderation.actions(id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION trust.assert_signal_source(target_signal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE source_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM trust.contribution_signals WHERE id = target_signal_id) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO source_count
  FROM (
    SELECT signal_id FROM trust.signal_post_sources WHERE signal_id = target_signal_id
    UNION ALL
    SELECT signal_id FROM trust.signal_comment_sources WHERE signal_id = target_signal_id
    UNION ALL
    SELECT signal_id FROM trust.signal_event_sources WHERE signal_id = target_signal_id
    UNION ALL
    SELECT signal_id FROM trust.signal_attendance_sources WHERE signal_id = target_signal_id
    UNION ALL
    SELECT signal_id FROM trust.signal_moderation_sources WHERE signal_id = target_signal_id
  ) sources;
  IF source_count <> 1 THEN
    RAISE EXCEPTION 'trust.contribution_signals % must have exactly one source row; found %', target_signal_id, source_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trust.check_signal_source_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM trust.assert_signal_source(OLD.signal_id);
  ELSIF TG_TABLE_NAME = 'contribution_signals' THEN
    PERFORM trust.assert_signal_source(NEW.id);
  ELSE
    PERFORM trust.assert_signal_source(NEW.signal_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contribution_signals_source_guard ON trust.contribution_signals;
CREATE CONSTRAINT TRIGGER contribution_signals_source_guard
AFTER INSERT OR UPDATE ON trust.contribution_signals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION trust.check_signal_source_trigger();

DO $$
DECLARE child_table TEXT;
BEGIN
  FOREACH child_table IN ARRAY ARRAY['signal_post_sources', 'signal_comment_sources', 'signal_event_sources', 'signal_attendance_sources', 'signal_moderation_sources'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_source_guard ON trust.%I', child_table, child_table);
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I_source_guard AFTER INSERT OR UPDATE OR DELETE ON trust.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION trust.check_signal_source_trigger()', child_table, child_table);
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS trust.point_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  signal_type_id UUID NOT NULL REFERENCES trust.signal_types(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS trust.point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  point_rule_id UUID REFERENCES trust.point_rules(id) ON DELETE SET NULL,
  source_signal_id UUID REFERENCES trust.contribution_signals(id) ON DELETE SET NULL,
  reversal_of_entry_id UUID REFERENCES trust.point_ledger(id) ON DELETE RESTRICT,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('grant', 'reversal', 'adjustment')),
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  badge_type VARCHAR(30) NOT NULL CHECK (badge_type IN ('contributor', 'event_participant', 'community_helper')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust.user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  badge_id UUID NOT NULL REFERENCES trust.badges(id) ON DELETE RESTRICT,
  source_signal_id UUID REFERENCES trust.contribution_signals(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS trust.reputation_snapshots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  as_of_date DATE NOT NULL,
  score NUMERIC(10,4) NOT NULL,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, as_of_date)
);

-- ============================================================
-- system: audit, notifications, outbox, jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS system.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id UUID,
  correlation_id UUID,
  request_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(180) UNIQUE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system.notification_posts (
  notification_id UUID PRIMARY KEY REFERENCES system.notifications(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES content.posts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS system.notification_events (
  notification_id UUID PRIMARY KEY REFERENCES system.notifications(id) ON DELETE CASCADE,
  occurrence_id UUID NOT NULL REFERENCES event.occurrences(id) ON DELETE RESTRICT,
  event_kind VARCHAR(30) NOT NULL CHECK (event_kind IN ('registered', 'cancelled', 'updated'))
);

CREATE TABLE IF NOT EXISTS system.notification_memberships (
  notification_id UUID PRIMARY KEY REFERENCES system.notifications(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES community.memberships(id) ON DELETE RESTRICT,
  decision VARCHAR(20) CHECK (decision IN ('active', 'rejected'))
);

CREATE TABLE IF NOT EXISTS system.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(120) NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  idempotency_key VARCHAR(180) NOT NULL UNIQUE,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system.job_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(100) NOT NULL,
  business_key VARCHAR(180),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  worker_id VARCHAR(120),
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_type, business_key)
);

-- ============================================================
-- Updated-at triggers
-- ============================================================
DO $$
DECLARE table_name TEXT;
DECLARE trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'auth.users', 'auth.user_phones', 'auth.identities',
    'profile.profiles', 'profile.profile_visibility', 'profile.experiences',
    'profile.educations', 'profile.certificates', 'profile.skills',
    'profile.user_skills', 'profile.services', 'profile.user_services',
    'community.communities', 'community.community_settings', 'community.rules',
    'community.memberships', 'community.membership_requests', 'community.groups',
    'community.group_memberships', 'community.community_creation_requests',
    'content.channels', 'content.channel_policies', 'content.posts', 'content.comments',
    'content.post_visibility', 'event.events', 'event.occurrences', 'event.access_rules',
    'moderation.reports', 'verification.requests', 'directory.expert_listings',
    'directory.service_listings', 'directory.opportunities', 'directory.partnerships',
    'system.job_records'
  ] LOOP
    trigger_name := replace(replace(table_name, '.', '_'), '"', '') || '_updated_at';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', trigger_name, table_name);
  END LOOP;
END;
$$;

-- ============================================================
-- Indexes: PostgreSQL indexes PK/UK automatically, not child FKs.
-- ============================================================
CREATE INDEX IF NOT EXISTS auth_sessions_user_expiry_idx ON auth.sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS auth_verification_user_expiry_idx ON auth.email_verification_tokens(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS auth_reset_user_expiry_idx ON auth.password_reset_tokens(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS community_memberships_user_status_idx ON community.memberships(user_id, status);
CREATE INDEX IF NOT EXISTS community_memberships_community_status_idx ON community.memberships(community_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS community_membership_requests_pending_idx ON community.membership_requests(community_id, user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS community_group_memberships_user_status_idx ON community.group_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS community_group_memberships_group_status_idx ON community.group_memberships(group_id, status);
CREATE INDEX IF NOT EXISTS content_community_posts_feed_idx ON content.community_posts(community_id, post_id);
CREATE INDEX IF NOT EXISTS content_group_posts_feed_idx ON content.group_posts(group_id, post_id);
CREATE INDEX IF NOT EXISTS content_channel_posts_feed_idx ON content.channel_posts(channel_id, post_id);
CREATE INDEX IF NOT EXISTS content_comments_post_created_idx ON content.comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS content_reactions_user_idx ON content.reactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_occurrences_start_idx ON event.occurrences(starts_at ASC, status);
CREATE INDEX IF NOT EXISTS event_registrations_user_idx ON event.registrations(user_id, status);
CREATE INDEX IF NOT EXISTS moderation_open_reports_idx ON moderation.reports(created_at ASC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS moderation_report_community_idx ON moderation.reports(community_id, status, created_at);
CREATE INDEX IF NOT EXISTS verification_requests_user_status_idx ON verification.requests(requested_by, status);
CREATE INDEX IF NOT EXISTS verification_requests_status_idx ON verification.requests(status, submitted_at);
CREATE INDEX IF NOT EXISTS directory_expert_status_idx ON directory.expert_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS trust_contribution_user_time_idx ON trust.contribution_signals(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS trust_point_ledger_user_time_idx ON trust.point_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS system_notifications_user_read_idx ON system.notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS system_audit_resource_idx ON system.audit_events(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS system_outbox_pending_idx ON system.outbox_events(available_at, created_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS system_jobs_claim_idx ON system.job_records(status, locked_until, created_at);

-- ============================================================
-- Read models and effective access
-- ============================================================
CREATE OR REPLACE VIEW community.effective_group_access AS
SELECT gm.group_id, gm.user_id, gm.status
FROM community.group_memberships gm
WHERE gm.status = 'active'
UNION
SELECT g.id AS group_id, m.user_id, 'inherited'::VARCHAR(25) AS status
FROM community.groups g
JOIN community.memberships m ON m.community_id = g.community_id AND m.status = 'active'
WHERE g.status = 'active';

CREATE OR REPLACE VIEW content.post_feed AS
SELECT p.id, p.author_id, p.body, p.status, p.created_at, p.updated_at,
       'community'::TEXT AS scope_type, cp.community_id AS scope_id
FROM content.posts p JOIN content.community_posts cp ON cp.post_id = p.id
UNION ALL
SELECT p.id, p.author_id, p.body, p.status, p.created_at, p.updated_at,
       'group'::TEXT AS scope_type, gp.group_id AS scope_id
FROM content.posts p JOIN content.group_posts gp ON gp.post_id = p.id
UNION ALL
SELECT p.id, p.author_id, p.body, p.status, p.created_at, p.updated_at,
       'channel'::TEXT AS scope_type, ch.channel_id AS scope_id
FROM content.posts p JOIN content.channel_posts ch ON ch.post_id = p.id;

CREATE OR REPLACE VIEW event.catalog AS
SELECT e.id, e.title, e.description, e.status, e.created_by, e.created_at, e.updated_at,
       o.id AS occurrence_id, o.sequence_no, o.starts_at, o.ends_at, o.timezone,
       o.zoom_url_ciphertext, o.zoom_url_iv, o.zoom_url_auth_tag, o.status AS occurrence_status,
       'public'::TEXT AS visibility, NULL::UUID AS community_id, NULL::UUID AS group_id
FROM event.events e
JOIN event.occurrences o ON o.event_id = e.id AND o.sequence_no = 1
JOIN event.public_events pe ON pe.event_id = e.id
UNION ALL
SELECT e.id, e.title, e.description, e.status, e.created_by, e.created_at, e.updated_at,
       o.id, o.sequence_no, o.starts_at, o.ends_at, o.timezone,
       o.zoom_url_ciphertext, o.zoom_url_iv, o.zoom_url_auth_tag, o.status,
       'private'::TEXT, pce.community_id, NULL::UUID
FROM event.events e
JOIN event.occurrences o ON o.event_id = e.id AND o.sequence_no = 1
JOIN event.private_community_events pce ON pce.event_id = e.id
UNION ALL
SELECT e.id, e.title, e.description, e.status, e.created_by, e.created_at, e.updated_at,
       o.id, o.sequence_no, o.starts_at, o.ends_at, o.timezone,
       o.zoom_url_ciphertext, o.zoom_url_iv, o.zoom_url_auth_tag, o.status,
       'private'::TEXT, g.community_id, pge.group_id
FROM event.events e
JOIN event.occurrences o ON o.event_id = e.id AND o.sequence_no = 1
JOIN event.private_group_events pge ON pge.event_id = e.id
JOIN community.groups g ON g.id = pge.group_id;

CREATE OR REPLACE VIEW moderation.report_queue AS
SELECT r.id, r.reporter_id, COALESCE(r.community_id, pf.scope_id) AS community_id, r.reason, r.status, r.created_at, r.updated_at,
       'post'::TEXT AS target_type, rpt.post_id AS target_id
FROM moderation.reports r
JOIN moderation.report_post_targets rpt ON rpt.report_id = r.id
JOIN content.post_feed pf ON pf.id = rpt.post_id
UNION ALL
SELECT r.id, r.reporter_id, COALESCE(r.community_id, pf.scope_id), r.reason, r.status, r.created_at, r.updated_at,
       'comment'::TEXT, rct.comment_id
FROM moderation.reports r
JOIN moderation.report_comment_targets rct ON rct.report_id = r.id
JOIN content.comments c ON c.id = rct.comment_id
JOIN content.post_feed pf ON pf.id = c.post_id
UNION ALL
SELECT r.id, r.reporter_id, COALESCE(r.community_id, ec.community_id), r.reason, r.status, r.created_at, r.updated_at,
       'event'::TEXT, ret.event_id
FROM moderation.reports r
JOIN moderation.report_event_targets ret ON ret.report_id = r.id
JOIN event.catalog ec ON ec.id = ret.event_id
UNION ALL
SELECT r.id, r.reporter_id, r.community_id, r.reason, r.status, r.created_at, r.updated_at,
       'user'::TEXT, rut.user_id
FROM moderation.reports r
JOIN moderation.report_user_targets rut ON rut.report_id = r.id;
