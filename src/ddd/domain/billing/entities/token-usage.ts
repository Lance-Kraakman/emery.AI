/**
 * Token Usage Entity
 *
 * Domain entity representing token consumption for AI model usage.
 * Used for billing, quota tracking, and usage analytics.
 */
import { TokenUsageId } from '../value-objects/token-usage-id';
import { OrganizationId, UserId, AgentId } from '@/ddd/domain/shared/value-objects';

export type EntityType = 'chat' | 'skill' | 'task' | 'instruction';

export interface TokenUsageMetadata {
  taskName?: string;
  skillName?: string;
  chatContext?: string;
  success?: boolean;
  error?: string;
}

export interface CreateTokenUsageData {
  organizationId: OrganizationId;
  userId?: UserId;
  entityType: EntityType;
  entityId?: string;
  agentId?: AgentId;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  processingTimeMs?: number;
  metadata?: TokenUsageMetadata;
}

export interface TokenUsage {
  id: TokenUsageId;
  organizationId: OrganizationId;
  userId?: UserId;
  entityType: EntityType;
  entityId?: string;
  agentId?: AgentId;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  processingTimeMs?: number;
  metadata?: TokenUsageMetadata;
  createdAt: Date;
}

/**
 * Token Usage Domain Utilities
 */
export class TokenUsageUtils {
  /**
   * Validate token usage data
   */
  static validateTokenUsageData(data: CreateTokenUsageData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.modelName || data.modelName.trim() === '') {
      errors.push('Model name is required');
    }

    if (data.inputTokens < 0) {
      errors.push('Input tokens must be non-negative');
    }

    if (data.outputTokens < 0) {
      errors.push('Output tokens must be non-negative');
    }

    if (data.totalTokens !== data.inputTokens + data.outputTokens) {
      errors.push('Total tokens must equal input + output tokens');
    }

    if (data.costUsd < 0) {
      errors.push('Cost must be non-negative');
    }

    if (data.processingTimeMs !== undefined && data.processingTimeMs < 0) {
      errors.push('Processing time must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate cost from token counts and model pricing
   */
  static calculateCost(
    inputTokens: number,
    outputTokens: number,
    inputPricePer1M: number,
    outputPricePer1M: number
  ): number {
    const inputCost = (inputTokens / 1_000_000) * inputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * outputPricePer1M;
    return inputCost + outputCost;
  }
}
