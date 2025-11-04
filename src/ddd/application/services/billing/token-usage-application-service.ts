/**
 * Token Usage Application Service
 *
 * Orchestrates token usage tracking, billing, and quota enforcement.
 * Handles recording AI model usage and calculating costs.
 */
import type { ITokenUsageRepository, UsageStatistics } from '@/ddd/domain/billing/repositories/token-usage-repository';
import type { CreateTokenUsageData, EntityType, TokenUsageMetadata } from '@/ddd/domain/billing/entities/token-usage';
import { TokenUsageUtils } from '@/ddd/domain/billing/entities/token-usage';
import { OrganizationId, UserId, AgentId } from '@/ddd/domain/shared/value-objects';
import { calculateTokenCost } from '@/lib/ai/model-registry';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('TokenUsageService');

export interface RecordTokenUsageDTO {
  organizationId: number;
  userId?: string;
  entityType: EntityType;
  entityId?: string;
  agentId?: number;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  processingTimeMs?: number;
  metadata?: TokenUsageMetadata;
}

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  monthlyQuota?: number;
  percentageUsed?: number;
  quotaExceeded: boolean;
}

export interface UsageStatisticsDTO {
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

export class TokenUsageApplicationService {
  constructor(
    private readonly tokenUsageRepository: ITokenUsageRepository
  ) {}

  /**
   * Record token usage and update organization usage counter
   */
  async recordTokenUsage(dto: RecordTokenUsageDTO): Promise<Result<void>> {
    try {
      // Convert DTO to Value Objects
      const organizationId = OrganizationId.fromNumber(dto.organizationId);
      const userId = dto.userId ? UserId.fromString(dto.userId) : undefined;
      const agentId = dto.agentId ? AgentId.fromNumber(dto.agentId) : undefined;

      // Calculate cost using model registry
      const costUsd = calculateTokenCost(dto.modelName, dto.inputTokens, dto.outputTokens);
      const totalTokens = dto.inputTokens + dto.outputTokens;

      // Create token usage data
      const tokenUsageData: CreateTokenUsageData = {
        organizationId,
        userId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        agentId,
        modelName: dto.modelName,
        inputTokens: dto.inputTokens,
        outputTokens: dto.outputTokens,
        totalTokens,
        costUsd,
        processingTimeMs: dto.processingTimeMs,
        metadata: dto.metadata,
      };

      // Validate token usage data
      const validation = TokenUsageUtils.validateTokenUsageData(tokenUsageData);
      if (!validation.valid) {
        logger.error('Invalid token usage data', { errors: validation.errors });
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Record token usage
      await this.tokenUsageRepository.create(tokenUsageData);

      // Update organization's current month usage counter
      await this.tokenUsageRepository.updateOrganizationUsage(organizationId, totalTokens);

      logger.summary('Token usage recorded', {
        organizationId: dto.organizationId,
        modelName: dto.modelName,
        totalTokens,
        costUsd: costUsd.toFixed(6)
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to record token usage', { error, dto });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if organization has exceeded quota
   */
  async checkQuota(organizationId: number): Promise<QuotaCheckResult> {
    const orgId = OrganizationId.fromNumber(organizationId);

    // Get current month usage
    const currentUsage = await this.tokenUsageRepository.getCurrentMonthUsage(orgId);

    // TODO: Get monthly quota from organization settings
    // For now, return unlimited (quota enforcement will be added separately)
    return {
      allowed: true,
      currentUsage,
      quotaExceeded: false,
    };
  }

  /**
   * Get usage statistics for an organization
   */
  async getOrganizationStatistics(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatisticsDTO> {
    const orgId = OrganizationId.fromNumber(organizationId);
    return this.tokenUsageRepository.getOrganizationStatistics(orgId, startDate, endDate);
  }

  /**
   * Get usage statistics for a user
   */
  async getUserStatistics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatisticsDTO> {
    const userIdVO = UserId.fromString(userId);
    return this.tokenUsageRepository.getUserStatistics(userIdVO, startDate, endDate);
  }

  /**
   * Get usage statistics for an agent
   */
  async getAgentStatistics(
    agentId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStatisticsDTO> {
    const agentIdVO = AgentId.fromNumber(agentId);
    return this.tokenUsageRepository.getAgentStatistics(agentIdVO, startDate, endDate);
  }

  /**
   * Get current month statistics for an organization
   */
  async getCurrentMonthStatistics(organizationId: number): Promise<UsageStatisticsDTO> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return this.getOrganizationStatistics(organizationId, startOfMonth, endOfMonth);
  }

  /**
   * Get total cost for an organization in a date range
   */
  async getTotalCost(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const orgId = OrganizationId.fromNumber(organizationId);
    return this.tokenUsageRepository.getTotalCost(orgId, startDate, endDate);
  }
}
