/**
 * Credit Usage Application Service
 *
 * Provides credit-focused billing operations and statistics.
 * Credits are user-facing billing units (1 credit = $0.001 with 2.5x markup).
 *
 * AIDEV-NOTE: This service focuses on credit-based operations while TokenUsageApplicationService
 * handles the underlying token tracking. Both use the same repository.
 */
import type { ITokenUsageRepository } from '@/ddd/domain/billing/repositories/token-usage-repository';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('CreditUsageService');

// Credit-focused DTOs
export interface CreditUsageStats {
  creditBalance: number;              // Current available credits
  creditsUsedCurrentMonth: number;    // Credits consumed this month
  creditsUsedPeriod: number;          // Credits used in specified period
  totalExecutions: number;            // Number of executions
}

export interface CreditBreakdownItem {
  name: string;                       // Model/Agent/User name
  creditsUsed: number;                // Credits consumed
  executionCount: number;             // Number of executions
  percentageOfTotal: number;          // Percentage of period usage
}

export interface ModelCreditBreakdown extends CreditBreakdownItem {
  modelName: string;
  avgCreditsPerExecution: number;
}

export interface AgentCreditBreakdown extends CreditBreakdownItem {
  agentId: number;
  agentName: string;
}

export interface UserCreditBreakdown extends CreditBreakdownItem {
  userId: string;
  userName?: string;
}

export interface EntityTypeCreditBreakdown extends CreditBreakdownItem {
  entityType: 'chat' | 'skill' | 'task' | 'instruction';
}

export class CreditUsageApplicationService {
  constructor(
    private readonly tokenUsageRepository: ITokenUsageRepository
  ) {}

  /**
   * Get current credit usage stats for an organization
   */
  async getCreditUsageStats(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<CreditUsageStats> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      // Get statistics from repository (includes creditsUsed in DB)
      const stats = await this.tokenUsageRepository.getOrganizationStatistics(
        orgId,
        startDate,
        endDate
      );

      // TODO: Get creditBalance and creditsUsedCurrentMonth from organizations table
      // For now, calculate from token usage logs
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const currentMonthStats = await this.tokenUsageRepository.getOrganizationStatistics(
        orgId,
        currentMonthStart,
        new Date()
      );

      return {
        creditBalance: 0, // TODO: Get from organizations table
        creditsUsedCurrentMonth: 0, // TODO: Calculate from credits_used column
        creditsUsedPeriod: 0, // TODO: Sum credits_used for period
        totalExecutions: stats.executionCount,
      };
    } catch (error) {
      logger.error('Failed to get credit usage stats', { error, organizationId });
      throw error;
    }
  }

  /**
   * Get credit breakdown by model
   */
  async getModelBreakdown(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<ModelCreditBreakdown[]> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      const stats = await this.tokenUsageRepository.getOrganizationStatistics(
        orgId,
        startDate,
        endDate
      );

      // TODO: Update repository to return creditsUsed in model breakdown
      // For now, map from existing model breakdown
      const totalCredits = stats.modelBreakdown.reduce((sum, m) => sum + m.totalCost * 1000, 0); // Rough conversion

      return stats.modelBreakdown.map(model => ({
        name: model.modelName,
        modelName: model.modelName,
        creditsUsed: model.totalCost * 1000, // TODO: Use actual credits_used from DB
        executionCount: model.executionCount,
        percentageOfTotal: totalCredits > 0 ? (model.totalCost * 1000 / totalCredits) * 100 : 0,
        avgCreditsPerExecution: model.executionCount > 0 ? (model.totalCost * 1000) / model.executionCount : 0,
      }));
    } catch (error) {
      logger.error('Failed to get model breakdown', { error, organizationId });
      throw error;
    }
  }

  /**
   * Get credit breakdown by agent
   */
  async getAgentBreakdown(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<AgentCreditBreakdown[]> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      // TODO: Add getAgentCreditBreakdown method to repository
      // For now, return empty array
      logger.debug('Agent credit breakdown not yet implemented');
      return [];
    } catch (error) {
      logger.error('Failed to get agent breakdown', { error, organizationId });
      throw error;
    }
  }

  /**
   * Get credit breakdown by user
   */
  async getUserBreakdown(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<UserCreditBreakdown[]> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      // TODO: Add getUserCreditBreakdown method to repository
      // For now, return empty array
      logger.debug('User credit breakdown not yet implemented');
      return [];
    } catch (error) {
      logger.error('Failed to get user breakdown', { error, organizationId });
      throw error;
    }
  }

  /**
   * Get credit breakdown by entity type (chat, task, skill, instruction)
   */
  async getEntityTypeBreakdown(
    organizationId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<EntityTypeCreditBreakdown[]> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);

      // TODO: Add getEntityTypeCreditBreakdown method to repository
      // For now, return empty array
      logger.debug('Entity type credit breakdown not yet implemented');
      return [];
    } catch (error) {
      logger.error('Failed to get entity type breakdown', { error, organizationId });
      throw error;
    }
  }

  /**
   * Export credit usage data as CSV
   */
  async exportUsageData(
    organizationId: number,
    dimension: 'model' | 'agent' | 'user' | 'type',
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    try {
      switch (dimension) {
        case 'model': {
          const data = await this.getModelBreakdown(organizationId, startDate, endDate);
          const headers = ['Model', 'Credits Used', 'Executions', '% of Total', 'Avg Credits/Execution'];
          const csvHeaders = headers.join(',');
          const csvRows = data.map(item =>
            [
              item.name,
              item.creditsUsed.toFixed(2),
              item.executionCount.toString(),
              item.percentageOfTotal.toFixed(1) + '%',
              item.avgCreditsPerExecution.toFixed(2)
            ].join(',')
          );
          return [csvHeaders, ...csvRows].join('\n');
        }

        case 'agent': {
          const data = await this.getAgentBreakdown(organizationId, startDate, endDate);
          const headers = ['Agent', 'Credits Used', 'Executions', '% of Total'];
          const csvHeaders = headers.join(',');
          const csvRows = data.map(item =>
            [
              item.name,
              item.creditsUsed.toFixed(2),
              item.executionCount.toString(),
              item.percentageOfTotal.toFixed(1) + '%'
            ].join(',')
          );
          return [csvHeaders, ...csvRows].join('\n');
        }

        case 'user': {
          const data = await this.getUserBreakdown(organizationId, startDate, endDate);
          const headers = ['User', 'Credits Used', 'Executions', '% of Total'];
          const csvHeaders = headers.join(',');
          const csvRows = data.map(item =>
            [
              item.name,
              item.creditsUsed.toFixed(2),
              item.executionCount.toString(),
              item.percentageOfTotal.toFixed(1) + '%'
            ].join(',')
          );
          return [csvHeaders, ...csvRows].join('\n');
        }

        case 'type': {
          const data = await this.getEntityTypeBreakdown(organizationId, startDate, endDate);
          const headers = ['Type', 'Credits Used', 'Executions', '% of Total'];
          const csvHeaders = headers.join(',');
          const csvRows = data.map(item =>
            [
              item.name,
              item.creditsUsed.toFixed(2),
              item.executionCount.toString(),
              item.percentageOfTotal.toFixed(1) + '%'
            ].join(',')
          );
          return [csvHeaders, ...csvRows].join('\n');
        }
      }
    } catch (error) {
      logger.error('Failed to export usage data', { error, organizationId, dimension });
      throw error;
    }
  }

  /**
   * Get credit package purchase history
   */
  async getPurchaseHistory(organizationId: number): Promise<any[]> {
    // TODO: Implement credit purchase history from credit_purchases table
    logger.debug('Purchase history not yet implemented');
    return [];
  }
}
