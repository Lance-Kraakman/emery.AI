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
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
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
    private readonly tokenUsageRepository: ITokenUsageRepository,
    private readonly organizationRepository: IOrganizationRepository
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
   * Enforces credit limits by comparing creditsUsedCurrentMonth against creditBalance
   */
  async checkQuota(organizationId: number): Promise<QuotaCheckResult> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      // Get organization to check credit balance
      const organization = await this.organizationRepository.findById(orgId);

      if (!organization) {
        logger.error('Organization not found for quota check', { organizationId });
        // Fail safe - deny access if organization doesn't exist
        return {
          allowed: false,
          currentUsage: 0,
          quotaExceeded: true,
        };
      }

      const creditBalance = organization.creditBalance ?? 0;
      const creditsUsed = organization.creditsUsedCurrentMonth ?? 0;

      // Organizations with 0 or null credit balance are treated as unlimited (enterprise tier)
      if (creditBalance === 0) {
        logger.debug('Organization has unlimited credits (enterprise tier)', { organizationId });
        return {
          allowed: true,
          currentUsage: creditsUsed,
          monthlyQuota: undefined, // Unlimited
          percentageUsed: 0,
          quotaExceeded: false,
        };
      }

      // Calculate usage percentage
      const percentageUsed = (creditsUsed / creditBalance) * 100;
      const quotaExceeded = creditsUsed >= creditBalance;

      logger.debug('Quota check result', {
        organizationId,
        creditBalance,
        creditsUsed,
        percentageUsed: percentageUsed.toFixed(2),
        quotaExceeded
      });

      return {
        allowed: !quotaExceeded,
        currentUsage: creditsUsed,
        monthlyQuota: creditBalance,
        percentageUsed,
        quotaExceeded,
      };
    } catch (error) {
      logger.error('Failed to check quota', { error, organizationId });
      // Fail safe - deny access on error
      return {
        allowed: false,
        currentUsage: 0,
        quotaExceeded: true,
      };
    }
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
