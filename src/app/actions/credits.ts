"use server";

/**
 * Credit Usage Server Actions
 *
 * Provides server actions for credit-based billing operations.
 * Requires organizations:manage permission for all operations.
 */

import { getCreditUsageApplicationService } from "@/ddd/application/di/getters";
import { requireResourcePermission } from "./permissions";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result } from "./types";

/**
 * Get credit usage statistics for an organization
 */
export async function getCreditUsageStats(
  organizationId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Result<{
  creditBalance: number;
  creditsUsedCurrentMonth: number;
  creditsUsedPeriod: number;
  totalExecutions: number;
}>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const stats = await service.getCreditUsageStats(organizationId, startDate, endDate);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error("Failed to get credit usage stats:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get usage stats"
      };
    }
  });
}

/**
 * Get credit breakdown by model
 */
export async function getCreditBreakdownByModel(
  organizationId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Result<Array<{
  name: string;
  modelName: string;
  creditsUsed: number;
  executionCount: number;
  percentageOfTotal: number;
  avgCreditsPerExecution: number;
}>>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const breakdown = await service.getModelBreakdown(organizationId, startDate, endDate);

      return {
        success: true,
        data: breakdown
      };
    } catch (error) {
      console.error("Failed to get model breakdown:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get breakdown"
      };
    }
  });
}

/**
 * Get credit breakdown by agent
 */
export async function getCreditBreakdownByAgent(
  organizationId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Result<Array<{
  name: string;
  agentId: number;
  agentName: string;
  creditsUsed: number;
  executionCount: number;
  percentageOfTotal: number;
}>>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const breakdown = await service.getAgentBreakdown(organizationId, startDate, endDate);

      return {
        success: true,
        data: breakdown
      };
    } catch (error) {
      console.error("Failed to get agent breakdown:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get breakdown"
      };
    }
  });
}

/**
 * Get credit breakdown by user
 */
export async function getCreditBreakdownByUser(
  organizationId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Result<Array<{
  name: string;
  userId: string;
  userName?: string;
  creditsUsed: number;
  executionCount: number;
  percentageOfTotal: number;
}>>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const breakdown = await service.getUserBreakdown(organizationId, startDate, endDate);

      return {
        success: true,
        data: breakdown
      };
    } catch (error) {
      console.error("Failed to get user breakdown:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get breakdown"
      };
    }
  });
}

/**
 * Get credit breakdown by entity type (chat, task, skill, instruction)
 */
export async function getCreditBreakdownByType(
  organizationId: number,
  startDate?: Date,
  endDate?: Date
): Promise<Result<Array<{
  name: string;
  entityType: 'chat' | 'skill' | 'task' | 'instruction';
  creditsUsed: number;
  executionCount: number;
  percentageOfTotal: number;
}>>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const breakdown = await service.getEntityTypeBreakdown(organizationId, startDate, endDate);

      return {
        success: true,
        data: breakdown
      };
    } catch (error) {
      console.error("Failed to get entity type breakdown:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get breakdown"
      };
    }
  });
}

/**
 * Export credit usage data as CSV
 */
export async function exportCreditUsageCSV(
  organizationId: number,
  dimension: 'model' | 'agent' | 'user' | 'type',
  startDate?: Date,
  endDate?: Date
): Promise<Result<string>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const csv = await service.exportUsageData(organizationId, dimension, startDate, endDate);

      return {
        success: true,
        data: csv
      };
    } catch (error) {
      console.error("Failed to export usage data:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export data"
      };
    }
  });
}

/**
 * Get credit purchase history for an organization
 */
export async function getCreditPurchaseHistory(
  organizationId: number
): Promise<Result<any[]>> {
  return withAuthContext(async () => {
    try {
      await requireResourcePermission(
        "organizations:manage",
        "organization",
        organizationId
      );

      const service = getCreditUsageApplicationService();
      const history = await service.getPurchaseHistory(organizationId);

      return {
        success: true,
        data: history
      };
    } catch (error) {
      console.error("Failed to get purchase history:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get purchase history"
      };
    }
  });
}
