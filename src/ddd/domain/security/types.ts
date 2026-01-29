/**
 * Security Analysis Domain Types
 *
 * Types for security report generation and findings management.
 * Based on OWASP LLM Top 10 (2025), Agentic AI Top 10 (2026), and Web Top 10 (2025).
 */

// ============================================================================
// ENUMS & LITERAL TYPES
// ============================================================================

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'acknowledged' | 'mitigated' | 'false_positive';
export type ReportStatus = 'generating' | 'completed' | 'failed';
export type OwaspCategory = 'LLM_2025' | 'AGENTIC_2026' | 'WEB_2025';
export type ResourceType = 'agent' | 'skill' | 'automation' | 'delegation';

// ============================================================================
// SECURITY REPORT
// ============================================================================

/**
 * Security Report entity (maps to securityReports table)
 */
export interface SecurityReport {
  readonly id: number;
  readonly organizationId: number;
  readonly createdBy: string;
  readonly status: ReportStatus;
  readonly reportData: SecurityReportData;
  readonly generatedAt: Date;
  readonly completedAt?: Date;
}

/**
 * Report data JSONB blob (stored in securityReports.reportData)
 */
export interface SecurityReportData {
  reportType: 'full' | 'agent' | 'skill' | 'incremental';
  version: number;

  // Scores
  overallScore: number;
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Finding counts by severity
  findingCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };

  // OWASP violations found
  owaspViolations: {
    llm2025: string[];
    agentic2026: string[];
    web2025: string[];
  };

  // Entity summaries (denormalized for fast display)
  agentProfiles: Array<{
    agentId: number;
    agentName: string;
    riskScore: number;
    findingCount: number;
  }>;

  // Authorized access (informational, not findings)
  authorizedAccess: {
    approvedPlans: Array<{
      skillId: number;
      skillName: string;
      approvedAt: string;
      approvedBy: string;
    }>;
    delegations: Array<{
      agentId: number;
      agentName: string;
      services: string[];
      ownerId: string;
    }>;
    apiTokens: Array<{
      agentId: number;
      agentName: string;
      hasApiKey: boolean;
      hasWebhook: boolean;
    }>;
  };

  // Security strengths (positive findings)
  strengths: Array<{
    category: string;
    title: string;
    description: string;
    resourceType: string;
    resourceId?: string;
  }>;

  // Top recommendations
  topRecommendations: string[];
}

// ============================================================================
// SECURITY FINDING
// ============================================================================

/**
 * Security Finding entity (maps to securityFindings table)
 */
export interface SecurityFinding {
  readonly id: number;
  readonly organizationId: number;
  readonly reportId: number;
  readonly riskLevel: RiskLevel;
  readonly status: FindingStatus;
  readonly findingData: SecurityFindingData;
  readonly detectedAt: Date;
  readonly updatedAt: Date;
}

/**
 * Finding data JSONB blob (stored in securityFindings.findingData)
 */
export interface SecurityFindingData {
  ruleId: string;
  title: string;
  description: string;

  // OWASP mapping
  owaspRefs: Array<{
    category: OwaspCategory;
    code: string;
    name: string;
  }>;

  // Resource info
  resource: {
    type: ResourceType;
    id: string;
    name: string;
    path?: string; // e.g., 'agent:123/automation:456'
  };

  // Evidence
  evidence: {
    affectedComponents: string[];
    attackVector?: string;
    rawData?: Record<string, unknown>;
  };

  // Remediation
  remediation: {
    recommendation: string;
    steps?: string[];
    priority: number; // 1-100
  };

  // Status changes (audit trail)
  statusHistory?: Array<{
    status: FindingStatus;
    changedBy: string;
    changedAt: string;
    reason?: string;
  }>;
}

// ============================================================================
// QUERY FILTERS
// ============================================================================

export interface SecurityReportFilters {
  status?: ReportStatus;
  reportType?: SecurityReportData['reportType'];
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export interface SecurityFindingFilters {
  reportId?: number;
  riskLevel?: RiskLevel;
  status?: FindingStatus;
  resourceType?: ResourceType;
  limit?: number;
  offset?: number;
}

// ============================================================================
// RULE TYPES (for Rule Engine)
// ============================================================================

export interface OwaspReference {
  category: OwaspCategory;
  code: string;
  name: string;
}

export interface RuleViolation {
  ruleId: string;
  riskLevel: RiskLevel;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  findingData: Omit<SecurityFindingData, 'statusHistory'>;
}
