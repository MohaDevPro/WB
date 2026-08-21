import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { query, transaction } from '../common/db';
import { CommunitiesService } from '../communities/communities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../system/audit.service';

type User = { id: string; platformRole: string; emailVerifiedAt: string | null };
type EventRow = Record<string, any> & {
  id: string;
  occurrence_id: string;
  starts_at: string;
  zoom_url_ciphertext: string;
  zoom_url_iv: string;
  zoom_url_auth_tag: string;
};

type EventInput = {
  title: string;
  description?: string;
  startsAt: string;
  timezone?: string;
  zoomUrl: string;
  visibility: 'public' | 'private';
  communityId?: string;
  groupId?: string;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly communities: CommunitiesService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: User) {
    const result = await query<Record<string, unknown>>(
      `SELECT ec.id, ec.title, ec.description, ec.starts_at, ec.ends_at, ec.timezone,
              ec.visibility, ec.community_id, ec.group_id, ec.status, ec.occurrence_status,
              c.name AS community_name,
              EXISTS (
                SELECT 1 FROM event.registrations r
                WHERE r.occurrence_id = ec.occurrence_id
                  AND r.user_id = $1 AND r.status = 'registered'
              ) AS registered
       FROM event.catalog ec
       LEFT JOIN community.communities c ON c.id = ec.community_id
       WHERE ec.status = 'published'
         AND ec.occurrence_status = 'scheduled'
         AND (
           ec.visibility = 'public'
           OR $2 = 'platform_admin'
           OR (
             ec.community_id IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM community.memberships m
               WHERE m.community_id = ec.community_id AND m.user_id = $1 AND m.status = 'active'
             )
           )
         )
       ORDER BY ec.starts_at ASC`,
      [user.id, user.platformRole],
    );
    return result.rows;
  }

  async get(user: User, eventId: string) {
    const row = await this.getRow(eventId);
    await this.requireAccess(user, row);
    const registration = await query<{ status: string }>(
      'SELECT status FROM event.registrations WHERE occurrence_id = $1 AND user_id = $2',
      [row.occurrence_id, user.id],
    );
    const registered = registration.rows[0]?.status === 'registered';
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      visibility: row.visibility,
      communityId: row.community_id,
      groupId: row.group_id,
      status: row.status,
      occurrenceId: row.occurrence_id,
      registered,
      zoomUrl: registered || user.platformRole === 'platform_admin' ? decryptZoomUrl(row) : null,
    };
  }

  async create(user: User, input: EventInput) {
    await this.authorizeCreate(user, input);
    const result = await transaction((client) => this.persistEvent(client, user, input));
    await this.auditService.record(user.id, 'event_created', 'event', result.id);
    return result;
  }

  private async authorizeCreate(user: User, input: EventInput) {
    assertPrivateEventScope(input);
    if (input.groupId) return this.authorizeGroupEvent(user, input);
    if (input.communityId) return this.communities.requireCommunityAdmin(user, input.communityId);
    this.communities.requirePlatformAdmin(user);
  }

  private async authorizeGroupEvent(user: User, input: EventInput) {
    const group = await query<{ community_id: string }>(
      `SELECT community_id FROM community.groups WHERE id = $1 AND status = 'active'`,
      [input.groupId],
    );
    if (!group.rows[0] || group.rows[0].community_id !== input.communityId) {
      throw new ForbiddenException('Group does not belong to the selected community');
    }
    await this.communities.requireGroupModerator(user, input.groupId as string);
  }

  private async persistEvent(client: PoolClient, user: User, input: EventInput) {
    const encrypted = encryptZoomUrl(input.zoomUrl.trim());
    const event = await client.query<{ id: string }>(
      `INSERT INTO event.events (title, description, status, created_by)
       VALUES ($1, $2, 'published', $3) RETURNING id`,
      [input.title.trim(), input.description?.trim() ?? '', user.id],
    );
    const eventId = event.rows[0].id;
    const occurrence = await client.query<Record<string, unknown>>(
      `INSERT INTO event.occurrences
         (event_id, sequence_no, starts_at, timezone, zoom_url_ciphertext, zoom_url_iv, zoom_url_auth_tag)
       VALUES ($1, 1, $2, $3, $4, $5, $6)
       RETURNING id, starts_at, timezone, status`,
      [eventId, new Date(input.startsAt), input.timezone ?? 'Asia/Riyadh', encrypted.ciphertext, encrypted.iv, encrypted.authTag],
    );
    await this.persistEventAudience(client, eventId, input);
    await this.persistOrganizer(client, eventId, user.id);
    return { id: eventId, occurrence: occurrence.rows[0] };
  }

  private async persistEventAudience(client: PoolClient, eventId: string, input: EventInput) {
    if (input.visibility === 'public') {
      await client.query('INSERT INTO event.public_events (event_id) VALUES ($1)', [eventId]);
      return;
    }
    if (input.groupId) {
      await client.query('INSERT INTO event.private_group_events (event_id, group_id) VALUES ($1, $2)', [eventId, input.groupId]);
      return;
    }
    await client.query('INSERT INTO event.private_community_events (event_id, community_id) VALUES ($1, $2)', [eventId, input.communityId]);
  }

  private async persistOrganizer(client: PoolClient, eventId: string, userId: string) {
    await client.query(
      `INSERT INTO event.organizers (event_id, user_id, organizer_role)
       VALUES ($1, $2, 'organizer')`,
      [eventId, userId],
    );
  }

  async update(user: User, eventId: string, input: { title?: string; description?: string; startsAt?: string; timezone?: string; zoomUrl?: string; status?: 'published' | 'cancelled' | 'completed' }) {
    const row = await this.getRow(eventId);
    await this.authorizeUpdate(user, row);
    const result = await transaction((client) => this.persistEventUpdate(client, row, eventId, input));
    await this.notifyCancellation(user, row, input.status);
    await this.auditService.record(user.id, eventAuditAction(input.status), 'event', eventId);
    return result;
  }

  private async authorizeUpdate(user: User, row: EventRow) {
    if (user.platformRole === 'platform_admin') return;
    if (row.group_id) return this.communities.requireGroupModerator(user, String(row.group_id));
    if (row.community_id) return this.communities.requireCommunityAdmin(user, String(row.community_id));
    throw new ForbiddenException('Permission denied');
  }

  private async persistEventUpdate(client: PoolClient, row: EventRow, eventId: string, input: { title?: string; description?: string; startsAt?: string; timezone?: string; zoomUrl?: string; status?: 'published' | 'cancelled' | 'completed' }) {
    const encrypted = input.zoomUrl ? encryptZoomUrl(input.zoomUrl.trim()) : null;
    const event = await client.query<Record<string, unknown>>(
      `UPDATE event.events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           updated_at = now()
       WHERE id = $4
       RETURNING id, title, description, status, updated_at`,
      [input.title?.trim() ?? null, input.description?.trim() ?? null, input.status ?? null, eventId],
    );
    await client.query(
      `UPDATE event.occurrences
       SET starts_at = COALESCE($1, starts_at),
           timezone = COALESCE($2, timezone),
           zoom_url_ciphertext = COALESCE($3, zoom_url_ciphertext),
           zoom_url_iv = COALESCE($4, zoom_url_iv),
           zoom_url_auth_tag = COALESCE($5, zoom_url_auth_tag),
           updated_at = now()
       WHERE id = $6`,
      [input.startsAt ? new Date(input.startsAt) : null, input.timezone ?? null, encrypted?.ciphertext ?? null, encrypted?.iv ?? null, encrypted?.authTag ?? null, row.occurrence_id],
    );
    return event.rows[0];
  }

  private async notifyCancellation(user: User, row: EventRow, status?: string) {
    if (status !== 'cancelled') return;
    const recipients = await query<{ user_id: string }>(
      `SELECT user_id FROM event.registrations WHERE occurrence_id = $1 AND status = 'registered'`,
      [row.occurrence_id],
    );
    for (const recipient of recipients.rows) {
      await this.notifications.notifyEvent(recipient.user_id, user.id, row.occurrence_id, 'cancelled');
    }
  }

  async register(user: User, eventId: string) {
    const row = await this.getRow(eventId);
    await this.requireAccess(user, row);
    if (row.status !== 'published' || row.occurrence_status !== 'scheduled') {
      throw new ForbiddenException('Event is not open for registration');
    }
    const result = await query<Record<string, unknown>>(
      `INSERT INTO event.registrations (occurrence_id, user_id, status, registered_at, cancelled_at)
       VALUES ($1, $2, 'registered', now(), NULL)
       ON CONFLICT (occurrence_id, user_id)
       DO UPDATE SET status = 'registered', registered_at = now(), cancelled_at = NULL
       RETURNING *`,
      [row.occurrence_id, user.id],
    );
    await this.notifications.notifyEvent(user.id, user.id, row.occurrence_id, 'registered');
    return result.rows[0];
  }

  async cancelRegistration(user: User, eventId: string) {
    const row = await this.getRow(eventId);
    await this.requireAccess(user, row);
    await query(
      `UPDATE event.registrations
       SET status = 'cancelled', cancelled_at = now()
       WHERE occurrence_id = $1 AND user_id = $2 AND status = 'registered'`,
      [row.occurrence_id, user.id],
    );
    return { success: true };
  }

  private async getRow(eventId: string): Promise<EventRow> {
    const result = await query<EventRow>('SELECT * FROM event.catalog WHERE id = $1', [eventId]);
    if (!result.rows[0]) throw new NotFoundException('Event not found');
    return result.rows[0];
  }

  private async requireAccess(user: User, row: EventRow) {
    if (isPublicOrAdmin(user, row)) return;
    if (row.group_id) return this.requireGroupEventAccess(user, String(row.group_id));
    return this.requireCommunityEventAccess(user, row.community_id);
  }

  private async requireGroupEventAccess(user: User, groupId: string) {
    if (!(await this.communities.canAccessScope(user, 'group', groupId))) {
      throw new ForbiddenException('Group membership required');
    }
  }

  private async requireCommunityEventAccess(user: User, communityId: string | null) {
    if (!communityId) throw new ForbiddenException('Private event is not configured correctly');
    await this.communities.requireActiveMember(user, String(communityId));
  }

}

function encryptionKey() {
  const configured = process.env.EVENT_URL_ENCRYPTION_KEY;
  if (isConfiguredKey(configured)) return Buffer.from(configured, 'hex');
  if (process.env.NODE_ENV === 'production') throw new Error('EVENT_URL_ENCRYPTION_KEY must be a 32-byte hex key in production');
  return createHash('sha256').update(configured ?? 'wb-local-development-event-key').digest();
}

function encryptZoomUrl(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptZoomUrl(row: EventRow) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.zoom_url_iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.zoom_url_auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.zoom_url_ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function assertPrivateEventScope(input: EventInput) {
  if (input.visibility === 'private' && !input.communityId) {
    throw new ForbiddenException('Private events require a community');
  }
}

function eventAuditAction(status?: string) {
  return status === 'cancelled' ? 'event_cancelled' : 'event_updated';
}

function isConfiguredKey(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-fA-F]{64}$/.test(value));
}

function isPublicOrAdmin(user: User, row: EventRow) {
  return row.visibility === 'public' || user.platformRole === 'platform_admin';
}
