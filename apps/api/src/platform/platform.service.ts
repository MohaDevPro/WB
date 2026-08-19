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
