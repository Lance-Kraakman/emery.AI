/**
 * Published Agents Domain Types
 *
 * Types for agents exposed externally as callable services.
 * Enables external consumers (ChatGPT, Claude, B2B partners) to invoke agents via REST API.
 */

// ============================================================================
// ENUMS & LITERAL TYPES
// ============================================================================

export type PublicationStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'suspended';
export type SecurityGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type BillingMode = 'owner_pays' | 'caller_pays';
export type IntegrationType = 'chatgptPlugin' | 'mcpServer' | 'openaiAssistants';
export type ApiKeyScope = 'task:execute' | 'skill:execute';

// ============================================================================
// INTEGRATIONS CONFIG
// ============================================================================

export interface PublishedAgentIntegrations {
  chatgptPlugin?: { enabled: boolean; oauthClientId: number };
  mcpServer?: { enabled: boolean; apiKeyId: number };
  openaiAssistants?: { enabled: boolean };
}

// ============================================================================
// PUBLISHED AGENT
// ============================================================================

/**
 * Published Agent entity (maps to publishedAgents table)
 */
export interface PublishedAgent {
  readonly id: number;
  readonly agentId: number;
  readonly organizationId: number;

  // Publication identity
  readonly slug: string;
  readonly displayName: string;
  readonly description: string | null;

  // Status
  readonly status: PublicationStatus;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;

  // Security integration
  readonly latestSecurityReportId: number | null;
  readonly securityApprovedAt: Date | null;
  readonly securityApprovedBy: string | null;
  readonly minSecurityGrade: SecurityGrade;

  // Access modes
  readonly allowTaskMode: boolean;
  readonly allowSkillMode: boolean;

  // Billing
  readonly billingMode: BillingMode;

  // Rate limiting
  readonly rateLimitPerMinute: number;
  readonly rateLimitPerDay: number;

  // Integrations
  readonly integrations: PublishedAgentIntegrations;

  // Timestamps
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ============================================================================
// API KEY
// ============================================================================

/**
 * Published Agent API Key entity (maps to publishedAgentApiKeys table)
 */
export interface PublishedAgentApiKey {
  readonly id: number;
  readonly publishedAgentId: number;

  readonly name: string;
  readonly keyHash: string;
  readonly keyPrefix: string;

  readonly scopes: ApiKeyScope[];

  readonly lastUsedAt: Date | null;
  readonly usageCount: number;
  readonly expiresAt: Date | null;
  readonly isRevoked: boolean;

  readonly createdAt: Date;
}

// ============================================================================
// OAUTH CLIENT
// ============================================================================

/**
 * Published Agent OAuth Client entity (maps to publishedAgentOauthClients table)
 */
export interface PublishedAgentOAuthClient {
  readonly id: number;
  readonly publishedAgentId: number;

  readonly clientId: string;
  readonly clientSecretHash: string;

  readonly name: string;
  readonly redirectUris: string[];
  readonly allowedScopes: string[];

  readonly isActive: boolean;
  readonly lastUsedAt: Date | null;

  readonly createdAt: Date;
}

// ============================================================================
// USAGE LOG
// ============================================================================

/**
 * Published Agent Usage Log entity (maps to publishedAgentUsageLogs table)
 */
export interface PublishedAgentUsageLog {
  readonly id: number;
  readonly publishedAgentId: number;
  readonly apiKeyId: number | null;

  readonly requestType: 'task' | 'skill';
  readonly skillName: string | null;
  readonly statusCode: number;
  readonly responseTimeMs: number;

  readonly clientIp: string | null;
  readonly userAgent: string | null;

  readonly createdAt: Date;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface PublishedAgentFilters {
  status?: PublicationStatus;
  agentId?: number;
}

export interface ApiKeyFilters {
  isRevoked?: boolean;
  includeExpired?: boolean;
}

export interface UsageLogFilters {
  requestType?: 'task' | 'skill';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// ============================================================================
// DTOs
// ============================================================================

export interface PublishedAgentDTO {
  id: number;
  agentId: number;
  organizationId: number;
  slug: string;
  displayName: string;
  description: string | null;
  status: PublicationStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  latestSecurityReportId: number | null;
  securityApprovedAt: string | null;
  securityApprovedBy: string | null;
  minSecurityGrade: SecurityGrade;
  allowTaskMode: boolean;
  allowSkillMode: boolean;
  billingMode: BillingMode;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  integrations: PublishedAgentIntegrations;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedAgentApiKeyDTO {
  id: number;
  publishedAgentId: number;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  isRevoked: boolean;
  createdAt: string;
}

// ============================================================================
// AUTH RESULT
// ============================================================================

export interface PublishedAgentAuthResult {
  success: boolean;
  publishedAgentId?: number;
  keyId?: number;
  scopes?: ApiKeyScope[];
  error?: string;
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface TaskExecutionRequest {
  task: string;
  context?: Record<string, unknown>;
}

export interface SkillExecutionRequest {
  inputs: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}
