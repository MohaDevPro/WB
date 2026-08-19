import { Injectable } from '@nestjs/common';
import { query } from '../common/db';

@Injectable()
export class NotificationsService {
  async list(userId: string) {
    const result = await query<Record<string, unknown>>(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId],
    );
    return result.rows;
  }

  async markRead(userId: string, id: string) {
    await query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [id, userId]);
    return { success: true };
  }
}
