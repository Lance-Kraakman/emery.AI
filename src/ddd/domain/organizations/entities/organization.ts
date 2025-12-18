// AIDEV-NOTE: Updated Organization entity to use DDD Value Objects for type safety
import { 
  OrganizationId, 
  UserId, 
  AgentId, 
  TeamId,
  OrganizationName,
  EmailAddress,
  MeasurementCategory,
  CalculationFrequency
} from '@/ddd/domain/shared/value-objects';
import { SystemRoleType } from '@/ddd/domain/rbac/entities/role';

export interface Organization {
  id: OrganizationId;
  name: OrganizationName;
  slug?: string | null;
  mission?: string | null;
  sharedTools?: string[] | null;
  sharedServers?: string[] | null;
  databaseId?: string | null;
  viewConfig?: Record<string, any> | null;
  plan?: 'free' | 'pro' | 'max' | 'enterprise' | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  analysisCapabilities?: OrganizationAnalysisCapabilities | null;
  // Model and billing configuration
  defaultModel?: string | null;
  availableModels?: string[] | null;
  tokenQuotaMonthly?: number | null;
  tokenUsageCurrentMonth?: number;
  quotaResetAt?: Date | null;
  // Credit system fields (user-facing billing)
  creditBalance?: number;
  creditsUsedCurrentMonth?: number;
  creditsResetAt?: Date | null;
  // Pay-as-you-go subscription billing fields
  usageAllowanceCredits?: number;
  spendingLimitUsd?: string | null;
  customPriceId?: string | null;
  billingEmail?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  // Storage quota and tracking fields (for tier-based storage limits)
  storageQuotaBytes?: number;
  storageUsedBytes?: number;
  databaseStorageBytes?: number;
  chatStorageBytes?: number;
  skillStorageBytes?: number;
  storageOverageNotifiedAt?: Date | null;
  createdAt?: Date | null;
  // Note: No updatedAt field - not present in organizations table schema
}

export interface CreateOrganizationData {
  name: OrganizationName;
  slug?: string; // Optional - will be generated from name if not provided
  mission?: string;
  sharedTools?: string[];
  sharedServers?: string[];
  databaseId?: string;
  viewConfig?: Record<string, any>;
  plan?: 'free' | 'pro' | 'max' | 'enterprise' | null;
}

export interface UpdateOrganizationData extends Partial<CreateOrganizationData> {
  // Billing and model configuration fields
  defaultModel?: string | null;
  tokenQuotaMonthly?: number | null;
  availableModels?: string[];
  // Credit system fields
  creditBalance?: number;
  creditsUsedCurrentMonth?: number;
  creditsResetAt?: Date | null;
  // Stripe fields
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  billingEmail?: string | null;
  // Storage tracking fields
  storageQuotaBytes?: number;
  storageUsedBytes?: number;
  databaseStorageBytes?: number;
  chatStorageBytes?: number;
  skillStorageBytes?: number;
  storageOverageNotifiedAt?: Date | null;
}

export interface OrganizationWithMembers extends Organization {
  memberCount: number;
  members?: OrganizationMember[];
}

// im not sure if this makes sense, should just be Agent?
export interface OrganizationMember {
  userId: UserId;
  name?: string | null;
  email?: EmailAddress | null;
  roles: Array<{id: number; name: string; isSystem: boolean}>; // Multiple roles as single source of truth
  joinedAt?: Date | null;
}

// Analysis capabilities for organizations
export interface OrganizationAnalysisCapabilities {
  measurementFramework: MeasurementFramework;
  processDefinitions: ProcessDefinition[];
  analysisSchedule: AnalysisScheduleConfig;
  improvementTracking: ImprovementArea[];
  isSetup: boolean;
  setupDate?: string;
}

export interface MeasurementFramework {
  measurements: MeasurementDefinition[];
  kpiDefinitions: KPIDefinition[];
  reportingSchedule: ReportingConfig;
  defaultValidationRules: string[];
}

export interface MeasurementDefinition {
  id: string;
  name: string;
  description: string;
  category: MeasurementCategory;
  measurementType: 'raw_data' | 'calculated_kpi' | 'aggregated_metric';
  tableId?: number; // Reference to measurement storage table
  dataSource: {
    type: 'dynamic-table' | 'external-api' | 'calculation' | 'agent-collection';
    location: string; // source table, API endpoint, calculation formula
    queryInstructions: string;
  };
  frequency: CalculationFrequency;
  assignedAgents: AgentId[]; // Collector agents with type safety
  calculationAgents?: AgentId[]; // KPI calculation agents with type safety
  targetValue?: number;
  validationRules: string[];
  alertThresholds?: {
    warning: number;
    critical: number;
  };
}

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  formula: string; // Natural language or formula
  dependentMeasurements: string[]; // measurement IDs needed
  calculationAgent: AgentId; // Agent responsible for calculation with type safety
  calculationFrequency: CalculationFrequency;
  targetValue?: number;
  thresholds: {
    excellent: number;
    good: number;
    warning: number;
    critical: number;
  };
}

export interface ProcessDefinition {
  id: string;
  name: string;
  description: string;
  processSteps: ProcessStep[];
  monitoringPoints: MonitoringPoint[];
  assignedTeams: TeamId[];
  monitoringAgents: AgentId[];
  improvementTriggers: string[];
  relatedMeasurements: string[]; // measurement IDs this process affects
}

export interface ProcessStep {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number; // in minutes
  requiredInputs: string[];
  expectedOutputs: string[];
  qualityChecks: string[];
}

export interface MonitoringPoint {
  id: string;
  stepId: string; // Which process step to monitor
  metricName: string;
  collectionInstruction: string; // How agent should monitor this point
  alertThreshold: number; // When to alert about issues
  frequency: 'real-time' | 'hourly' | 'daily' | 'weekly';
}

export interface AnalysisScheduleConfig {
  timezone: string;
  dailyCollectionTime: string; // "09:00"
  weeklyReportDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  monthlyReportDay: number; // 1-28
  quarterlyReportMonth: number; // 1-3 (months into quarter)
  reporting: ReportingConfig;
}

export interface ReportingConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[]; // email addresses or user roles
  format: 'dashboard' | 'email' | 'pdf' | 'api';
  includeRecommendations: boolean;
}

export interface ImprovementArea {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  identifiedDate: string;
  status: 'identified' | 'planning' | 'in-progress' | 'completed';
  assignedTeams: TeamId[];
  estimatedImpact: 'high' | 'medium' | 'low';
  resourcesRequired: string[];
  targetCompletion: string;
}