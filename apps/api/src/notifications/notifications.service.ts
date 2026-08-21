import { Injectable } from '@nestjs/common';
import { query } from '../common/db';

@Injectable()
export class NotificationsService {
  async list(userId: string) {
    const result = await query<Record<string, unknown>>(
      `SELECT n.id, n.notification_type, n.read_at, n.created_at,
              n.actor_id,
              np.post_id,
              ne.occurrence_id,
              ne.event_kind,
              nm.membership_id,
              nm.decision
       FROM system.notifications n
       LEFT JOIN system.notification_posts np ON np.notification_id = n.id
       LEFT JOIN system.notification_events ne ON ne.notification_id = n.id
       LEFT JOIN system.notification_memberships nm ON nm.notification_id = n.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId],
    );
    return result.rows;
  }

  async markRead(userId: string, id: string) {
    await query(
      'UPDATE system.notifications SET read_at = now() WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return { success: true };
  }

  async notifyPost(recipientId: string, actorId: string, postId: string, type = 'post_commented') {
    const notification = await query<{ id: string }>(
      `INSERT INTO system.notifications (user_id, actor_id, notification_type, dedupe_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [recipientId, actorId, type, `${type}:${postId}:${actorId}`],
    );
    if (notification.rows[0]) {
      await query(
        'INSERT INTO system.notification_posts (notification_id, post_id) VALUES ($1, $2)',
        [notification.rows[0].id, postId],
      );
    }
  }

  async notifyEvent(recipientId: string, actorId: string, occurrenceId: string, eventKind: 'registered' | 'cancelled' | 'updated') {
    const notification = await query<{ id: string }>(
      `INSERT INTO system.notifications (user_id, actor_id, notification_type, dedupe_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedupe_key) DO UPDATE SET read_at = NULL
       RETURNING id`,
      [recipientId, actorId, `event_${eventKind}`, `event:${occurrenceId}:${recipientId}:${eventKind}`],
    );
    await query(
      `INSERT INTO system.notification_events (notification_id, occurrence_id, event_kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (notification_id) DO NOTHING`,
      [notification.rows[0].id, occurrenceId, eventKind],
    );
  }

  async notifyMembership(recipientId: string, actorId: string, membershipId: string, requestId: string, decision: 'active' | 'rejected') {
    const notification = await query<{ id: string }>(
      `INSERT INTO system.notifications (user_id, actor_id, notification_type, dedupe_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [recipientId, actorId, `membership_${decision}`, `membership:${requestId}:${decision}`],
    );
    if (notification.rows[0]) {
      await query(
        `INSERT INTO system.notification_memberships (notification_id, membership_id, decision)
         VALUES ($1, $2, $3)`,
        [notification.rows[0].id, membershipId, decision],
      );
    }
  }
}
