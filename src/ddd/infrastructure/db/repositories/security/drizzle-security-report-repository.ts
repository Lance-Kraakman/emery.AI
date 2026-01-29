/**
 * Drizzle Security Report Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { securityReports } from '@/ddd/infrastructure/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type {
  ISecurityReportRepository,
  CreateSecurityReportData,
} from '@/ddd/domain/security/interfaces/security-repository';
import type {
  SecurityReport,
  SecurityReportData,
  SecurityReportFilters,
  ReportStatus,
} from '@/ddd/domain/security/types';

export class DrizzleSecurityReportRepository implements ISecurityReportRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateSecurityReportData): Promise<SecurityReport> {
    const [result] = await this.db.insert(securityReports).values({
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      status: 'generating',
      reportData: data.reportData,
    }).returning();

    return this.mapToEntity(result);
  }

  async findById(id: number): Promise<SecurityReport | null> {
    const [result] = await this.db.select()
      .from(securityReports)
      .where(eq(securityReports.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findByOrganization(
    organizationId: number,
    filters?: SecurityReportFilters
  ): Promise<SecurityReport[]> {
    const conditions = [eq(securityReports.organizationId, organizationId)];

    if (filters?.status) {
      conditions.push(eq(securityReports.status, filters.status));
    }
    if (filters?.after) {
      conditions.push(gte(securityReports.generatedAt, filters.after));
    }
    if (filters?.before) {
      conditions.push(lte(securityReports.generatedAt, filters.before));
    }

    const results = await this.db.select()
      .from(securityReports)
      .where(and(...conditions))
      .orderBy(desc(securityReports.generatedAt))
      .limit(filters?.limit ?? 20)
      .offset(filters?.offset ?? 0);

    return results.map((r: typeof securityReports.$inferSelect) => this.mapToEntity(r));
  }

  async updateStatus(
    id: number,
    status: ReportStatus,
    completedAt?: Date
  ): Promise<SecurityReport> {
    const [result] = await this.db.update(securityReports)
      .set({
        status,
        completedAt: completedAt ?? null,
      })
      .where(eq(securityReports.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async updateReportData(
    id: number,
    reportData: SecurityReportData
  ): Promise<SecurityReport> {
    const [result] = await this.db.update(securityReports)
      .set({ reportData })
      .where(eq(securityReports.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(securityReports)
      .where(eq(securityReports.id, id));
  }

  private mapToEntity(row: typeof securityReports.$inferSelect): SecurityReport {
    return {
      id: row.id,
      organizationId: row.organizationId,
      createdBy: row.createdBy,
      status: row.status as ReportStatus,
      reportData: row.reportData as SecurityReportData,
      generatedAt: row.generatedAt,
      completedAt: row.completedAt ?? undefined,
    };
  }
}
