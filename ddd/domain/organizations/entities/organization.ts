export interface Organization {
  id: number;
  name: string;
  mission?: string | null;
  sharedTools?: string[] | null;
  sharedServers?: string[] | null;
  databaseId?: string | null;
  viewConfig?: Record<string, any> | null;
  plan?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  analysisCapabilities?: OrganizationAnalysisCapabilities | null;
  createdAt?: Date | null;
  // Note: No updatedAt field - not present in organizations table schema
}

export interface CreateOrganizationData {
  name: string;
  mission?: string;
  sharedTools?: string[];
  sharedServers?: string[];
  databaseId?: string;
  viewConfig?: Record<string, any>;
  plan?: string;
}

export interface UpdateOrganizationData extends Partial<CreateOrganizationData> {}

export interface OrganizationWithMembers extends Organization {
  memberCount: number;
  members?: OrganizationMember[];
}

export interface OrganizationMember {
  userId: string;
  name?: string | null;
  email?: string | null;
  role: string; // owner, admin, member
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
  category: 'efficiency' | 'quality' | 'satisfaction' | 'financial' | 'performance';
  measurementType: 'raw_data' | 'calculated_kpi' | 'aggregated_metric';
  tableId?: number; // Reference to measurement storage table
  dataSource: {
    type: 'dynamic-table' | 'external-api' | 'calculation' | 'agent-collection';
    location: string; // source table, API endpoint, calculation formula
    queryInstructions: string;
  };
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  assignedAgents: number[]; // Collector agents
  calculationAgents?: number[]; // KPI calculation agents
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
  calculationAgent: number; // Agent responsible for calculation
  calculationFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
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
  assignedTeams: number[];
  monitoringAgents: number[];
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
  assignedTeams: number[];
  estimatedImpact: 'high' | 'medium' | 'low';
  resourcesRequired: string[];
  targetCompletion: string;
}

// Extended organization interface with analysis capabilities
export interface OrganizationWithAnalysis extends Organization {
  analysisCapabilities: OrganizationAnalysisCapabilities;
}