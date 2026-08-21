import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { query, transaction } from '../common/db';
import { CommunitiesService } from '../communities/communities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../system/audit.service';

type User = { id: string; platformRole: string; emailVerifiedAt: string | null };
type ScopeType = 'community' | 'group';
type TargetType = 'post' | 'comment';

@Injectable()
export class ContentService {
  constructor(
    private readonly communities: CommunitiesService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: User, scopeType: ScopeType, scopeId: string) {
    if (!(await this.communities.canAccessScope(user, scopeType, scopeId))) {
      throw new ForbiddenException('You cannot access this feed');
    }
    const result = await query<Record<string, unknown>>(
      `SELECT pf.*, p.display_name AS author_name,
        (SELECT count(*)::int FROM content.comments c WHERE c.post_id = pf.id AND c.status = 'visible') AS comment_count,
        (SELECT count(*)::int FROM content.reactions r WHERE r.post_id = pf.id AND r.reaction_type = 'like') AS like_count,
        EXISTS (SELECT 1 FROM content.reactions r WHERE r.post_id = pf.id AND r.user_id = $3 AND r.reaction_type = 'like') AS liked
       FROM content.post_feed pf
       JOIN profile.profiles p ON p.user_id = pf.author_id
       WHERE pf.scope_type = $1 AND pf.scope_id = $2 AND pf.status = 'visible'
       ORDER BY pf.created_at DESC LIMIT 50`,
      [scopeType, scopeId, user.id],
    );
    return result.rows;
  }

  async create(user: User, scopeType: ScopeType, scopeId: string, body: string) {
    if (!(await this.communities.canAccessScope(user, scopeType, scopeId))) {
      throw new ForbiddenException('You cannot post here');
    }
    const post = await transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        'INSERT INTO content.posts (author_id, body) VALUES ($1, $2) RETURNING *',
        [user.id, body.trim()],
      );
      if (scopeType === 'community') {
        await client.query(
          'INSERT INTO content.community_posts (post_id, community_id) VALUES ($1, $2)',
          [result.rows[0].id, scopeId],
        );
      } else {
        await client.query(
          'INSERT INTO content.group_posts (post_id, group_id) VALUES ($1, $2)',
          [result.rows[0].id, scopeId],
        );
      }
      return result.rows[0];
    });
    await this.auditService.record(user.id, 'post_created', 'post', String(post.id));
    return post;
  }

  async update(user: User, postId: string, body: string) {
    const post = await this.post(postId);
    if (post.author_id !== user.id && user.platformRole !== 'platform_admin') {
      throw new ForbiddenException('Only the author can edit this post');
    }
    const result = await query<Record<string, unknown>>(
      'UPDATE content.posts SET body = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [body.trim(), postId],
    );
    return result.rows[0];
  }

  async delete(user: User, postId: string) {
    const post = await this.post(postId);
    if (post.author_id !== user.id && user.platformRole !== 'platform_admin') {
      throw new ForbiddenException('Only the author or platform admin can delete this post');
    }
    await query("UPDATE content.posts SET status = 'deleted', updated_at = now() WHERE id = $1", [postId]);
    await this.auditService.record(user.id, 'post_deleted', 'post', postId);
    return { success: true };
  }

  async comments(user: User, postId: string) {
    await this.post(postId);
    const scope = await this.targetScope('post', postId);
    if (!(await this.communities.canAccessScope(user, scope.scopeType, scope.scopeId))) {
      throw new ForbiddenException('You cannot access this post');
    }
    const result = await query<Record<string, unknown>>(
      `SELECT c.*, p.display_name AS author_name
       FROM content.comments c
       JOIN profile.profiles p ON p.user_id = c.author_id
       WHERE c.post_id = $1 AND c.status = 'visible'
       ORDER BY c.created_at ASC`,
      [postId],
    );
    return result.rows;
  }

  async comment(user: User, postId: string, body: string) {
    const post = await this.post(postId);
    const scope = await this.targetScope('post', postId);
    if (!(await this.communities.canAccessScope(user, scope.scopeType, scope.scopeId))) {
      throw new ForbiddenException('You cannot comment here');
    }
    const result = await query<Record<string, unknown>>(
      'INSERT INTO content.comments (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING *',
      [postId, user.id, body.trim()],
    );
    if (post.author_id !== user.id) {
      await this.notifications.notifyPost(post.author_id, user.id, postId);
    }
    return result.rows[0];
  }

  async like(user: User, postId: string) {
    const scope = await this.targetScope('post', postId);
    if (!(await this.communities.canAccessScope(user, scope.scopeType, scope.scopeId))) {
      throw new ForbiddenException('You cannot like here');
    }
    await query(
      `INSERT INTO content.reactions (post_id, user_id, reaction_type)
       VALUES ($1, $2, 'like') ON CONFLICT DO NOTHING`,
      [postId, user.id],
    );
    return { liked: true };
  }

  async unlike(user: User, postId: string) {
    const scope = await this.targetScope('post', postId);
    if (!(await this.communities.canAccessScope(user, scope.scopeType, scope.scopeId))) {
      throw new ForbiddenException('You cannot unlike here');
    }
    await query(
      "DELETE FROM content.reactions WHERE post_id = $1 AND user_id = $2 AND reaction_type = 'like'",
      [postId, user.id],
    );
    return { liked: false };
  }

  async report(user: User, input: { targetType: TargetType; targetId: string; reason: string }) {
    const target = await this.targetScope(input.targetType, input.targetId);
    if (!(await this.communities.canAccessScope(user, target.scopeType, target.scopeId))) {
      throw new ForbiddenException('You cannot report content outside your access');
    }
    const report = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO moderation.reports (reporter_id, community_id, reason)
         VALUES ($1, $2, $3) RETURNING id`,
        [user.id, target.communityId, input.reason.trim()],
      );
      if (input.targetType === 'post') {
        await client.query(
          'INSERT INTO moderation.report_post_targets (report_id, post_id) VALUES ($1, $2)',
          [created.rows[0].id, input.targetId],
        );
      } else {
        await client.query(
          'INSERT INTO moderation.report_comment_targets (report_id, comment_id) VALUES ($1, $2)',
          [created.rows[0].id, input.targetId],
        );
      }
      return created.rows[0];
    });
    await this.auditService.record(user.id, 'content_reported', 'report', report.id);
    return { success: true, id: report.id };
  }

  async reports(user: User) {
    const result = await query<Record<string, any>>(
      `SELECT rq.*, p.display_name AS reporter_name
       FROM moderation.report_queue rq
       JOIN profile.profiles p ON p.user_id = rq.reporter_id
       WHERE rq.status = 'open' AND rq.target_type IN ('post', 'comment')
       ORDER BY rq.created_at ASC`,
    );
    if (user.platformRole === 'platform_admin') return result.rows;
    const visible: Record<string, unknown>[] = [];
    for (const report of result.rows) {
      if (!report.community_id) continue;
      try {
        await this.communities.requireCommunityAdmin(user, String(report.community_id));
        visible.push(report);
      } catch {
        // The report belongs to another community; do not reveal it.
      }
    }
    return visible;
  }

  async moderate(user: User, input: { reportId: string; targetType: TargetType; targetId: string; actionType: 'hide' | 'restore' | 'dismiss'; reason?: string }) {
    const linked = await query(
      `SELECT 1 FROM moderation.report_queue
       WHERE id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`,
      [input.reportId, input.targetType, input.targetId],
    );
    if (linked.rowCount !== 1) throw new NotFoundException('Open report target not found');
    const target = await this.targetScope(input.targetType, input.targetId);
    if (user.platformRole !== 'platform_admin') {
      await this.communities.requireCommunityAdmin(user, target.communityId);
    }
    const table = input.targetType === 'post' ? 'content.posts' : 'content.comments';
    const status = input.actionType === 'hide' ? 'hidden' : input.actionType === 'restore' ? 'visible' : null;
    await transaction(async (client) => {
      if (status) {
        await client.query(`UPDATE ${table} SET status = $1, updated_at = now() WHERE id = $2`, [status, input.targetId]);
      }
      await client.query(
        'UPDATE moderation.reports SET status = $1, updated_at = now() WHERE id = $2',
        [input.actionType === 'dismiss' ? 'dismissed' : 'actioned', input.reportId],
      );
      await client.query(
        `INSERT INTO moderation.actions (report_id, moderator_id, action_type, reason)
         VALUES ($1, $2, $3, $4)`,
        [input.reportId, user.id, input.actionType, input.reason ?? ''],
      );
    });
    await this.auditService.record(user.id, `moderation_${input.actionType}`, 'report', input.reportId);
    return { success: true };
  }

  private async targetScope(targetType: TargetType, targetId: string) {
    const result = targetType === 'post'
      ? await query<{ scope_type: ScopeType; scope_id: string }>(
          'SELECT scope_type, scope_id FROM content.post_feed WHERE id = $1',
          [targetId],
        )
      : await query<{ scope_type: ScopeType; scope_id: string }>(
          `SELECT pf.scope_type, pf.scope_id
           FROM content.comments c
           JOIN content.post_feed pf ON pf.id = c.post_id
           WHERE c.id = $1`,
          [targetId],
        );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Content not found');
    if (row.scope_type === 'community') {
      return { communityId: row.scope_id, scopeType: row.scope_type, scopeId: row.scope_id };
    }
    const group = await query<{ community_id: string }>(
      'SELECT community_id FROM community.groups WHERE id = $1 AND status = \'active\'',
      [row.scope_id],
    );
    if (!group.rows[0]) throw new NotFoundException('Group not found');
    return { communityId: group.rows[0].community_id, scopeType: row.scope_type, scopeId: row.scope_id };
  }

  private async post(postId: string) {
    const result = await query<Record<string, any>>(
      "SELECT * FROM content.posts WHERE id = $1 AND status <> 'deleted'",
      [postId],
    );
    if (!result.rows[0]) throw new NotFoundException('Post not found');
    return result.rows[0];
  }

}
