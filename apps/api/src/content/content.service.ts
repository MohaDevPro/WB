import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { query } from '../common/db';
import { CommunitiesService } from '../communities/communities.service';

type User = { id: string; platformRole: string; emailVerifiedAt: string | null };

@Injectable()
export class ContentService {
  constructor(private readonly communities: CommunitiesService) {}

  async list(user: User, scopeType: 'community' | 'group', scopeId: string) {
    if (!(await this.communities.canAccessScope(user, scopeType, scopeId))) throw new ForbiddenException('You cannot access this feed');
    const result = await query<Record<string, unknown>>(
      `SELECT p.*, u.display_name AS author_name,
        (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count,
        (SELECT count(*)::int FROM post_reactions r WHERE r.post_id = p.id) AS like_count,
        EXISTS (SELECT 1 FROM post_reactions r WHERE r.post_id = p.id AND r.user_id = $3 AND r.reaction_type = 'like') AS liked
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.scope_type = $1 AND p.scope_id = $2 AND p.status = 'visible'
       ORDER BY p.created_at DESC LIMIT 50`,
      [scopeType, scopeId, user.id],
    );
    return result.rows;
  }

  async create(user: User, scopeType: 'community' | 'group', scopeId: string, body: string) {
    if (!(await this.communities.canAccessScope(user, scopeType, scopeId))) throw new ForbiddenException('You cannot post here');
    const result = await query<Record<string, unknown>>(
      'INSERT INTO posts (scope_type, scope_id, author_id, body) VALUES ($1,$2,$3,$4) RETURNING *',
      [scopeType, scopeId, user.id, body.trim()],
    );
    await query('INSERT INTO audit_events (actor_id, action, resource_type, resource_id) VALUES ($1,$2,$3,$4)', [user.id, 'post_created', 'post', result.rows[0].id]);
    return result.rows[0];
  }

  async update(user: User, postId: string, body: string) {
    const post = await this.post(postId);
    if (post.author_id !== user.id && user.platformRole !== 'platform_admin') throw new ForbiddenException('Only the author can edit this post');
    const result = await query<Record<string, unknown>>('UPDATE posts SET body = $1, updated_at = now() WHERE id = $2 RETURNING *', [body.trim(), postId]);
    return result.rows[0];
  }

  async delete(user: User, postId: string) {
    const post = await this.post(postId);
    if (post.author_id !== user.id && user.platformRole !== 'platform_admin') throw new ForbiddenException('Only the author or platform admin can delete this post');
    await query('UPDATE posts SET status = \'deleted\', updated_at = now() WHERE id = $1', [postId]);
    return { success: true };
  }

  async comments(user: User, postId: string) {
    const post = await this.post(postId);
    if (!(await this.communities.canAccessScope(user, post.scope_type, post.scope_id))) throw new ForbiddenException('You cannot access this post');
    const result = await query<Record<string, unknown>>(
      `SELECT c.*, u.display_name AS author_name FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1 AND c.status = 'visible' ORDER BY c.created_at ASC`,
      [postId],
    );
    return result.rows;
  }

  async comment(user: User, postId: string, body: string) {
    const post = await this.post(postId);
    if (!(await this.communities.canAccessScope(user, post.scope_type, post.scope_id))) throw new ForbiddenException('You cannot comment here');
    const result = await query<Record<string, unknown>>('INSERT INTO comments (post_id, author_id, body) VALUES ($1,$2,$3) RETURNING *', [postId, user.id, body.trim()]);
    if (post.author_id !== user.id) await query('INSERT INTO notifications (user_id, type, payload) VALUES ($1,$2,$3)', [post.author_id, 'post_commented', JSON.stringify({ postId })]);
    return result.rows[0];
  }

  async like(user: User, postId: string) {
    const post = await this.post(postId);
    if (!(await this.communities.canAccessScope(user, post.scope_type, post.scope_id))) throw new ForbiddenException('You cannot like here');
    await query('INSERT INTO post_reactions (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [postId, user.id]);
    return { liked: true };
  }

  async unlike(user: User, postId: string) {
    await query('DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2', [postId, user.id]);
    return { liked: false };
  }

  async report(user: User, input: { targetType: 'post' | 'comment'; targetId: string; reason: string }) {
    await query('INSERT INTO content_reports (reporter_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4)', [user.id, input.targetType, input.targetId, input.reason.trim()]);
    return { success: true };
  }

  async reports(user: User) {
    const result = await query<Record<string, any>>(
      `SELECT r.*, u.display_name AS reporter_name,
        COALESCE(p.scope_type, cp.scope_type, 'community') AS scope_type,
        COALESCE(p.scope_id, g.community_id, cp.scope_id) AS scope_id
       FROM content_reports r
       JOIN users u ON u.id = r.reporter_id
       LEFT JOIN posts p ON (r.target_type = 'post' AND p.id = r.target_id)
       LEFT JOIN comments c ON (r.target_type = 'comment' AND c.id = r.target_id)
       LEFT JOIN posts cp ON (r.target_type = 'comment' AND cp.id = c.post_id)
       LEFT JOIN groups g ON (COALESCE(p.scope_id, cp.scope_id) = g.id AND COALESCE(p.scope_type, cp.scope_type) = 'group')
       WHERE r.status = 'open' ORDER BY r.created_at ASC`,
    );
    if (user.platformRole === 'platform_admin') return result.rows;
    const visible: Record<string, unknown>[] = [];
    for (const report of result.rows) {
      const communityId = String(report.scope_id);
      try {
        await this.communities.requireCommunityAdmin(user, communityId);
        visible.push(report);
      } catch {
        // The report belongs to another community; do not reveal it.
      }
    }
    return visible;
  }

  async moderate(user: User, input: { reportId: string; targetType: 'post' | 'comment'; targetId: string; actionType: 'hide' | 'restore' | 'dismiss'; reason?: string }) {
    if (user.platformRole !== 'platform_admin') {
      const target = await this.targetScope(input.targetType, input.targetId);
      await this.communities.requireCommunityAdmin(user, target.communityId);
    }
    const table = input.targetType === 'post' ? 'posts' : 'comments';
    const status = input.actionType === 'hide' ? 'hidden' : input.actionType === 'restore' ? 'visible' : null;
    if (status) await query(`UPDATE ${table} SET status = $1, updated_at = now() WHERE id = $2`, [status, input.targetId]);
    await query('UPDATE content_reports SET status = $1 WHERE id = $2', [input.actionType === 'dismiss' ? 'dismissed' : 'actioned', input.reportId]);
    await query('INSERT INTO moderation_actions (moderator_id, target_type, target_id, action_type, reason) VALUES ($1,$2,$3,$4,$5)', [user.id, input.targetType, input.targetId, input.actionType, input.reason ?? '']);
    return { success: true };
  }

  private async targetScope(targetType: 'post' | 'comment', targetId: string) {
    const result = targetType === 'post'
      ? await query<{ scope_type: string; scope_id: string }>('SELECT scope_type, scope_id FROM posts WHERE id = $1', [targetId])
      : await query<{ scope_type: string; scope_id: string }>('SELECT p.scope_type, p.scope_id FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = $1', [targetId]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Content not found');
    if (row.scope_type === 'community') return { communityId: row.scope_id };
    const group = await query<{ community_id: string }>('SELECT community_id FROM groups WHERE id = $1', [row.scope_id]);
    if (!group.rows[0]) throw new NotFoundException('Group not found');
    return { communityId: group.rows[0].community_id };
  }

  private async post(postId: string) {
    const result = await query<Record<string, any>>('SELECT * FROM posts WHERE id = $1 AND status <> \'deleted\'', [postId]);
    if (!result.rows[0]) throw new NotFoundException('Post not found');
    return result.rows[0];
  }
}
