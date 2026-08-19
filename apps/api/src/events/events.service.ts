import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { query } from '../common/db';
import { CommunitiesService } from '../communities/communities.service';

type User = { id: string; platformRole: string; emailVerifiedAt: string | null };

@Injectable()
export class EventsService {
  constructor(private readonly communities: CommunitiesService) {}

  async list(user: User) {
    const result = await query<Record<string, unknown>>(
      `SELECT e.id, e.title, e.description, e.starts_at, e.timezone, e.visibility, e.community_id, e.group_id, e.status,
              c.name AS community_name,
              EXISTS (SELECT 1 FROM event_registrations r WHERE r.event_id = e.id AND r.user_id = $1 AND r.status = 'registered') AS registered
       FROM events e LEFT JOIN communities c ON c.id = e.community_id
       WHERE e.status = 'published' AND (e.visibility = 'public' OR $2 = 'platform_admin' OR EXISTS (
         SELECT 1 FROM community_memberships m WHERE m.community_id = e.community_id AND m.user_id = $1 AND m.status = 'active'
       )) ORDER BY e.starts_at ASC`,
      [user.id, user.platformRole],
    );
    return result.rows;
  }

  async get(user: User, eventId: string) {
    const row = await this.getRow(eventId);
    await this.requireAccess(user, row);
    const registration = await query<{ status: string }>('SELECT status FROM event_registrations WHERE event_id = $1 AND user_id = $2', [eventId, user.id]);
    const registered = registration.rows[0]?.status === 'registered';
    return {
      id: row.id, title: row.title, description: row.description, startsAt: row.starts_at, timezone: row.timezone,
      visibility: row.visibility, communityId: row.community_id, groupId: row.group_id, status: row.status,
      registered, zoomUrl: registered || user.platformRole === 'platform_admin' ? row.zoom_url : null,
    };
  }

  async create(user: User, input: { title: string; description?: string; startsAt: string; timezone?: string; zoomUrl: string; visibility: 'public' | 'private'; communityId?: string; groupId?: string }) {
    if (input.visibility === 'private' && !input.communityId) throw new ForbiddenException('Private events require a community');
    if (input.communityId) await this.communities.requireCommunityAdmin(user, input.communityId);
    else if (user.platformRole !== 'platform_admin') throw new ForbiddenException('Platform admin permission required');
    if (input.groupId) {
      const group = await query<{ community_id: string }>('SELECT community_id FROM groups WHERE id = $1 AND status = \'active\'', [input.groupId]);
      if (!group.rows[0] || group.rows[0].community_id !== input.communityId) throw new ForbiddenException('Group does not belong to the selected community');
    }
    const result = await query<Record<string, unknown>>(
      `INSERT INTO events (title, description, starts_at, timezone, zoom_url, visibility, community_id, group_id, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9) RETURNING id, title, description, starts_at, timezone, visibility, community_id, group_id, status`,
      [input.title.trim(), input.description?.trim() ?? '', new Date(input.startsAt), input.timezone ?? 'Asia/Riyadh', input.zoomUrl.trim(), input.visibility, input.communityId ?? null, input.groupId ?? null, user.id],
    );
    await query('INSERT INTO audit_events (actor_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)', [user.id, 'event_created', 'event', result.rows[0].id]);
    return result.rows[0];
  }

  async update(user: User, eventId: string, input: { title?: string; description?: string; startsAt?: string; zoomUrl?: string; status?: 'published' | 'cancelled' | 'completed' }) {
    const row = await this.getRow(eventId);
    if (user.platformRole !== 'platform_admin') {
      if (!row.community_id) throw new ForbiddenException('Permission denied');
      await this.communities.requireCommunityAdmin(user, String(row.community_id));
    }
    const result = await query<Record<string, unknown>>(
      `UPDATE events SET title = COALESCE($1, title), description = COALESCE($2, description), starts_at = COALESCE($3, starts_at), zoom_url = COALESCE($4, zoom_url), status = COALESCE($5, status), updated_at = now()
       WHERE id = $6 RETURNING id, title, description, starts_at, timezone, visibility, community_id, group_id, status`,
      [input.title?.trim() ?? null, input.description?.trim() ?? null, input.startsAt ? new Date(input.startsAt) : null, input.zoomUrl?.trim() ?? null, input.status ?? null, eventId],
    );
    if (input.status === 'cancelled') {
      await query(`INSERT INTO notifications (user_id, type, payload) SELECT user_id, 'event_cancelled', jsonb_build_object('eventId', $1) FROM event_registrations WHERE event_id = $1 AND status = 'registered'`, [eventId]);
    }
    return result.rows[0];
  }

  async register(user: User, eventId: string) {
    const row = await this.getRow(eventId);
    await this.requireAccess(user, row);
    if (row.status !== 'published') throw new ForbiddenException('Event is not open for registration');
    const result = await query<Record<string, unknown>>(
      `INSERT INTO event_registrations (event_id, user_id, status) VALUES ($1,$2,'registered')
       ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'registered', cancelled_at = NULL RETURNING *`,
      [eventId, user.id],
    );
    await query('INSERT INTO notifications (user_id, type, payload) VALUES ($1,$2,$3)', [user.id, 'event_registered', JSON.stringify({ eventId })]);
    return result.rows[0];
  }

  async cancelRegistration(user: User, eventId: string) {
    await query('UPDATE event_registrations SET status = \'cancelled\', cancelled_at = now() WHERE event_id = $1 AND user_id = $2', [eventId, user.id]);
    return { success: true };
  }

  private async getRow(eventId: string) {
    const result = await query<Record<string, any>>('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!result.rows[0]) throw new NotFoundException('Event not found');
    return result.rows[0];
  }

  private async requireAccess(user: User, row: Record<string, any>) {
    if (row.visibility === 'public' || user.platformRole === 'platform_admin') return;
    if (!row.community_id) throw new ForbiddenException('Private event is not configured correctly');
    await this.communities.requireActiveMember(user, String(row.community_id));
  }
}
