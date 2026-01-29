/**
 * Security Repository Interfaces
 */

import type {
  SecurityReport,
  SecurityReportData,
  SecurityFinding,
  SecurityFindingData,
  SecurityReportFilters,
  SecurityFindingFilters,
  ReportStatus,
  FindingStatus,
} from '../types';

// ============================================================================
// CREATE DATA TYPES
// ============================================================================

export interface CreateSecurityReportData {
  organizationId: number;
  createdBy: string;
  reportData: SecurityReportData;
}

export interface CreateSecurityFindingData {
  organizationId: number;
  reportId: number;
  riskLevel: string;
  findingData: SecurityFindingData;
}

// ============================================================================
// SECURITY REPORT REPOSITORY
// ============================================================================

export interface ISecurityReportRepository {
  /**
   * Create a new security report
   */
  create(data: CreateSecurityReportData): Promise<SecurityReport>;

  /**
   * Find a report by ID
   */
  findById(id: number): Promise<SecurityReport | null>;

  /**
   * Find reports by organization
   */
  findByOrganization(
    organizationId: number,
    filters?: SecurityReportFilters
  ): Promise<SecurityReport[]>;

  /**
   * Update report status
   */
  updateStatus(
    id: number,
    status: ReportStatus,
    completedAt?: Date
  ): Promise<SecurityReport>;

  /**
   * Update report data (after analysis completes)
   */
  updateReportData(
    id: number,
    reportData: SecurityReportData
  ): Promise<SecurityReport>;

  /**
   * Delete a report (cascade deletes findings)
   */
  delete(id: number): Promise<void>;
}

// ============================================================================
// SECURITY FINDING REPOSITORY
// ============================================================================

export interface ISecurityFindingRepository {
  /**
   * Create a single finding
   */
  create(data: CreateSecurityFindingData): Promise<SecurityFinding>;

  /**
   * Bulk create findings (efficient for report generation)
   */
  createBulk(data: CreateSecurityFindingData[]): Promise<SecurityFinding[]>;

  /**
   * Find a finding by ID
   */
  findById(id: number): Promise<SecurityFinding | null>;

  /**
   * Find findings by report ID
   */
  findByReportId(reportId: number): Promise<SecurityFinding[]>;

  /**
   * Find findings by organization with filters
   */
  findByOrganization(
    organizationId: number,
    filters?: SecurityFindingFilters
  ): Promise<SecurityFinding[]>;

  /**
   * Update finding status (and findingData for status history)
   */
  updateStatus(
    id: number,
    status: FindingStatus,
    findingData: SecurityFindingData
  ): Promise<SecurityFinding>;

  /**
   * Delete a finding
   */
  delete(id: number): Promise<void>;

  /**
   * Delete all findings for a report
   */
  deleteByReportId(reportId: number): Promise<void>;
}
