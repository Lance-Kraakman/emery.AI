'use server';

import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission } from './permissions';
import {
  getSecurityAnalyzerService,
  getSecurityReportRepository,
  getSecurityFindingRepository,
  getAuditApplicationService,
} from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { SecurityReport, SecurityFinding, FindingStatus, RiskLevel } from '@/ddd/domain/security/types';
import type { Result } from './types';
import { revalidatePath } from 'next/cache';

// ============================================================================
// REPORT ACTIONS
// ============================================================================

/**
 * Generate a new security report for the organization
 * Requires agents:manage permission (security analysis is an admin function)
 */
export async function generateSecurityReport(): Promise<Result<SecurityReport>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const analyzerService = getSecurityAnalyzerService();
      const auditService = getAuditApplicationService();

      const result = await analyzerService.analyzeOrganization(
        session.user.currentOrganizationId!,
        session.user.id
      );

      // Audit log the report generation
      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'security',
          eventCategory: 'security_report',
          eventAction: 'generate',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'security_report',
          resourceId: result.success && result.data ? String(result.data.id) : undefined,
          eventData: {
            findingCounts: result.success && result.data ? result.data.reportData.findingCounts : undefined,
            riskGrade: result.success && result.data ? result.data.reportData.riskGrade : undefined,
          },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to generate security report',
        };
      }

      revalidatePath('/organization/security');

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error('Error generating security report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate security report',
      };
    }
  });
}

/**
 * List security reports for the organization
 * Requires agents:view permission
 */
export async function listSecurityReports(limit = 20): Promise<Result<SecurityReport[]>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:view');
      const reportRepository = getSecurityReportRepository();

      const reports = await reportRepository.findByOrganization(
        session.user.currentOrganizationId!,
        { limit }
      );

      return {
        success: true,
        data: reports,
      };
    } catch (error) {
      console.error('Error listing security reports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list security reports',
      };
    }
  });
}

/**
 * Get a security report with its findings
 * Requires agents:view permission
 */
export async function getSecurityReport(
  reportId: number
): Promise<Result<{ report: SecurityReport; findings: SecurityFinding[] }>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:view');
      const reportRepo = getSecurityReportRepository();
      const findingRepo = getSecurityFindingRepository();

      const report = await reportRepo.findById(reportId);
      if (!report) {
        return { success: false, error: 'Report not found' };
      }

      // Verify org access (RLS should handle this, but double-check)
      if (report.organizationId !== session.user.currentOrganizationId) {
        return { success: false, error: 'Unauthorized' };
      }

      const findings = await findingRepo.findByReportId(reportId);

      return {
        success: true,
        data: { report, findings },
      };
    } catch (error) {
      console.error('Error getting security report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get security report',
      };
    }
  });
}

/**
 * Delete a security report
 * Requires agents:manage permission
 */
export async function deleteSecurityReport(reportId: number): Promise<Result<{ id: number }>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const reportRepo = getSecurityReportRepository();
      const auditService = getAuditApplicationService();

      const report = await reportRepo.findById(reportId);
      if (!report || report.organizationId !== session.user.currentOrganizationId) {
        return { success: false, error: 'Report not found' };
      }

      await reportRepo.delete(reportId);

      // Audit log the deletion
      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'security',
          eventCategory: 'security_report',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'security_report',
          resourceId: String(reportId),
          eventData: {
            reportStatus: report.status,
            generatedAt: report.generatedAt.toISOString(),
          },
          success: true,
        }
      );

      revalidatePath('/organization/security');

      return {
        success: true,
        data: { id: reportId },
      };
    } catch (error) {
      console.error('Error deleting security report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete security report',
      };
    }
  });
}

// ============================================================================
// FINDING ACTIONS
// ============================================================================

/**
 * List findings for a report or organization
 * Requires agents:view permission
 */
export async function listSecurityFindings(
  filters?: { reportId?: number; riskLevel?: RiskLevel; status?: FindingStatus }
): Promise<Result<SecurityFinding[]>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:view');
      const findingRepo = getSecurityFindingRepository();

      const findings = await findingRepo.findByOrganization(
        session.user.currentOrganizationId!,
        filters
      );

      return {
        success: true,
        data: findings,
      };
    } catch (error) {
      console.error('Error listing security findings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list security findings',
      };
    }
  });
}

/**
 * Update a finding's status (acknowledge, mitigate, mark as false positive)
 * Requires agents:manage permission
 */
export async function updateFindingStatus(
  findingId: number,
  status: FindingStatus,
  reason?: string
): Promise<Result<SecurityFinding>> {
  return withAuthContext(async () => {
    try {
      // Auth check first - before any input validation
      const session = await requirePermission('agents:manage');

      // Then validate input
      const validStatuses: FindingStatus[] = ['open', 'acknowledged', 'mitigated', 'false_positive'];
      if (!validStatuses.includes(status)) {
        return {
          success: false,
          error: `Invalid status. Must be: ${validStatuses.join(', ')}`,
        };
      }

      const findingRepo = getSecurityFindingRepository();
      const auditService = getAuditApplicationService();

      const finding = await findingRepo.findById(findingId);
      if (!finding || finding.organizationId !== session.user.currentOrganizationId) {
        return { success: false, error: 'Finding not found' };
      }

      const previousStatus = finding.status;

      // Update status and add to history
      const updatedFindingData = {
        ...finding.findingData,
        statusHistory: [
          ...(finding.findingData.statusHistory || []),
          {
            status,
            changedBy: session.user.id,
            changedAt: new Date().toISOString(),
            reason,
          },
        ],
      };

      const updated = await findingRepo.updateStatus(findingId, status, updatedFindingData);

      // Audit log the status change
      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'security',
          eventCategory: 'security_finding',
          eventAction: 'update_status',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'security_finding',
          resourceId: String(findingId),
          eventData: {
            previousStatus,
            newStatus: status,
            reason,
            riskLevel: finding.riskLevel,
            ruleId: finding.findingData.ruleId,
          },
          success: true,
        }
      );

      revalidatePath('/organization/security');

      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      console.error('Error updating finding status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update finding status',
      };
    }
  });
}
