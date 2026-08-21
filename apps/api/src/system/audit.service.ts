import { Injectable } from '@nestjs/common';
import { query } from '../common/db';

@Injectable()
export class AuditService {
  async record(actorId: string | null, action: string, resourceType: string, resourceId?: string, metadata: Record<string, unknown> = {}) {
    await query(
      `INSERT INTO system.audit_events (actor_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [actorId, action, resourceType, resourceId ?? null, JSON.stringify(metadata)],
    );
  }
}
