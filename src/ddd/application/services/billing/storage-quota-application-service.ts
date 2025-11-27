/**
 * Storage Quota Application Service
 *
 * Orchestrates storage quota checking and tracking.
 * Implements hybrid approach: increment on upload, daily recalculation for accuracy.
 */
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import { getTierConfig } from '@/lib/stripe/config';

const logger = createDebugLogger('StorageQuotaService');

/**
 * Storage category types for tracking different types of storage
 */
export type StorageCategory = 'database' | 'chat' | 'skill';

/**
 * Result of checking storage quota before upload
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsageBytes: number;
  quotaBytes: number;
  percentageUsed: number;
  quotaExceeded: boolean;
  availableBytes: number;
}

/**
 * Parameters for checking storage quota
 */
export interface CheckQuotaDTO {
  organizationId: number;
  uploadSizeBytes: number;
  category?: StorageCategory; // Optional: for category-specific tracking
}

/**
 * Parameters for incrementing storage usage
 */
export interface IncrementUsageDTO {
  organizationId: number;
  uploadSizeBytes: number;
  category: StorageCategory;
}

/**
 * Storage usage breakdown by category
 */
export interface StorageUsageBreakdown {
  totalUsageBytes: number;
  quotaBytes: number;
  databaseStorageBytes: number;
  chatStorageBytes: number;
  skillStorageBytes: number;
  percentageUsed: number;
  availableBytes: number;
}

export class StorageQuotaApplicationService {
  constructor(
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  /**
   * Check if upload is allowed based on storage quota
   * Fast check using cached storage counter
   */
  async checkQuota(dto: CheckQuotaDTO): Promise<Result<QuotaCheckResult>> {
    try {
      logger.debug('Checking storage quota', {
        organizationId: dto.organizationId,
        uploadSizeBytes: dto.uploadSizeBytes,
        category: dto.category
      });

      // Fetch organization to get current usage and tier
      const organizationId = OrganizationId.fromNumber(dto.organizationId);
      const organization = await this.organizationRepository.findById(organizationId);

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      // Get tier configuration
      const tierConfig = getTierConfig(organization.tier || 'free');
      const quotaBytes = tierConfig.storageQuotaGB * 1024 * 1024 * 1024; // Convert GB to bytes

      // Get current usage from organization
      const currentUsageBytes = organization.storageUsedBytes || 0;
      const projectedUsageBytes = currentUsageBytes + dto.uploadSizeBytes;

      // Calculate metrics
      const percentageUsed = (currentUsageBytes / quotaBytes) * 100;
      const quotaExceeded = projectedUsageBytes > quotaBytes;
      const availableBytes = Math.max(0, quotaBytes - currentUsageBytes);

      // Determine if upload is allowed
      const allowed = !quotaExceeded;
      const reason = quotaExceeded
        ? `Storage quota exceeded. Your ${tierConfig.displayName} tier allows ${tierConfig.storageQuotaGB}GB. Upgrade for more storage.`
        : undefined;

      logger.summary('Quota check complete', {
        organizationId: dto.organizationId,
        allowed,
        currentUsageBytes,
        quotaBytes,
        percentageUsed: percentageUsed.toFixed(2),
        quotaExceeded
      });

      return {
        success: true,
        data: {
          allowed,
          reason,
          currentUsageBytes,
          quotaBytes,
          percentageUsed,
          quotaExceeded,
          availableBytes
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking storage quota', error);
      return {
        success: false,
        error: `Failed to check storage quota: ${errorMessage}`
      };
    }
  }

  /**
   * Increment storage usage after successful upload
   * Updates both total and category-specific counters
   */
  async incrementUsage(dto: IncrementUsageDTO): Promise<Result<void>> {
    try {
      logger.debug('Incrementing storage usage', {
        organizationId: dto.organizationId,
        uploadSizeBytes: dto.uploadSizeBytes,
        category: dto.category
      });

      const organizationId = OrganizationId.fromNumber(dto.organizationId);
      const organization = await this.organizationRepository.findById(organizationId);

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      // Calculate new usage values
      const currentTotal = organization.storageUsedBytes || 0;
      const newTotal = currentTotal + dto.uploadSizeBytes;

      // Calculate category-specific usage
      const categoryField = `${dto.category}StorageBytes` as const;
      const currentCategoryUsage = organization[categoryField] || 0;
      const newCategoryUsage = currentCategoryUsage + dto.uploadSizeBytes;

      // Update organization storage counters
      const updateData: Record<string, number> = {
        storageUsedBytes: newTotal,
        [categoryField]: newCategoryUsage
      };

      await this.organizationRepository.update(organizationId, updateData);

      logger.summary('Storage usage incremented', {
        organizationId: dto.organizationId,
        category: dto.category,
        uploadSizeBytes: dto.uploadSizeBytes,
        oldTotal: currentTotal,
        newTotal,
        oldCategoryUsage: currentCategoryUsage,
        newCategoryUsage
      });

      return {
        success: true,
        data: undefined
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error incrementing storage usage', error);
      return {
        success: false,
        error: `Failed to increment storage usage: ${errorMessage}`
      };
    }
  }

  /**
   * Get storage usage breakdown for an organization
   * Useful for displaying usage in UI
   */
  async getUsageBreakdown(organizationId: number): Promise<Result<StorageUsageBreakdown>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const organization = await this.organizationRepository.findById(orgId);

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      // Get tier configuration
      const tierConfig = getTierConfig(organization.tier || 'free');
      const quotaBytes = tierConfig.storageQuotaGB * 1024 * 1024 * 1024;

      const totalUsageBytes = organization.storageUsedBytes || 0;
      const percentageUsed = (totalUsageBytes / quotaBytes) * 100;
      const availableBytes = Math.max(0, quotaBytes - totalUsageBytes);

      return {
        success: true,
        data: {
          totalUsageBytes,
          quotaBytes,
          databaseStorageBytes: organization.databaseStorageBytes || 0,
          chatStorageBytes: organization.chatStorageBytes || 0,
          skillStorageBytes: organization.skillStorageBytes || 0,
          percentageUsed,
          availableBytes
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting storage breakdown', error);
      return {
        success: false,
        error: `Failed to get storage breakdown: ${errorMessage}`
      };
    }
  }

  /**
   * Check if organization is approaching storage limit (>80%)
   * Useful for showing warnings to users
   */
  async isApproachingLimit(organizationId: number): Promise<Result<{
    approaching: boolean;
    percentageUsed: number;
    thresholdPercentage: number;
  }>> {
    try {
      const breakdownResult = await this.getUsageBreakdown(organizationId);

      if (!breakdownResult.success) {
        return {
          success: false,
          error: breakdownResult.error
        };
      }

      const thresholdPercentage = 80;
      const approaching = breakdownResult.data!.percentageUsed >= thresholdPercentage;

      return {
        success: true,
        data: {
          approaching,
          percentageUsed: breakdownResult.data!.percentageUsed,
          thresholdPercentage
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking storage limit', error);
      return {
        success: false,
        error: `Failed to check storage limit: ${errorMessage}`
      };
    }
  }
}
