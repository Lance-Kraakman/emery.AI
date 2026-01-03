/**
 * Audit Trail Repository Interfaces
 */

import type { AuditEvent, AuditQueryFilters, RowHistoryEntry, TaskToolCall } from '../types';

export interface IAuditRepository {
  create(event: Omit<AuditEvent, 'id'>): Promise<AuditEvent>;
  query(organizationId: number, filters: AuditQueryFilters): Promise<AuditEvent[]>;
  getByResource(resourceType: string, resourceId: string, limit?: number): Promise<AuditEvent[]>;
  findExpired(options: { before: Date; limit: number }): Promise<AuditEvent[]>;
  markArchived(ids: number[]): Promise<void>;
  deleteArchived(options: { archivedBefore: Date }): Promise<number>;
}

export interface IRowHistoryRepository {
  create(entry: Omit<RowHistoryEntry, 'id'>): Promise<RowHistoryEntry>;
  getForRow(tableId: number, rowId: string, limit?: number): Promise<RowHistoryEntry[]>;
  getLatestVersion(tableId: number, rowId: string): Promise<number>;
  findExpired(options: { before: Date; limit: number }): Promise<RowHistoryEntry[]>;
  deleteExpired(options: { before: Date }): Promise<number>;
}

export interface ITaskToolCallRepository {
  create(entry: Omit<TaskToolCall, 'id'>): Promise<TaskToolCall>;
  getForTask(taskId: string): Promise<TaskToolCall[]>;
  bulkCreate(entries: Omit<TaskToolCall, 'id'>[]): Promise<TaskToolCall[]>;
}
