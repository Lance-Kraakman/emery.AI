/**
 * Token Usage Repository Interface
 *
 * Domain repository interface for token usage tracking and billing.
 */
import type { TokenUsage, CreateTokenUsageData, EntityType } from '../entities/token-usage';
import type { TokenUsageId } from '../value-objects/token-usage-id';
import type { OrganizationId, UserId, AgentId } from '@/ddd/domain/shared/value-objects';

export interface UsageQueryFilters {
  organizationId?: OrganizationId;
  userId?: UserId;
  agentId?: AgentId;
  entityType?: EntityType;
  entityId?: string;
  modelName?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UsageStatistics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  executionCount: number;
  averageTokensPerExecution: number;
  averageCostPerExecution: number;
  modelBreakdown: Array<{
    modelName: string;
    totalTokens: number;
    totalCost: number;
    executionCount: number;
  }>;
}

export interface ITokenUsageRepository {
  /**
   * Create a new token usage record
   */
  create(data: CreateTokenUsageData): Promise<TokenUsage>;

  /**
   * Find token usage by ID
   */
  findById(id: TokenUsageId): Promise<TokenUsage | null>;

  /**
   * Find token usage records with filters
   */
  find(filters: UsageQueryFilters): Promise<TokenUsage[]>;

  /**
   * Get usage statistics for an organization
   */
  getOrganizationStatistics(
    organizationId: OrganizationId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatistics>;

  /**
   * Get current month usage for an organization
   */
  getCurrentMonthUsage(organizationId: OrganizationId): Promise<number>;

  /**
   * Update organization's current month usage counter
   * @param totalTokens - Raw token count for analytics
   * @param creditsUsed - Calculated credits for billing (NOT the same as tokens!)
   */
  updateOrganizationUsage(
    organizationId: OrganizationId,
    totalTokens: number,
    creditsUsed: number
  ): Promise<void>;

  /**
   * Get total cost for an organization in a date range
   */
  getTotalCost(
    organizationId: OrganizationId,
    startDate?: Date,
    endDate?: Date
  ): Promise<number>;

  /**
   * Get usage by user
   */
  getUserStatistics(
    userId: UserId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatistics>;

  /**
   * Get usage by agent
   */
  getAgentStatistics(
    agentId: AgentId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatistics>;
}
