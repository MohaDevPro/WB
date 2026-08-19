import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { DatabaseClient } from '../database/database.types.js';
import type { AuthenticatedIdentity } from '../identity/identity-context.js';

export type PlatformHome = Readonly<{
  communities: readonly CommunitySummary[];
  discussions: readonly DiscussionSummary[];
  events: readonly EventSummary[];
  opportunities: readonly OpportunitySummary[];
  services: readonly ServiceSummary[];
}>;

export type CommunitySummary = Readonly<{
  id: string;
  memberCount: number;
  name: string;
  slug: string;
  summary: string;
  visibility: string;
}>;

export type DiscussionSummary = Readonly<{
  authorName: string;
  body: string;
  communityName: string;
  createdAt: string;
  id: string;
  reactionCount: number;
  title: string;
}>;

export type EventSummary = Readonly<{
  capacity: number | null;
  description: string;
  id: string;
  location: string | null;
  registrationState: string;
  startsAt: string;
  title: string;
  type: string;
}>;

export type OpportunitySummary = Readonly<{
  description: string;
  id: string;
  title: string;
  type: string;
}>;

export type ServiceSummary = Readonly<{
  currency: string;
  description: string;
  id: string;
  priceMinor: number | null;
  title: string;
}>;

export type NotificationSummary = Readonly<{
  body: string;
  createdAt: string;
  href: string | null;
  id: string;
  readAt: string | null;
  title: string;
}>;

export type OrganizationSummary = Readonly<{
  description: string | null;
  id: string;
  memberCount: number;
  name: string;
  slug: string;
}>;

export type ExpertSummary = Readonly<{
  availability: string;
  displayName: string;
  headline: string;
  isVerified: boolean;
  specialties: readonly string[];
  userId: string;
}>;

export type LearningPathSummary = Readonly<{
  id: string;
  moduleCount: number;
  summary: string;
  title: string;
}>;

export type ServiceRequestSummary = Readonly<{
  createdAt: string;
  id: string;
  message: string;
  priceMinor: number | null;
  serviceTitle: string;
  status: string;
}>;

export type PaymentIntentSummary = Readonly<{
  amountMinor: number;
  currency: string;
  id: string;
  provider: string;
  serviceRequestId: string;
  status: string;
}>;

export type ReviewSummary = Readonly<{
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  rating: number;
  serviceRequestId: string;
}>;

export type SearchResult = Readonly<{
  description: string;
  id: string;
  title: string;
  type: 'community' | 'event' | 'expert' | 'learning_path' | 'opportunity' | 'service';
}>;

export type AssistantGuidance = Readonly<{
  answer: string;
  citations: readonly SearchResult[];
  taskId: string;
}>;

export type WorkflowSummary = Readonly<{
  createdAt: string;
  id: string;
  resultSummary: string | null;
  status: string;
  workflowType: string;
}>;

export type FederationLinkSummary = Readonly<{
  id: string;
  remoteBaseUrl: string;
  remoteCommunityKey: string;
  status: string;
  trustLevel: string;
}>;

export type InputRecord = Readonly<Record<string, unknown>>;

type InternalUser = Readonly<{ id: string }>;

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return normalized.length >= 3 ? normalized.slice(0, 80) : `wb-${Date.now().toString(36)}`;
}

function requiredString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string') {
    throw new ConflictException(`${field} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > maximum) {
    throw new ConflictException(`${field} must contain between 1 and ${maximum} characters.`);
  }

  return normalized;
}

function optionalString(value: unknown, field: string, maximum: number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requiredString(value, field, maximum);
}

function optionalNonNegativeInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ConflictException(`${field} must be a non-negative integer.`);
  }
  return value;
}

function toStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  return Object.freeze(value.filter((entry): entry is string => typeof entry === 'string'));
}

function requiredStringArray(
  value: unknown,
  field: string,
  maximumItems: number,
  maximumLength: number,
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumItems) {
    throw new ConflictException(`${field} must contain between 1 and ${maximumItems} items.`);
  }

  return Object.freeze(
    value.map((entry, index) => requiredString(entry, `${field}[${index}]`, maximumLength)),
  );
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

@Injectable()
export class PlatformService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getHome(): Promise<PlatformHome> {
    await this.ensureSeedData();

    const [communities, discussions, events, opportunities, services] = await Promise.all([
      this.listCommunities(),
      this.listDiscussions(),
      this.listEvents(),
      this.listOpportunities(),
      this.listServices(),
    ]);

    return Object.freeze({ communities, discussions, events, opportunities, services });
  }

  async listCommunities(): Promise<readonly CommunitySummary[]> {
    await this.ensureSeedData();
    const rows = await this.database.query<{
      id: string;
      member_count: number;
      name: string;
      slug: string;
      summary: string;
      visibility: string;
    }>(`
      SELECT
        communities.id,
        communities.slug,
        communities.name,
        communities.summary,
        communities.visibility,
        COUNT(community_memberships.user_id)::integer AS member_count
      FROM communities
      LEFT JOIN community_memberships ON community_memberships.community_id = communities.id
      GROUP BY communities.id
      ORDER BY communities.created_at ASC
    `);

    return Object.freeze(
      rows.rows.map((row) =>
        Object.freeze({
          id: row.id,
          memberCount: Number(row.member_count),
          name: row.name,
          slug: row.slug,
          summary: row.summary,
          visibility: row.visibility,
        }),
      ),
    );
  }

  async createCommunity(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<CommunitySummary> {
    const name = requiredString(body.name, 'name', 160);
    const summary = requiredString(body.summary, 'summary', 500);
    const requestedSlug = optionalString(body.slug, 'slug', 80);
    const visibility = body.visibility === 'private' ? 'private' : 'public';

    return this.database.withTransaction(async (client) => {
      const owner = await this.requireUser(client, identity);
      const slug = requestedSlug === undefined ? slugify(name) : slugify(requestedSlug);
      const inserted = await client.query<{
        id: string;
        name: string;
        slug: string;
        summary: string;
        visibility: string;
      }>(
        `
          INSERT INTO communities (slug, name, summary, visibility, owner_user_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, slug, name, summary, visibility
        `,
        [slug, name, summary, visibility, owner.id],
      );
      const community = inserted.rows[0];

      if (community === undefined) {
        throw new Error('Community creation did not return a resource.');
      }

      await client.query(
        "INSERT INTO community_memberships (community_id, user_id, role) VALUES ($1, $2, 'owner')",
        [community.id, owner.id],
      );
      await this.audit(client, owner.id, 'community.created', 'community', community.id);

      return Object.freeze({ ...community, memberCount: 1 });
    });
  }

  async joinCommunity(
    identity: AuthenticatedIdentity,
    slug: string,
  ): Promise<Readonly<{ joined: true }>> {
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const community = await client.query<{ id: string }>(
        'SELECT id FROM communities WHERE slug = $1',
        [slug],
      );
      const communityId = community.rows[0]?.id;

      if (communityId === undefined) {
        throw new NotFoundException('Community not found.');
      }

      await client.query(
        "INSERT INTO community_memberships (community_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
        [communityId, user.id],
      );
      await this.createNotification(
        client,
        user.id,
        'community.joined',
        'Community membership updated',
        'You are now part of the community.',
        `/communities/${slug}`,
      );
      await this.audit(client, user.id, 'community.joined', 'community', communityId);
      return Object.freeze({ joined: true });
    });
  }

  async listDiscussions(communitySlug?: string): Promise<readonly DiscussionSummary[]> {
    await this.ensureSeedData();
    const rows = await this.database.query<{
      author_name: string;
      body: string;
      community_name: string;
      created_at: Date | string;
      id: string;
      reaction_count: number;
      title: string;
    }>(
      `
        SELECT
          discussions.id,
          discussions.title,
          discussions.body,
          discussions.created_at,
          communities.name AS community_name,
          COALESCE(profiles.display_name, 'WB member') AS author_name,
          COUNT(discussion_reactions.user_id)::integer AS reaction_count
        FROM discussions
        INNER JOIN communities ON communities.id = discussions.community_id
        LEFT JOIN profiles ON profiles.user_id = discussions.author_user_id
        LEFT JOIN discussion_reactions ON discussion_reactions.discussion_id = discussions.id
        WHERE discussions.status = 'published' AND ($1::text IS NULL OR communities.slug = $1)
        GROUP BY discussions.id, communities.name, profiles.display_name
        ORDER BY discussions.created_at DESC
      `,
      [communitySlug ?? null],
    );

    return Object.freeze(
      rows.rows.map((row) =>
        Object.freeze({
          authorName: row.author_name,
          body: row.body,
          communityName: row.community_name,
          createdAt: toIso(row.created_at),
          id: row.id,
          reactionCount: Number(row.reaction_count),
          title: row.title,
        }),
      ),
    );
  }

  async createDiscussion(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<DiscussionSummary> {
    const communitySlug = requiredString(body.communitySlug, 'communitySlug', 80);
    const title = requiredString(body.title, 'title', 240);
    const message = requiredString(body.body, 'body', 12_000);

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const community = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM communities WHERE slug = $1',
        [communitySlug],
      );
      const communityRow = community.rows[0];

      if (communityRow === undefined) {
        throw new NotFoundException('Community not found.');
      }

      const membership = await client.query<{ community_id: string }>(
        'SELECT community_id FROM community_memberships WHERE community_id = $1 AND user_id = $2',
        [communityRow.id, user.id],
      );

      if (membership.rowCount === 0) {
        throw new ForbiddenException('Join the community before creating a discussion.');
      }

      const created = await client.query<{ created_at: Date | string; id: string }>(
        `
          INSERT INTO discussions (community_id, author_user_id, title, body)
          VALUES ($1, $2, $3, $4)
          RETURNING id, created_at
        `,
        [communityRow.id, user.id, title, message],
      );
      const row = created.rows[0];

      if (row === undefined) {
        throw new Error('Discussion creation did not return a resource.');
      }

      await this.audit(client, user.id, 'discussion.created', 'discussion', row.id);
      return Object.freeze({
        authorName: await this.displayName(client, user.id),
        body: message,
        communityName: communityRow.name,
        createdAt: toIso(row.created_at),
        id: row.id,
        reactionCount: 0,
        title,
      });
    });
  }

  async reactToDiscussion(
    identity: AuthenticatedIdentity,
    discussionId: string,
  ): Promise<Readonly<{ reacted: true }>> {
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      await client.query(
        "INSERT INTO discussion_reactions (discussion_id, user_id, reaction) VALUES ($1, $2, 'helpful') ON CONFLICT DO NOTHING",
        [discussionId, user.id],
      );
      await this.audit(client, user.id, 'discussion.reacted', 'discussion', discussionId);
      return Object.freeze({ reacted: true });
    });
  }

  async listEvents(): Promise<readonly EventSummary[]> {
    await this.ensureSeedData();
    const rows = await this.database.query<{
      capacity: number | null;
      description: string;
      event_type: string;
      id: string;
      location: string | null;
      registration_state: string;
      starts_at: Date | string;
      title: string;
    }>(`
      SELECT id, title, description, event_type, location, starts_at, capacity, registration_state
      FROM events
      WHERE registration_state IN ('open', 'closed')
      ORDER BY starts_at ASC
    `);

    return Object.freeze(
      rows.rows.map((row) =>
        Object.freeze({
          capacity: row.capacity,
          description: row.description,
          id: row.id,
          location: row.location,
          registrationState: row.registration_state,
          startsAt: toIso(row.starts_at),
          title: row.title,
          type: row.event_type,
        }),
      ),
    );
  }

  async createEvent(identity: AuthenticatedIdentity, body: InputRecord): Promise<EventSummary> {
    const title = requiredString(body.title, 'title', 240);
    const description = requiredString(body.description, 'description', 6_000);
    const eventType = body.type === 'online' || body.type === 'hybrid' ? body.type : 'physical';
    const startsAt = requiredString(body.startsAt, 'startsAt', 64);
    const endsAt = requiredString(body.endsAt, 'endsAt', 64);
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw new ConflictException('Event dates must be valid and ordered.');
    }

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const created = await client.query<{
        capacity: number | null;
        description: string;
        event_type: string;
        id: string;
        location: string | null;
        registration_state: string;
        starts_at: Date | string;
        title: string;
      }>(
        `
          INSERT INTO events (owner_user_id, title, description, event_type, location, starts_at, ends_at, capacity, registration_state)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
          RETURNING id, title, description, event_type, location, starts_at, capacity, registration_state
        `,
        [
          user.id,
          title,
          description,
          eventType,
          optionalString(body.location, 'location', 240) ?? null,
          startsAt,
          endsAt,
          body.capacity ?? null,
        ],
      );
      const row = created.rows[0];

      if (row === undefined) {
        throw new Error('Event creation did not return a resource.');
      }

      await this.audit(client, user.id, 'event.created', 'event', row.id);
      return Object.freeze({
        capacity: row.capacity,
        description: row.description,
        id: row.id,
        location: row.location,
        registrationState: row.registration_state,
        startsAt: toIso(row.starts_at),
        title: row.title,
        type: row.event_type,
      });
    });
  }

  async registerForEvent(
    identity: AuthenticatedIdentity,
    eventId: string,
  ): Promise<Readonly<{ status: string }>> {
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const event = await client.query<{ capacity: number | null; registration_state: string }>(
        'SELECT capacity, registration_state FROM events WHERE id = $1 FOR UPDATE',
        [eventId],
      );
      const eventRow = event.rows[0];

      if (eventRow === undefined || eventRow.registration_state !== 'open') {
        throw new ConflictException('Event registration is not available.');
      }

      const registrations = await client.query<{ count: number }>(
        "SELECT COUNT(*)::integer AS count FROM event_registrations WHERE event_id = $1 AND status = 'registered'",
        [eventId],
      );
      const registrationCount = Number(registrations.rows[0]?.count ?? 0);
      const status =
        eventRow.capacity !== null && registrationCount >= eventRow.capacity
          ? 'waitlisted'
          : 'registered';

      await client.query(
        `
          INSERT INTO event_registrations (event_id, user_id, status)
          VALUES ($1, $2, $3)
          ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()
        `,
        [eventId, user.id, status],
      );
      await this.createNotification(
        client,
        user.id,
        'event.registration',
        'Event registration updated',
        `Your registration is ${status}.`,
        `/events/${eventId}`,
      );
      await this.audit(client, user.id, 'event.registered', 'event', eventId, { status });
      return Object.freeze({ status });
    });
  }

  async listOpportunities(): Promise<readonly OpportunitySummary[]> {
    await this.ensureSeedData();
    const rows = await this.database.query<{
      description: string;
      id: string;
      opportunity_type: string;
      title: string;
    }>(
      `SELECT id, title, description, opportunity_type FROM opportunities WHERE status = 'open' ORDER BY created_at DESC`,
    );

    return Object.freeze(
      rows.rows.map((row) =>
        Object.freeze({
          id: row.id,
          title: row.title,
          description: row.description,
          type: row.opportunity_type,
        }),
      ),
    );
  }

  async listServices(): Promise<readonly ServiceSummary[]> {
    await this.ensureSeedData();
    const rows = await this.database.query<{
      currency: string;
      description: string;
      id: string;
      price_minor: number | null;
      title: string;
    }>(
      `SELECT id, title, description, price_minor, currency FROM services WHERE status = 'published' ORDER BY created_at DESC`,
    );

    return Object.freeze(
      rows.rows.map((row) =>
        Object.freeze({
          currency: row.currency,
          description: row.description,
          id: row.id,
          priceMinor: row.price_minor,
          title: row.title,
        }),
      ),
    );
  }

  async createService(identity: AuthenticatedIdentity, body: InputRecord): Promise<ServiceSummary> {
    const title = requiredString(body.title, 'title', 240);
    const description = requiredString(body.description, 'description', 8_000);
    const priceMinor = optionalNonNegativeInteger(body.priceMinor, 'priceMinor');
    if (body.currency !== undefined && body.currency !== 'SAR') {
      throw new ConflictException('Only SAR is currently supported for service pricing.');
    }

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const created = await client.query<{
        currency: string;
        description: string;
        id: string;
        price_minor: number | null;
        title: string;
      }>(
        `INSERT INTO services (provider_user_id, title, description, price_minor, currency)
         VALUES ($1, $2, $3, $4, 'SAR')
         RETURNING id, title, description, price_minor, currency`,
        [user.id, title, description, priceMinor],
      );
      const service = created.rows[0];
      if (service === undefined) {
        throw new Error('Service creation did not return a resource.');
      }
      await this.audit(client, user.id, 'service.created', 'service', service.id, {
        priceMinor: priceMinor === null ? 'custom_quote' : String(priceMinor),
      });
      return Object.freeze({
        currency: service.currency,
        description: service.description,
        id: service.id,
        priceMinor: service.price_minor,
        title: service.title,
      });
    });
  }

  async requestService(
    identity: AuthenticatedIdentity,
    serviceId: string,
    body: InputRecord,
  ): Promise<Readonly<{ id: string; status: string }>> {
    const message = requiredString(body.message, 'message', 5_000);
    const idempotencyKey = requiredString(body.idempotencyKey, 'idempotencyKey', 128);

    return this.database.withTransaction(async (client) => {
      const requester = await this.requireUser(client, identity);
      const service = await client.query<{ provider_user_id: string }>(
        'SELECT provider_user_id FROM services WHERE id = $1 AND status = $2',
        [serviceId, 'published'],
      );
      const row = service.rows[0];

      if (row === undefined) {
        throw new NotFoundException('Service not found.');
      }

      const created = await client.query<{ id: string; status: string }>(
        `
          INSERT INTO service_requests (service_id, requester_user_id, provider_user_id, message, idempotency_key)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (idempotency_key) DO UPDATE SET message = service_requests.message
          RETURNING id, status
        `,
        [serviceId, requester.id, row.provider_user_id, message, idempotencyKey],
      );
      const request = created.rows[0];

      if (request === undefined) {
        throw new Error('Service request did not return a resource.');
      }

      await this.createNotification(
        client,
        row.provider_user_id,
        'service.request',
        'New service request',
        'A member requested your service.',
        `/requests/${request.id}`,
      );
      await this.audit(client, requester.id, 'service.requested', 'service_request', request.id);
      return Object.freeze(request);
    });
  }

  async listNotifications(
    identity: AuthenticatedIdentity,
  ): Promise<readonly NotificationSummary[]> {
    const user = await this.resolveUser(identity);
    const rows = await this.database.query<{
      body: string;
      created_at: Date | string;
      href: string | null;
      id: string;
      read_at: Date | string | null;
      title: string;
    }>(
      `
        SELECT id, title, body, href, read_at, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [user.id],
    );

    return Object.freeze(
      rows.rows.map((row) =>
        Object.freeze({
          body: row.body,
          createdAt: toIso(row.created_at),
          href: row.href,
          id: row.id,
          readAt: row.read_at === null ? null : toIso(row.read_at),
          title: row.title,
        }),
      ),
    );
  }

  async submitReport(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<Readonly<{ id: string; status: string }>> {
    const resourceType = requiredString(body.resourceType, 'resourceType', 32);
    const resourceId = requiredString(body.resourceId, 'resourceId', 64);
    const reason = requiredString(body.reason, 'reason', 1_000);

    return this.database.withTransaction(async (client) => {
      const reporter = await this.requireUser(client, identity);
      const report = await client.query<{ id: string; status: string }>(
        `INSERT INTO reports (reporter_user_id, resource_type, resource_id, reason) VALUES ($1, $2, $3::uuid, $4) RETURNING id, status`,
        [reporter.id, resourceType, resourceId, reason],
      );
      const row = report.rows[0];

      if (row === undefined) {
        throw new Error('Report creation did not return a resource.');
      }

      await this.audit(client, reporter.id, 'report.submitted', 'report', row.id);
      return Object.freeze(row);
    });
  }

  async getRecommendations(
    identity: AuthenticatedIdentity,
  ): Promise<readonly Readonly<{ reason: string; resourceId: string; type: string }>[]> {
    const user = await this.resolveUser(identity);
    const existing = await this.database.query<{
      reason: string;
      resource_id: string;
      recommendation_type: string;
    }>(
      `SELECT recommendation_type, resource_id, reason FROM recommendation_snapshots WHERE user_id = $1 ORDER BY score DESC LIMIT 12`,
      [user.id],
    );

    if (existing.rowCount !== 0) {
      return Object.freeze(
        existing.rows.map((row) =>
          Object.freeze({
            reason: row.reason,
            resourceId: row.resource_id,
            type: row.recommendation_type,
          }),
        ),
      );
    }

    const communities = await this.listCommunities();
    return Object.freeze(
      communities.slice(0, 3).map((community) =>
        Object.freeze({
          reason: `A strong starting place for professional collaboration: ${community.summary}`,
          resourceId: community.id,
          type: 'community',
        }),
      ),
    );
  }

  async createAiTask(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<Readonly<{ id: string; status: string }>> {
    const taskType =
      body.taskType === 'moderation' || body.taskType === 'recommendation'
        ? body.taskType
        : 'summary';
    const user = await this.resolveUser(identity);
    const created = await this.database.query<{ id: string; status: string }>(
      `
        INSERT INTO ai_tasks (requested_by, task_type, input_scope, status, output_summary, approval_required, completed_at)
        VALUES ($1, $2, $3::jsonb, 'completed', $4, TRUE, now())
        RETURNING id, status
      `,
      [
        user.id,
        taskType,
        JSON.stringify({ source: 'local-safe-demo' }),
        'AI tasks are safely scoped and require human review before consequential actions.',
      ],
    );
    const row = created.rows[0];

    if (row === undefined) {
      throw new Error('AI task creation did not return a resource.');
    }

    await this.database.withTransaction((client) =>
      this.audit(client, user.id, 'ai.task.completed', 'ai_task', row.id, { taskType }),
    );
    return Object.freeze(row);
  }

  async createWorkflow(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<Readonly<{ id: string; status: string }>> {
    const workflowType =
      body.workflowType === 'event_follow_up' || body.workflowType === 'opportunity_match'
        ? body.workflowType
        : 'community_digest';
    const user = await this.resolveUser(identity);
    const created = await this.database.query<{ id: string; status: string }>(
      `INSERT INTO workflow_runs (requested_by, workflow_type, input_scope) VALUES ($1, $2, $3::jsonb) RETURNING id, status`,
      [user.id, workflowType, JSON.stringify({ source: 'member-request' })],
    );
    const row = created.rows[0];

    if (row === undefined) {
      throw new Error('Workflow creation did not return a resource.');
    }

    await this.database.withTransaction((client) =>
      this.audit(client, user.id, 'workflow.requested', 'workflow_run', row.id, { workflowType }),
    );
    return Object.freeze(row);
  }

  async listOrganizations(): Promise<readonly OrganizationSummary[]> {
    await this.ensureEcosystemSeedData();
    const result = await this.database.query<{
      description: string | null;
      id: string;
      member_count: number;
      name: string;
      slug: string;
    }>(`
      SELECT organizations.id, organizations.slug, organizations.name, organizations.description,
        COUNT(organization_memberships.user_id)::integer AS member_count
      FROM organizations
      LEFT JOIN organization_memberships ON organization_memberships.organization_id = organizations.id
      GROUP BY organizations.id
      ORDER BY organizations.created_at DESC
    `);

    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          description: row.description,
          id: row.id,
          memberCount: Number(row.member_count),
          name: row.name,
          slug: row.slug,
        }),
      ),
    );
  }

  async createOrganization(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<OrganizationSummary> {
    const name = requiredString(body.name, 'name', 160);
    const description = optionalString(body.description, 'description', 2_000) ?? null;
    const requestedSlug = optionalString(body.slug, 'slug', 80);

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const created = await client.query<{
        description: string | null;
        id: string;
        name: string;
        slug: string;
      }>(
        `INSERT INTO organizations (slug, name, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, slug, name, description`,
        [
          requestedSlug === undefined ? slugify(name) : slugify(requestedSlug),
          name,
          description,
          user.id,
        ],
      );
      const organization = created.rows[0];

      if (organization === undefined) {
        throw new Error('Organization creation did not return a resource.');
      }

      await client.query(
        "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1, $2, 'owner')",
        [organization.id, user.id],
      );
      await this.audit(client, user.id, 'organization.created', 'organization', organization.id);
      return Object.freeze({ ...organization, memberCount: 1 });
    });
  }

  async listExperts(): Promise<readonly ExpertSummary[]> {
    await this.ensureEcosystemSeedData();
    const result = await this.database.query<{
      availability: string;
      display_name: string;
      headline: string;
      is_verified: boolean;
      specialties: unknown;
      user_id: string;
    }>(`
      SELECT expert_profiles.user_id, expert_profiles.headline, expert_profiles.specialties,
        expert_profiles.is_verified, expert_profiles.availability, profiles.display_name
      FROM expert_profiles
      INNER JOIN profiles ON profiles.user_id = expert_profiles.user_id
      WHERE expert_profiles.availability <> 'unavailable'
      ORDER BY expert_profiles.is_verified DESC, expert_profiles.updated_at DESC
    `);

    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          availability: row.availability,
          displayName: row.display_name,
          headline: row.headline,
          isVerified: row.is_verified,
          specialties: toStringArray(row.specialties),
          userId: row.user_id,
        }),
      ),
    );
  }

  async updateExpertProfile(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<ExpertSummary> {
    const headline = requiredString(body.headline, 'headline', 180);
    const availability =
      body.availability === 'limited' || body.availability === 'unavailable'
        ? body.availability
        : 'open';
    const specialties = requiredStringArray(body.specialties, 'specialties', 12, 80);

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      await client.query(
        `INSERT INTO expert_profiles (user_id, headline, specialties, availability)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (user_id) DO UPDATE SET headline = EXCLUDED.headline, specialties = EXCLUDED.specialties,
           availability = EXCLUDED.availability, updated_at = now()`,
        [user.id, headline, JSON.stringify(specialties), availability],
      );
      await this.audit(client, user.id, 'expert_profile.updated', 'expert_profile', user.id);
      return Object.freeze({
        availability,
        displayName: await this.displayName(client, user.id),
        headline,
        isVerified: false,
        specialties,
        userId: user.id,
      });
    });
  }

  async listLearningPaths(): Promise<readonly LearningPathSummary[]> {
    await this.ensureEcosystemSeedData();
    const result = await this.database.query<{
      id: string;
      module_count: number;
      summary: string;
      title: string;
    }>(`
      SELECT learning_paths.id, learning_paths.title, learning_paths.summary,
        COUNT(learning_modules.id)::integer AS module_count
      FROM learning_paths
      LEFT JOIN learning_modules ON learning_modules.learning_path_id = learning_paths.id
      WHERE learning_paths.status = 'published' AND learning_paths.visibility = 'public'
      GROUP BY learning_paths.id
      ORDER BY learning_paths.created_at DESC
    `);

    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          id: row.id,
          moduleCount: Number(row.module_count),
          summary: row.summary,
          title: row.title,
        }),
      ),
    );
  }

  async createLearningPath(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<LearningPathSummary> {
    const title = requiredString(body.title, 'title', 240);
    const summary = requiredString(body.summary, 'summary', 2_000);
    const visibility = body.visibility === 'private' ? 'private' : 'public';
    const moduleInputs = Array.isArray(body.modules) ? body.modules : [];

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const created = await client.query<{ id: string; summary: string; title: string }>(
        `INSERT INTO learning_paths (owner_user_id, title, summary, visibility)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, summary`,
        [user.id, title, summary, visibility],
      );
      const path = created.rows[0];

      if (path === undefined) {
        throw new Error('Learning path creation did not return a resource.');
      }

      let moduleCount = 0;
      for (const [index, candidate] of moduleInputs.entries()) {
        if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
          throw new ConflictException('Each module must be an object.');
        }
        const module = candidate as Record<string, unknown>;
        await client.query(
          `INSERT INTO learning_modules (learning_path_id, title, content, position)
           VALUES ($1, $2, $3, $4)`,
          [
            path.id,
            requiredString(module.title, 'module.title', 240),
            requiredString(module.content, 'module.content', 20_000),
            index + 1,
          ],
        );
        moduleCount += 1;
      }

      await this.audit(client, user.id, 'learning_path.created', 'learning_path', path.id, {
        visibility,
      });
      return Object.freeze({ ...path, moduleCount });
    });
  }

  async enrollInLearningPath(
    identity: AuthenticatedIdentity,
    learningPathId: string,
  ): Promise<Readonly<{ status: string }>> {
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const path = await client.query<{ id: string }>(
        `SELECT id FROM learning_paths WHERE id = $1 AND status = 'published' AND visibility = 'public'`,
        [learningPathId],
      );
      if (path.rows[0] === undefined) {
        throw new NotFoundException('Learning path not found.');
      }
      await client.query(
        `INSERT INTO learning_enrollments (learning_path_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (learning_path_id, user_id) DO UPDATE SET updated_at = now()`,
        [learningPathId, user.id],
      );
      await this.createNotification(
        client,
        user.id,
        'learning.enrolled',
        'Learning path enrollment confirmed',
        'Your learning progress is now available in your private workspace.',
        `/learning/${learningPathId}`,
      );
      await this.audit(client, user.id, 'learning_path.enrolled', 'learning_path', learningPathId);
      return Object.freeze({ status: 'enrolled' });
    });
  }

  async listServiceRequests(
    identity: AuthenticatedIdentity,
  ): Promise<readonly ServiceRequestSummary[]> {
    const user = await this.resolveUser(identity);
    const result = await this.database.query<{
      created_at: Date | string;
      id: string;
      message: string;
      price_minor: number | null;
      service_title: string;
      status: string;
    }>(
      `SELECT service_requests.id, service_requests.message, service_requests.status, service_requests.created_at,
        services.title AS service_title, services.price_minor
       FROM service_requests
       INNER JOIN services ON services.id = service_requests.service_id
       WHERE service_requests.requester_user_id = $1 OR service_requests.provider_user_id = $1
       ORDER BY service_requests.created_at DESC`,
      [user.id],
    );

    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          createdAt: toIso(row.created_at),
          id: row.id,
          message: row.message,
          priceMinor: row.price_minor,
          serviceTitle: row.service_title,
          status: row.status,
        }),
      ),
    );
  }

  async updateServiceRequestStatus(
    identity: AuthenticatedIdentity,
    serviceRequestId: string,
    body: InputRecord,
  ): Promise<Readonly<{ status: string }>> {
    const action = requiredString(body.action, 'action', 32);

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const request = await client.query<{
        provider_user_id: string;
        requester_user_id: string;
        status: string;
      }>(
        `SELECT requester_user_id, provider_user_id, status FROM service_requests WHERE id = $1 FOR UPDATE`,
        [serviceRequestId],
      );
      const row = request.rows[0];
      if (row === undefined) {
        throw new NotFoundException('Service request not found.');
      }

      const isProvider = row.provider_user_id === user.id;
      const isRequester = row.requester_user_id === user.id;
      let status: string;
      if (action === 'accept' && isProvider && row.status === 'requested') {
        status = 'accepted';
      } else if (action === 'decline' && isProvider && row.status === 'requested') {
        status = 'declined';
      } else if (action === 'deliver' && isProvider && row.status === 'accepted') {
        status = 'delivered';
      } else if (action === 'accept_delivery' && isRequester && row.status === 'delivered') {
        status = 'accepted_delivery';
      } else if (
        action === 'cancel' &&
        (isProvider || isRequester) &&
        row.status !== 'accepted_delivery'
      ) {
        status = 'cancelled';
      } else {
        throw new ForbiddenException('This service request transition is not allowed.');
      }

      await client.query(
        `UPDATE service_requests SET status = $2, updated_at = now() WHERE id = $1`,
        [serviceRequestId, status],
      );

      if (status === 'accepted_delivery') {
        const payment = await client.query<{
          amount_minor: number;
          currency: string;
          id: string;
          provider: string;
          status: string;
        }>(
          `SELECT id, provider, amount_minor, currency, status FROM payment_intents
           WHERE service_request_id = $1 FOR UPDATE`,
          [serviceRequestId],
        );
        const paymentRow = payment.rows[0];
        if (paymentRow !== undefined && paymentRow.status === 'captured') {
          await client.query(
            `INSERT INTO settlement_runs (payment_intent_id, provider, provider_reference, amount_minor, currency)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (payment_intent_id) DO NOTHING`,
            [
              paymentRow.id,
              paymentRow.provider,
              `settlement-${paymentRow.id.slice(0, 12)}`,
              paymentRow.amount_minor,
              paymentRow.currency,
            ],
          );
        }
      }

      const recipient = isProvider ? row.requester_user_id : row.provider_user_id;
      await this.createNotification(
        client,
        recipient,
        'service.status',
        'Service request updated',
        `The service request status is now ${status}.`,
        `/requests/${serviceRequestId}`,
      );
      await this.audit(
        client,
        user.id,
        'service_request.transitioned',
        'service_request',
        serviceRequestId,
        {
          action,
          status,
        },
      );
      return Object.freeze({ status });
    });
  }

  async createPaymentIntent(
    identity: AuthenticatedIdentity,
    serviceRequestId: string,
    body: InputRecord,
  ): Promise<PaymentIntentSummary> {
    const requestedProvider = optionalString(body.provider, 'provider', 32) ?? 'local-sandbox';
    const provider =
      requestedProvider === 'mada' ||
      requestedProvider === 'stc_pay' ||
      requestedProvider === 'local-sandbox'
        ? requestedProvider
        : 'local-sandbox';

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const existing = await client.query<{
        amount_minor: number;
        currency: string;
        id: string;
        provider: string;
        service_request_id: string;
        status: string;
      }>(
        `SELECT id, service_request_id, provider, amount_minor, currency, status
         FROM payment_intents WHERE service_request_id = $1`,
        [serviceRequestId],
      );
      const alreadyCreated = existing.rows[0];
      if (alreadyCreated !== undefined) {
        return Object.freeze({
          amountMinor: alreadyCreated.amount_minor,
          currency: alreadyCreated.currency,
          id: alreadyCreated.id,
          provider: alreadyCreated.provider,
          serviceRequestId: alreadyCreated.service_request_id,
          status: alreadyCreated.status,
        });
      }

      const request = await client.query<{
        currency: string;
        price_minor: number | null;
        requester_user_id: string;
        status: string;
      }>(
        `SELECT service_requests.requester_user_id, service_requests.status, services.price_minor, services.currency
         FROM service_requests INNER JOIN services ON services.id = service_requests.service_id
         WHERE service_requests.id = $1 FOR UPDATE`,
        [serviceRequestId],
      );
      const row = request.rows[0];
      if (row === undefined || row.requester_user_id !== user.id || row.status !== 'accepted') {
        throw new ForbiddenException(
          'Payment can only be prepared by the requester after acceptance.',
        );
      }
      if (row.price_minor === null) {
        throw new ConflictException(
          'This service uses a custom quote and cannot be paid automatically.',
        );
      }

      const created = await client.query<{
        amount_minor: number;
        currency: string;
        id: string;
        provider: string;
        service_request_id: string;
        status: string;
      }>(
        `INSERT INTO payment_intents (service_request_id, provider, provider_reference, amount_minor, currency)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, service_request_id, provider, amount_minor, currency, status`,
        [
          serviceRequestId,
          provider,
          `wb-${provider}-${serviceRequestId.slice(0, 12)}`,
          row.price_minor,
          row.currency,
        ],
      );
      const payment = created.rows[0];
      if (payment === undefined) {
        throw new Error('Payment intent creation did not return a resource.');
      }
      await client.query(
        `INSERT INTO payment_events (payment_intent_id, event_type, provider_event_id, metadata)
         VALUES ($1, 'created', $2, $3::jsonb)`,
        [payment.id, `created-${payment.id}`, JSON.stringify({ provider })],
      );
      await this.audit(client, user.id, 'payment_intent.created', 'payment_intent', payment.id, {
        provider,
      });
      return Object.freeze({
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        id: payment.id,
        provider: payment.provider,
        serviceRequestId: payment.service_request_id,
        status: payment.status,
      });
    });
  }

  async confirmPaymentIntent(
    identity: AuthenticatedIdentity,
    paymentIntentId: string,
  ): Promise<PaymentIntentSummary> {
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const payment = await client.query<{
        amount_minor: number;
        currency: string;
        id: string;
        provider: string;
        requester_user_id: string;
        service_request_id: string;
        status: string;
      }>(
        `SELECT payment_intents.id, payment_intents.service_request_id, payment_intents.provider,
          payment_intents.amount_minor, payment_intents.currency, payment_intents.status,
          service_requests.requester_user_id
         FROM payment_intents INNER JOIN service_requests ON service_requests.id = payment_intents.service_request_id
         WHERE payment_intents.id = $1 FOR UPDATE`,
        [paymentIntentId],
      );
      const row = payment.rows[0];
      if (row === undefined || row.requester_user_id !== user.id) {
        throw new ForbiddenException('This payment intent is unavailable.');
      }
      if (row.provider !== 'local-sandbox') {
        throw new ConflictException(
          'This provider must confirm payment through its verified callback.',
        );
      }
      if (row.status === 'requires_confirmation') {
        await client.query(
          `UPDATE payment_intents SET status = 'captured', updated_at = now() WHERE id = $1`,
          [row.id],
        );
        await client.query(
          `INSERT INTO payment_events (payment_intent_id, event_type, provider_event_id, metadata)
           VALUES ($1, 'captured', $2, $3::jsonb)`,
          [row.id, `captured-${row.id}`, JSON.stringify({ mode: 'development-sandbox' })],
        );
        await this.audit(client, user.id, 'payment_intent.captured', 'payment_intent', row.id, {
          provider: row.provider,
        });
      }
      return Object.freeze({
        amountMinor: row.amount_minor,
        currency: row.currency,
        id: row.id,
        provider: row.provider,
        serviceRequestId: row.service_request_id,
        status: row.status === 'requires_confirmation' ? 'captured' : row.status,
      });
    });
  }

  async listPaymentIntents(
    identity: AuthenticatedIdentity,
  ): Promise<readonly PaymentIntentSummary[]> {
    const user = await this.resolveUser(identity);
    const result = await this.database.query<{
      amount_minor: number;
      currency: string;
      id: string;
      provider: string;
      service_request_id: string;
      status: string;
    }>(
      `SELECT payment_intents.id, payment_intents.service_request_id, payment_intents.provider,
        payment_intents.amount_minor, payment_intents.currency, payment_intents.status
       FROM payment_intents INNER JOIN service_requests ON service_requests.id = payment_intents.service_request_id
       WHERE service_requests.requester_user_id = $1 OR service_requests.provider_user_id = $1
       ORDER BY payment_intents.created_at DESC`,
      [user.id],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          amountMinor: row.amount_minor,
          currency: row.currency,
          id: row.id,
          provider: row.provider,
          serviceRequestId: row.service_request_id,
          status: row.status,
        }),
      ),
    );
  }

  async createReview(identity: AuthenticatedIdentity, body: InputRecord): Promise<ReviewSummary> {
    const serviceRequestId = requiredString(body.serviceRequestId, 'serviceRequestId', 64);
    const rating = typeof body.rating === 'number' ? Math.trunc(body.rating) : Number.NaN;
    const reviewBody = requiredString(body.body, 'body', 2_000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ConflictException('rating must be an integer between 1 and 5.');
    }

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const request = await client.query<{
        provider_user_id: string;
        requester_user_id: string;
        status: string;
      }>(`SELECT requester_user_id, provider_user_id, status FROM service_requests WHERE id = $1`, [
        serviceRequestId,
      ]);
      const row = request.rows[0];
      if (
        row === undefined ||
        row.requester_user_id !== user.id ||
        row.status !== 'accepted_delivery'
      ) {
        throw new ForbiddenException('Reviews are available after accepted delivery.');
      }
      const created = await client.query<{ created_at: Date | string; id: string }>(
        `INSERT INTO reviews (service_request_id, author_user_id, subject_user_id, rating, body)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [serviceRequestId, user.id, row.provider_user_id, rating, reviewBody],
      );
      const review = created.rows[0];
      if (review === undefined) {
        throw new Error('Review creation did not return a resource.');
      }
      await this.audit(client, user.id, 'review.created', 'review', review.id, {
        rating: String(rating),
      });
      return Object.freeze({
        authorName: await this.displayName(client, user.id),
        body: reviewBody,
        createdAt: toIso(review.created_at),
        id: review.id,
        rating,
        serviceRequestId,
      });
    });
  }

  async listServiceReviews(serviceId: string): Promise<readonly ReviewSummary[]> {
    const result = await this.database.query<{
      author_name: string;
      body: string;
      created_at: Date | string;
      id: string;
      rating: number;
      service_request_id: string;
    }>(
      `SELECT reviews.id, reviews.service_request_id, reviews.rating, reviews.body, reviews.created_at,
        profiles.display_name AS author_name
       FROM reviews
       INNER JOIN service_requests ON service_requests.id = reviews.service_request_id
       INNER JOIN profiles ON profiles.user_id = reviews.author_user_id
       WHERE service_requests.service_id = $1
       ORDER BY reviews.created_at DESC`,
      [serviceId],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          authorName: row.author_name,
          body: row.body,
          createdAt: toIso(row.created_at),
          id: row.id,
          rating: Number(row.rating),
          serviceRequestId: row.service_request_id,
        }),
      ),
    );
  }

  async openServiceDispute(
    identity: AuthenticatedIdentity,
    serviceRequestId: string,
    body: InputRecord,
  ): Promise<Readonly<{ id: string; status: string }>> {
    const reason = requiredString(body.reason, 'reason', 2_000);
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const request = await client.query<{ provider_user_id: string; requester_user_id: string }>(
        `SELECT requester_user_id, provider_user_id FROM service_requests WHERE id = $1 FOR UPDATE`,
        [serviceRequestId],
      );
      const row = request.rows[0];
      if (
        row === undefined ||
        (row.requester_user_id !== user.id && row.provider_user_id !== user.id)
      ) {
        throw new ForbiddenException('Only transaction participants can open a dispute.');
      }
      const created = await client.query<{ id: string; status: string }>(
        `INSERT INTO service_disputes (service_request_id, opened_by, reason)
         VALUES ($1, $2, $3)
         RETURNING id, status`,
        [serviceRequestId, user.id, reason],
      );
      const dispute = created.rows[0];
      if (dispute === undefined) {
        throw new Error('Dispute creation did not return a resource.');
      }
      await client.query(
        `UPDATE service_requests SET status = 'disputed', updated_at = now() WHERE id = $1`,
        [serviceRequestId],
      );
      await this.audit(client, user.id, 'service_dispute.opened', 'service_dispute', dispute.id);
      return Object.freeze(dispute);
    });
  }

  async search(query: string): Promise<readonly SearchResult[]> {
    const term = query.trim().toLocaleLowerCase();
    if (term.length < 2) {
      return Object.freeze([]);
    }
    const [communities, events, experts, learningPaths, opportunities, services] =
      await Promise.all([
        this.listCommunities(),
        this.listEvents(),
        this.listExperts(),
        this.listLearningPaths(),
        this.listOpportunities(),
        this.listServices(),
      ]);
    const contains = (...parts: readonly string[]): boolean =>
      parts.join(' ').toLocaleLowerCase().includes(term);
    const results: SearchResult[] = [];
    for (const community of communities) {
      if (contains(community.name, community.summary)) {
        results.push(
          Object.freeze({
            id: community.id,
            title: community.name,
            description: community.summary,
            type: 'community',
          }),
        );
      }
    }
    for (const event of events) {
      if (contains(event.title, event.description, event.location ?? '')) {
        results.push(
          Object.freeze({
            id: event.id,
            title: event.title,
            description: event.description,
            type: 'event',
          }),
        );
      }
    }
    for (const expert of experts) {
      if (contains(expert.displayName, expert.headline, ...expert.specialties)) {
        results.push(
          Object.freeze({
            id: expert.userId,
            title: expert.displayName,
            description: expert.headline,
            type: 'expert',
          }),
        );
      }
    }
    for (const path of learningPaths) {
      if (contains(path.title, path.summary)) {
        results.push(
          Object.freeze({
            id: path.id,
            title: path.title,
            description: path.summary,
            type: 'learning_path',
          }),
        );
      }
    }
    for (const opportunity of opportunities) {
      if (contains(opportunity.title, opportunity.description)) {
        results.push(
          Object.freeze({
            id: opportunity.id,
            title: opportunity.title,
            description: opportunity.description,
            type: 'opportunity',
          }),
        );
      }
    }
    for (const service of services) {
      if (contains(service.title, service.description)) {
        results.push(
          Object.freeze({
            id: service.id,
            title: service.title,
            description: service.description,
            type: 'service',
          }),
        );
      }
    }
    return Object.freeze(results.slice(0, 24));
  }

  async askAssistant(
    identity: AuthenticatedIdentity,
    body: InputRecord,
  ): Promise<AssistantGuidance> {
    const prompt = requiredString(body.prompt, 'prompt', 2_000);
    const user = await this.resolveUser(identity);
    const citations = await this.search(prompt);
    const created = await this.database.query<{ id: string }>(
      `INSERT INTO ai_tasks (requested_by, task_type, input_scope, status, output_summary, approval_required, completed_at)
       VALUES ($1, 'summary', $2::jsonb, 'completed', $3, TRUE, now())
       RETURNING id`,
      [
        user.id,
        JSON.stringify({ prompt, retrievalCount: citations.length }),
        'Guidance generated from public WB resources. Human review is required before any consequential action.',
      ],
    );
    const task = created.rows[0];
    if (task === undefined) {
      throw new Error('Assistant task creation did not return a resource.');
    }
    await this.database.withTransaction((client) =>
      this.audit(client, user.id, 'assistant.guidance_requested', 'ai_task', task.id),
    );
    const answer =
      citations.length === 0
        ? 'No direct match was found yet. Refine your question or explore a community, expert, opportunity, or learning path.'
        : `I found ${citations.length} relevant WB resource${citations.length === 1 ? '' : 's'}. Review the citations below; this is decision support, not an automatic action.`;
    return Object.freeze({ answer, citations, taskId: task.id });
  }

  async listWorkflows(identity: AuthenticatedIdentity): Promise<readonly WorkflowSummary[]> {
    const user = await this.resolveUser(identity);
    const result = await this.database.query<{
      created_at: Date | string;
      id: string;
      result_summary: string | null;
      status: string;
      workflow_type: string;
    }>(
      `SELECT id, workflow_type, status, result_summary, created_at
       FROM workflow_runs WHERE requested_by = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          createdAt: toIso(row.created_at),
          id: row.id,
          resultSummary: row.result_summary,
          status: row.status,
          workflowType: row.workflow_type,
        }),
      ),
    );
  }

  async approveWorkflow(
    identity: AuthenticatedIdentity,
    workflowId: string,
  ): Promise<WorkflowSummary> {
    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const updated = await client.query<{
        created_at: Date | string;
        id: string;
        result_summary: string | null;
        status: string;
        workflow_type: string;
      }>(
        `UPDATE workflow_runs
         SET status = 'approved', result_summary = 'Approved by the requesting member; no external action was executed.', updated_at = now()
         WHERE id = $1 AND requested_by = $2 AND status = 'pending_approval'
         RETURNING id, workflow_type, status, result_summary, created_at`,
        [workflowId, user.id],
      );
      const workflow = updated.rows[0];
      if (workflow === undefined) {
        throw new ConflictException('This workflow is unavailable for approval.');
      }
      await this.audit(client, user.id, 'workflow.approved', 'workflow_run', workflow.id);
      return Object.freeze({
        createdAt: toIso(workflow.created_at),
        id: workflow.id,
        resultSummary: workflow.result_summary,
        status: workflow.status,
        workflowType: workflow.workflow_type,
      });
    });
  }

  async listFederationLinks(communitySlug: string): Promise<readonly FederationLinkSummary[]> {
    const result = await this.database.query<{
      id: string;
      remote_base_url: string;
      remote_community_key: string;
      status: string;
      trust_level: string;
    }>(
      `SELECT community_federation_links.id, remote_base_url, remote_community_key, status, trust_level
       FROM community_federation_links
       INNER JOIN communities ON communities.id = community_federation_links.community_id
       WHERE communities.slug = $1 AND community_federation_links.status = 'active'
       ORDER BY community_federation_links.created_at DESC`,
      [communitySlug],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          id: row.id,
          remoteBaseUrl: row.remote_base_url,
          remoteCommunityKey: row.remote_community_key,
          status: row.status,
          trustLevel: row.trust_level,
        }),
      ),
    );
  }

  async createFederationLink(
    identity: AuthenticatedIdentity,
    communitySlug: string,
    body: InputRecord,
  ): Promise<FederationLinkSummary> {
    const remoteBaseUrl = requiredString(body.remoteBaseUrl, 'remoteBaseUrl', 500);
    const remoteCommunityKey = requiredString(body.remoteCommunityKey, 'remoteCommunityKey', 160);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(remoteBaseUrl);
    } catch {
      throw new ConflictException('remoteBaseUrl must be a valid HTTPS URL.');
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new ConflictException('remoteBaseUrl must use HTTPS.');
    }

    return this.database.withTransaction(async (client) => {
      const user = await this.requireUser(client, identity);
      const community = await client.query<{ id: string; owner_user_id: string }>(
        `SELECT id, owner_user_id FROM communities WHERE slug = $1`,
        [communitySlug],
      );
      const communityRow = community.rows[0];
      if (communityRow === undefined || communityRow.owner_user_id !== user.id) {
        throw new ForbiddenException('Only the community owner can register federation links.');
      }
      const created = await client.query<{
        id: string;
        remote_base_url: string;
        remote_community_key: string;
        status: string;
        trust_level: string;
      }>(
        `INSERT INTO community_federation_links (community_id, remote_base_url, remote_community_key, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, remote_base_url, remote_community_key, status, trust_level`,
        [communityRow.id, parsedUrl.origin, remoteCommunityKey, user.id],
      );
      const link = created.rows[0];
      if (link === undefined) {
        throw new Error('Federation link creation did not return a resource.');
      }
      await this.audit(client, user.id, 'federation_link.registered', 'federation_link', link.id, {
        communitySlug,
      });
      return Object.freeze({
        id: link.id,
        remoteBaseUrl: link.remote_base_url,
        remoteCommunityKey: link.remote_community_key,
        status: link.status,
        trustLevel: link.trust_level,
      });
    });
  }

  async markNotificationRead(
    identity: AuthenticatedIdentity,
    notificationId: string,
  ): Promise<Readonly<{ read: true }>> {
    const user = await this.resolveUser(identity);
    await this.database.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2`,
      [notificationId, user.id],
    );
    return Object.freeze({ read: true });
  }

  private async ensureEcosystemSeedData(): Promise<void> {
    await this.ensureSeedData();
    await this.database.withTransaction(async (client) => {
      const systemUser = await client.query<{ id: string }>(
        `SELECT users.id
         FROM users INNER JOIN user_identities ON user_identities.user_id = users.id
         WHERE user_identities.issuer = 'wb-system' AND user_identities.subject = 'seed'
         LIMIT 1`,
      );
      const systemUserId = systemUser.rows[0]?.id;
      if (systemUserId === undefined) {
        throw new Error('The WB system identity is unavailable.');
      }

      const organizationCount = await client.query<{ count: number }>(
        'SELECT COUNT(*)::integer AS count FROM organizations',
      );
      if (Number(organizationCount.rows[0]?.count ?? 0) === 0) {
        const organization = await client.query<{ id: string }>(
          `INSERT INTO organizations (slug, name, description, created_by)
           VALUES ('wb-practice-lab', 'WB Practice Lab', 'A collaborative home for practical professional learning.', $1)
           RETURNING id`,
          [systemUserId],
        );
        const organizationId = organization.rows[0]?.id;
        if (organizationId !== undefined) {
          await client.query(
            "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1, $2, 'owner')",
            [organizationId, systemUserId],
          );
        }
      }

      const expertCount = await client.query<{ count: number }>(
        'SELECT COUNT(*)::integer AS count FROM expert_profiles',
      );
      if (Number(expertCount.rows[0]?.count ?? 0) === 0) {
        await client.query(
          `INSERT INTO expert_profiles (user_id, headline, specialties, is_verified, availability)
           VALUES ($1, 'Professional community and product strategy', $2::jsonb, TRUE, 'open')`,
          [systemUserId, JSON.stringify(['Product strategy', 'Community design', 'Trust systems'])],
        );
      }

      const learningCount = await client.query<{ count: number }>(
        'SELECT COUNT(*)::integer AS count FROM learning_paths',
      );
      if (Number(learningCount.rows[0]?.count ?? 0) === 0) {
        const path = await client.query<{ id: string }>(
          `INSERT INTO learning_paths (owner_user_id, title, summary)
           VALUES ($1, 'From signal to practical experiment', 'A concise foundation for turning professional insights into tested next steps.')
           RETURNING id`,
          [systemUserId],
        );
        const pathId = path.rows[0]?.id;
        if (pathId !== undefined) {
          await client.query(
            `INSERT INTO learning_modules (learning_path_id, title, content, position)
             VALUES ($1, 'Frame the signal', 'Capture the observed problem, who experiences it, and what would count as useful evidence.', 1),
                    ($1, 'Run a respectful test', 'Choose the smallest reversible experiment and document what you learned.', 2)`,
            [pathId],
          );
        }
      }
    });
  }

  private async ensureSeedData(): Promise<void> {
    await this.database.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE id = (SELECT user_id FROM user_identities WHERE issuer = 'wb-system' AND subject = 'seed') LIMIT 1",
      );
      let systemUserId = existing.rows[0]?.id;

      if (systemUserId === undefined) {
        const user = await client.query<{ id: string }>(
          'INSERT INTO users DEFAULT VALUES RETURNING id',
        );
        systemUserId = user.rows[0]?.id;

        if (systemUserId === undefined) {
          throw new Error('System user creation did not return an identifier.');
        }

        await client.query(
          'INSERT INTO user_identities (user_id, issuer, subject) VALUES ($1, $2, $3)',
          [systemUserId, 'wb-system', 'seed'],
        );
        await client.query(
          'INSERT INTO profiles (user_id, display_name, biography, skills) VALUES ($1, $2, $3, $4::jsonb)',
          [
            systemUserId,
            'WB Team',
            'Building a trusted professional ecosystem.',
            JSON.stringify(['Community', 'Product', 'Trust']),
          ],
        );
        await client.query("INSERT INTO platform_roles (user_id, role) VALUES ($1, 'admin')", [
          systemUserId,
        ]);
      }

      const communityCount = await client.query<{ count: number }>(
        'SELECT COUNT(*)::integer AS count FROM communities',
      );
      if (Number(communityCount.rows[0]?.count ?? 0) !== 0) {
        return;
      }

      const communities = [
        [
          'product-builders',
          'Product Builders',
          'Practical conversations on discovery, experiments, and impact.',
        ],
        [
          'creative-economy',
          'Creative Economy',
          'A home for founders and creators building purposeful partnerships.',
        ],
        [
          'transformation-leaders',
          'Transformation Leaders',
          'Insights from leaders designing better public and private services.',
        ],
      ];

      for (const [slug, name, summary] of communities) {
        const inserted = await client.query<{ id: string }>(
          'INSERT INTO communities (slug, name, summary, owner_user_id) VALUES ($1, $2, $3, $4) RETURNING id',
          [slug, name, summary, systemUserId],
        );
        const communityId = inserted.rows[0]?.id;
        if (communityId !== undefined) {
          await client.query(
            "INSERT INTO community_memberships (community_id, user_id, role) VALUES ($1, $2, 'owner')",
            [communityId, systemUserId],
          );
        }
      }

      const firstCommunity = await client.query<{ id: string }>(
        "SELECT id FROM communities WHERE slug = 'product-builders'",
      );
      const communityId = firstCommunity.rows[0]?.id;
      if (communityId !== undefined) {
        await client.query(
          'INSERT INTO discussions (community_id, author_user_id, title, body) VALUES ($1, $2, $3, $4)',
          [
            communityId,
            systemUserId,
            'What signal tells you a problem is worth building for?',
            'Share the evidence that helps you move from an interesting idea to a focused experiment.',
          ],
        );
      }

      await client.query(
        `
        INSERT INTO events (owner_user_id, title, description, event_type, location, starts_at, ends_at, capacity, registration_state)
        VALUES ($1, 'From idea to impact', 'A practical live session for people building products and communities others can trust.', 'hybrid', 'KAFD, Riyadh', now() + interval '14 days', now() + interval '14 days' + interval '2 hours', 180, 'open')
      `,
        [systemUserId],
      );
      await client.query(
        `
        INSERT INTO opportunities (owner_user_id, title, description, opportunity_type)
        VALUES ($1, 'User research partner', 'Collaborate on a short discovery project with an impact-focused team.', 'project')
      `,
        [systemUserId],
      );
      await client.query(
        `
        INSERT INTO services (provider_user_id, title, description, price_minor, currency)
        VALUES ($1, 'Product strategy session', 'A structured advisory session for teams moving from problem framing to an executable roadmap.', 150000, 'SAR')
      `,
        [systemUserId],
      );
    });
  }

  private async resolveUser(identity: AuthenticatedIdentity): Promise<InternalUser> {
    return this.database.withTransaction((client) => this.requireUser(client, identity));
  }

  private async requireUser(
    client: DatabaseClient,
    identity: AuthenticatedIdentity,
  ): Promise<InternalUser> {
    const user = await client.query<{ id: string }>(
      `SELECT users.id FROM users INNER JOIN user_identities ON user_identities.user_id = users.id WHERE user_identities.issuer = $1 AND user_identities.subject = $2 LIMIT 1`,
      [identity.issuer, identity.subject],
    );
    const row = user.rows[0];

    if (row === undefined) {
      throw new NotFoundException('The authenticated account is unavailable.');
    }

    return Object.freeze({ id: row.id });
  }

  private async displayName(client: DatabaseClient, userId: string): Promise<string> {
    const profile = await client.query<{ display_name: string }>(
      'SELECT display_name FROM profiles WHERE user_id = $1',
      [userId],
    );
    return profile.rows[0]?.display_name ?? 'WB member';
  }

  private async createNotification(
    client: DatabaseClient,
    userId: string,
    kind: string,
    title: string,
    body: string,
    href: string,
  ): Promise<void> {
    await client.query(
      'INSERT INTO notifications (user_id, kind, title, body, href) VALUES ($1, $2, $3, $4, $5)',
      [userId, kind, title, body, href],
    );
  }

  private async audit(
    client: DatabaseClient,
    actorUserId: string,
    eventType: string,
    resourceType: string,
    resourceId: string,
    metadata: Readonly<Record<string, string>> = {},
  ): Promise<void> {
    await client.query(
      'INSERT INTO platform_audit_events (actor_user_id, event_type, resource_type, resource_id, metadata) VALUES ($1, $2, $3, $4::uuid, $5::jsonb)',
      [actorUserId, eventType, resourceType, resourceId, JSON.stringify(metadata)],
    );
  }
}
