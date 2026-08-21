import { describe, expect, it, vi } from 'vitest';
import { ContentService } from './content.service';

const { query, transaction } = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../common/db', () => ({ query, transaction }));

describe('ContentService V0 boundaries', () => {
  const communities = { canAccessScope: vi.fn().mockResolvedValue(true) };
  const notifications = { notifyPost: vi.fn() };
  const auditService = { record: vi.fn() };

  it('rejects an empty post before checking scope or opening a transaction', async () => {
    const service = new ContentService(communities as never, notifications as never, auditService as never);
    await expect(service.create({ id: 'user-1', platformRole: 'member', emailVerifiedAt: 'now' }, 'community', 'community-1', '   '))
      .rejects.toThrow('Content body is required');
    expect(communities.canAccessScope).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an empty comment before reading a post', async () => {
    const service = new ContentService(communities as never, notifications as never, auditService as never);
    await expect(service.comment({ id: 'user-1', platformRole: 'member', emailVerifiedAt: 'now' }, 'post-1', '\n'))
      .rejects.toThrow('Content body is required');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects an empty report reason before resolving the target', async () => {
    const service = new ContentService(communities as never, notifications as never, auditService as never);
    await expect(service.report({ id: 'user-1', platformRole: 'member', emailVerifiedAt: 'now' }, { targetType: 'post', targetId: 'post-1', reason: '  ' }))
      .rejects.toThrow('Content body is required');
    expect(query).not.toHaveBeenCalled();
  });
});
