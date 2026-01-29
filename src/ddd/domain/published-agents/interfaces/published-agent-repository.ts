/**
 * Published Agent Repository Interfaces
 */

import type {
  PublishedAgent,
  PublishedAgentApiKey,
  PublishedAgentOAuthClient,
  PublishedAgentUsageLog,
  PublishedAgentFilters,
  ApiKeyFilters,
  UsageLogFilters,
  PublicationStatus,
  PublishedAgentIntegrations,
  ApiKeyScope,
} from '../types';

// ============================================================================
// CREATE DATA TYPES
// ============================================================================

export interface CreatePublishedAgentData {
  agentId: number;
  organizationId: number;
  slug: string;
  displayName: string;
  description?: string;
  minSecurityGrade?: 'A' | 'B' | 'C';
  allowTaskMode?: boolean;
  allowSkillMode?: boolean;
}

export interface UpdatePublishedAgentData {
  slug?: string;
  displayName?: string;
  description?: string;
  minSecurityGrade?: 'A' | 'B' | 'C';
  allowTaskMode?: boolean;
  allowSkillMode?: boolean;
  billingMode?: 'owner_pays' | 'caller_pays';
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  integrations?: PublishedAgentIntegrations;
}

export interface CreateApiKeyData {
  publishedAgentId: number;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes?: ApiKeyScope[];
  expiresAt?: Date;
}

export interface CreateOAuthClientData {
  publishedAgentId: number;
  clientId: string;
  clientSecretHash: string;
  name: string;
  redirectUris?: string[];
  allowedScopes?: string[];
}

export interface CreateUsageLogData {
  publishedAgentId: number;
  apiKeyId?: number;
  requestType: 'task' | 'skill';
  skillName?: string;
  statusCode: number;
  responseTimeMs: number;
  clientIp?: string;
  userAgent?: string;
}

// ============================================================================
// PUBLISHED AGENT REPOSITORY
// ============================================================================

export interface IPublishedAgentRepository {
  /**
   * Create a new published agent
   */
  create(data: CreatePublishedAgentData): Promise<PublishedAgent>;

  /**
   * Find a published agent by ID
   */
  findById(id: number): Promise<PublishedAgent | null>;

  /**
   * Find a published agent by slug (within an organization)
   */
  findBySlug(organizationId: number, slug: string): Promise<PublishedAgent | null>;

  /**
   * Find a published agent by agent ID
   */
  findByAgentId(agentId: number): Promise<PublishedAgent | null>;

  /**
   * Find all published agents for an organization
   */
  findByOrganization(
    organizationId: number,
    filters?: PublishedAgentFilters
  ): Promise<PublishedAgent[]>;

  /**
   * Update a published agent
   */
  update(id: number, data: UpdatePublishedAgentData): Promise<PublishedAgent>;

  /**
   * Update publication status
   */
  updateStatus(
    id: number,
    status: PublicationStatus,
    metadata?: {
      publishedAt?: Date;
      publishedBy?: string;
      securityApprovedAt?: Date;
      securityApprovedBy?: string;
      latestSecurityReportId?: number;
    }
  ): Promise<PublishedAgent>;

  /**
   * Delete a published agent
   */
  delete(id: number): Promise<void>;
}

// ============================================================================
// API KEY REPOSITORY
// ============================================================================

export interface IPublishedAgentApiKeyRepository {
  /**
   * Create a new API key
   */
  create(data: CreateApiKeyData): Promise<PublishedAgentApiKey>;

  /**
   * Find an API key by ID
   */
  findById(id: number): Promise<PublishedAgentApiKey | null>;

  /**
   * Find an API key by hash (for authentication)
   */
  findByKeyHash(keyHash: string): Promise<PublishedAgentApiKey | null>;

  /**
   * Find all API keys for a published agent
   */
  findByPublishedAgentId(
    publishedAgentId: number,
    filters?: ApiKeyFilters
  ): Promise<PublishedAgentApiKey[]>;

  /**
   * Update last used timestamp and increment usage count
   */
  recordUsage(id: number): Promise<void>;

  /**
   * Revoke an API key
   */
  revoke(id: number): Promise<PublishedAgentApiKey>;

  /**
   * Delete an API key
   */
  delete(id: number): Promise<void>;
}

// ============================================================================
// OAUTH CLIENT REPOSITORY
// ============================================================================

export interface IPublishedAgentOAuthClientRepository {
  /**
   * Create a new OAuth client
   */
  create(data: CreateOAuthClientData): Promise<PublishedAgentOAuthClient>;

  /**
   * Find an OAuth client by ID
   */
  findById(id: number): Promise<PublishedAgentOAuthClient | null>;

  /**
   * Find an OAuth client by client ID (for authentication)
   */
  findByClientId(clientId: string): Promise<PublishedAgentOAuthClient | null>;

  /**
   * Find all OAuth clients for a published agent
   */
  findByPublishedAgentId(publishedAgentId: number): Promise<PublishedAgentOAuthClient[]>;

  /**
   * Update last used timestamp
   */
  recordUsage(id: number): Promise<void>;

  /**
   * Deactivate an OAuth client
   */
  deactivate(id: number): Promise<PublishedAgentOAuthClient>;

  /**
   * Delete an OAuth client
   */
  delete(id: number): Promise<void>;
}

// ============================================================================
// USAGE LOG REPOSITORY
// ============================================================================

export interface IPublishedAgentUsageLogRepository {
  /**
   * Create a usage log entry
   */
  create(data: CreateUsageLogData): Promise<PublishedAgentUsageLog>;

  /**
   * Find usage logs for a published agent
   */
  findByPublishedAgentId(
    publishedAgentId: number,
    filters?: UsageLogFilters
  ): Promise<PublishedAgentUsageLog[]>;

  /**
   * Get usage statistics for a published agent
   */
  getUsageStats(
    publishedAgentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRequests: number;
    taskRequests: number;
    skillRequests: number;
    avgResponseTimeMs: number;
    errorCount: number;
  }>;

  /**
   * Delete old usage logs (for cleanup)
   */
  deleteOlderThan(date: Date): Promise<number>;
}
