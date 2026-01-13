/**
 * Drizzle Row History Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { rowHistory } from '@/ddd/infrastructure/db/schema';
import { eq, and, desc, lt, max } from 'drizzle-orm';
import type { IRowHistoryRepository } from '@/ddd/domain/audit/interfaces/audit-repository';
import type { RowHistoryEntry } from '@/ddd/domain/audit/types';

export class DrizzleRowHistoryRepository implements IRowHistoryRepository {
  constructor(private readonly db: DbClient) {}

  async create(entry: Omit<RowHistoryEntry, 'id'>): Promise<RowHistoryEntry> {
    const [result] = await this.db.insert(rowHistory).values({
      organizationId: entry.organizationId,
      tableId: entry.tableId,
      rowId: entry.rowId,
      operation: entry.operation,
      version: entry.version,
      fieldChanges: entry.fieldChanges ?? null,
      rowSnapshot: entry.rowSnapshot ?? null,
      changedByType: entry.changedByType,
      changedById: entry.changedById ?? null,
      changedByName: entry.changedByName ?? null,
      changedAt: entry.changedAt,
      expiresAt: entry.expiresAt ?? null,
    }).returning();

    return this.mapToEntity(result);
  }

  async getForRow(tableId: number, rowId: string, limit = 50): Promise<RowHistoryEntry[]> {
    const results = await this.db.select()
      .from(rowHistory)
      .where(and(
        eq(rowHistory.tableId, tableId),
        eq(rowHistory.rowId, rowId)
      ))
      .orderBy(desc(rowHistory.version))
      .limit(limit);

    return results.map((r: typeof rowHistory.$inferSelect) => this.mapToEntity(r));
  }

  async getLatestVersion(tableId: number, rowId: string): Promise<number> {
    const [result] = await this.db.select({ maxVersion: max(rowHistory.version) })
      .from(rowHistory)
      .where(and(
        eq(rowHistory.tableId, tableId),
        eq(rowHistory.rowId, rowId)
      ));

    return result?.maxVersion ?? 0;
  }

  async findExpired(options: { before: Date; limit: number }): Promise<RowHistoryEntry[]> {
    const results = await this.db.select()
      .from(rowHistory)
      .where(lt(rowHistory.expiresAt, options.before))
      .limit(options.limit);

    return results.map((r: typeof rowHistory.$inferSelect) => this.mapToEntity(r));
  }

  async deleteExpired(options: { before: Date }): Promise<number> {
    const result = await this.db.delete(rowHistory)
      .where(lt(rowHistory.expiresAt, options.before));
    return result.rowCount ?? 0;
  }

  private mapToEntity(row: typeof rowHistory.$inferSelect): RowHistoryEntry {
    return {
      id: row.id,
      organizationId: row.organizationId,
      tableId: Number(row.tableId),
      rowId: row.rowId,
      operation: row.operation as RowHistoryEntry['operation'],
      version: row.version,
      fieldChanges: row.fieldChanges as RowHistoryEntry['fieldChanges'],
      rowSnapshot: row.rowSnapshot as RowHistoryEntry['rowSnapshot'],
      changedByType: row.changedByType as RowHistoryEntry['changedByType'],
      changedById: row.changedById ?? undefined,
      changedByName: row.changedByName ?? undefined,
      changedAt: row.changedAt,
      expiresAt: row.expiresAt ?? undefined,
    };
  }
}
