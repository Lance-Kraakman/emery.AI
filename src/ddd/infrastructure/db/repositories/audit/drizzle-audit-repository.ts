/**
 * Drizzle Audit Repository
 */

import type { DbClient } from '@/lib/db/client';
import { auditEvents } from '@/lib/db/schema';
import { eq, and, lt, isNull, desc, gte, lte, inArray } from 'drizzle-orm';
import type { IAuditRepository } from '@/ddd/domain/audit/interfaces/audit-repository';
import type { AuditEvent, AuditQueryFilters } from '@/ddd/domain/audit/types';

export class DrizzleAuditRepository implements IAuditRepository {
  constructor(private readonly db: DbClient) {}

  async create(event: Omit<AuditEvent, 'id'>): Promise<AuditEvent> {
    const [result] = await this.db.insert(auditEvents).values({
      organizationId: event.organizationId,
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      eventAction: event.eventAction,
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      actorName: event.actorName ?? null,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? null,
      resourceName: event.resourceName ?? null,
      parentResourceType: event.parentResourceType ?? null,
      parentResourceId: event.parentResourceId ?? null,
      eventData: event.eventData,
      previousData: event.previousData ?? null,
      metadata: event.metadata ?? null,
      occurredAt: event.occurredAt,
      durationMs: event.durationMs ?? null,
      success: event.success ?? true,
      error: event.error ?? null,
      expiresAt: event.expiresAt ?? null,
    }).returning();

    return this.mapToEntity(result);
  }

  async query(organizationId: number, filters: AuditQueryFilters): Promise<AuditEvent[]> {
    const conditions = [eq(auditEvents.organizationId, organizationId)];

    if (filters.eventType) conditions.push(eq(auditEvents.eventType, filters.eventType));
    if (filters.eventCategory) conditions.push(eq(auditEvents.eventCategory, filters.eventCategory));
    if (filters.actorType) conditions.push(eq(auditEvents.actorType, filters.actorType));
    if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
    if (filters.resourceType) conditions.push(eq(auditEvents.resourceType, filters.resourceType));
    if (filters.resourceId) conditions.push(eq(auditEvents.resourceId, filters.resourceId));
    if (filters.after) conditions.push(gte(auditEvents.occurredAt, filters.after));
    if (filters.before) conditions.push(lte(auditEvents.occurredAt, filters.before));

    const results = await this.db.select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0);

    return results.map((r: typeof auditEvents.$inferSelect) => this.mapToEntity(r));
  }

  async getByResource(resourceType: string, resourceId: string, limit = 50): Promise<AuditEvent[]> {
    const results = await this.db.select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.resourceType, resourceType),
        eq(auditEvents.resourceId, resourceId)
      ))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);

    return results.map((r: typeof auditEvents.$inferSelect) => this.mapToEntity(r));
  }

  async findExpired(options: { before: Date; limit: number }): Promise<AuditEvent[]> {
    const results = await this.db.select()
      .from(auditEvents)
      .where(and(
        lt(auditEvents.expiresAt, options.before),
        isNull(auditEvents.archivedAt)
      ))
      .limit(options.limit);

    return results.map((r: typeof auditEvents.$inferSelect) => this.mapToEntity(r));
  }

  async markArchived(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.update(auditEvents)
      .set({ archivedAt: new Date() })
      .where(inArray(auditEvents.id, ids));
  }

  async deleteArchived(options: { archivedBefore: Date }): Promise<number> {
    const result = await this.db.delete(auditEvents)
      .where(lt(auditEvents.archivedAt, options.archivedBefore));
    return result.rowCount ?? 0;
  }

  private mapToEntity(row: typeof auditEvents.$inferSelect): AuditEvent {
    return {
      id: row.id,
      organizationId: row.organizationId,
      eventType: row.eventType as AuditEvent['eventType'],
      eventCategory: row.eventCategory,
      eventAction: row.eventAction,
      actorType: row.actorType as AuditEvent['actorType'],
      actorId: row.actorId ?? undefined,
      actorName: row.actorName ?? undefined,
      resourceType: row.resourceType,
      resourceId: row.resourceId ?? undefined,
      resourceName: row.resourceName ?? undefined,
      parentResourceType: row.parentResourceType ?? undefined,
      parentResourceId: row.parentResourceId ?? undefined,
      eventData: (row.eventData ?? {}) as Record<string, unknown>,
      previousData: row.previousData as Record<string, unknown> | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      occurredAt: row.occurredAt,
      durationMs: row.durationMs ?? undefined,
      success: row.success,
      error: row.error ?? undefined,
      expiresAt: row.expiresAt ?? undefined,
      archivedAt: row.archivedAt ?? undefined,
    };
  }
}
