/**
 * Drizzle Security Finding Repository
 */

import type { DbClient } from '@/ddd/infrastructure/db/client';
import { securityFindings } from '@/ddd/infrastructure/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type {
  ISecurityFindingRepository,
  CreateSecurityFindingData,
} from '@/ddd/domain/security/interfaces/security-repository';
import type {
  SecurityFinding,
  SecurityFindingData,
  SecurityFindingFilters,
  RiskLevel,
  FindingStatus,
} from '@/ddd/domain/security/types';

export class DrizzleSecurityFindingRepository implements ISecurityFindingRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateSecurityFindingData): Promise<SecurityFinding> {
    const [result] = await this.db.insert(securityFindings).values({
      organizationId: data.organizationId,
      reportId: data.reportId,
      riskLevel: data.riskLevel,
      status: 'open',
      findingData: data.findingData,
    }).returning();

    return this.mapToEntity(result);
  }

  async createBulk(data: CreateSecurityFindingData[]): Promise<SecurityFinding[]> {
    if (data.length === 0) return [];

    const results = await this.db.insert(securityFindings).values(
      data.map((d) => ({
        organizationId: d.organizationId,
        reportId: d.reportId,
        riskLevel: d.riskLevel,
        status: 'open',
        findingData: d.findingData,
      }))
    ).returning();

    return results.map((r: typeof securityFindings.$inferSelect) => this.mapToEntity(r));
  }

  async findById(id: number): Promise<SecurityFinding | null> {
    const [result] = await this.db.select()
      .from(securityFindings)
      .where(eq(securityFindings.id, id));

    return result ? this.mapToEntity(result) : null;
  }

  async findByReportId(reportId: number): Promise<SecurityFinding[]> {
    const results = await this.db.select()
      .from(securityFindings)
      .where(eq(securityFindings.reportId, reportId))
      .orderBy(desc(securityFindings.detectedAt));

    return results.map((r: typeof securityFindings.$inferSelect) => this.mapToEntity(r));
  }

  async findByOrganization(
    organizationId: number,
    filters?: SecurityFindingFilters
  ): Promise<SecurityFinding[]> {
    const conditions = [eq(securityFindings.organizationId, organizationId)];

    if (filters?.reportId) {
      conditions.push(eq(securityFindings.reportId, filters.reportId));
    }
    if (filters?.riskLevel) {
      conditions.push(eq(securityFindings.riskLevel, filters.riskLevel));
    }
    if (filters?.status) {
      conditions.push(eq(securityFindings.status, filters.status));
    }

    const results = await this.db.select()
      .from(securityFindings)
      .where(and(...conditions))
      .orderBy(desc(securityFindings.detectedAt))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);

    return results.map((r: typeof securityFindings.$inferSelect) => this.mapToEntity(r));
  }

  async updateStatus(
    id: number,
    status: FindingStatus,
    findingData: SecurityFindingData
  ): Promise<SecurityFinding> {
    const [result] = await this.db.update(securityFindings)
      .set({
        status,
        findingData,
        updatedAt: new Date(),
      })
      .where(eq(securityFindings.id, id))
      .returning();

    return this.mapToEntity(result);
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(securityFindings)
      .where(eq(securityFindings.id, id));
  }

  async deleteByReportId(reportId: number): Promise<void> {
    await this.db.delete(securityFindings)
      .where(eq(securityFindings.reportId, reportId));
  }

  private mapToEntity(row: typeof securityFindings.$inferSelect): SecurityFinding {
    return {
      id: row.id,
      organizationId: row.organizationId,
      reportId: row.reportId,
      riskLevel: row.riskLevel as RiskLevel,
      status: row.status as FindingStatus,
      findingData: row.findingData as SecurityFindingData,
      detectedAt: row.detectedAt,
      updatedAt: row.updatedAt,
    };
  }
}
