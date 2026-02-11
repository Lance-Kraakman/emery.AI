/**
 * Storage Recalculation Application Service
 *
 * Orchestrates periodic storage recalculation to prevent drift between
 * incremental counters and actual storage usage.
 *
 * Depends on:
 * - IFileStorageRepository: Scan actual S3 storage (database, chat, skill)
 * - IOrganizationRepository: Get/update organization storage counters
 * - WorkspaceStorageScanner: Scan EFS workspace storage
 */

import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { invalidateOrgStorageCache } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { withSystemContext } from '@/ddd/infrastructure/db/system-context';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import { WorkspaceStorageScanner } from '@/ddd/infrastructure/storage/workspace-storage-scanner';

const logger = createDebugLogger('StorageRecalculation');

export interface StorageDiscrepancy {
  organizationId: number;
  organizationName: string;
  tracked: {
    totalBytes: number;
    databaseBytes: number;
    chatBytes: number;
    skillBytes: number;
    workspaceBytes: number;
  };
  actual: {
    totalBytes: number;
    databaseBytes: number;
    chatBytes: number;
    skillBytes: number;
    workspaceBytes: number;
  };
  difference: {
    totalBytes: number;
    databaseBytes: number;
    chatBytes: number;
    skillBytes: number;
    workspaceBytes: number;
  };
  percentageDrift: number;
}

export interface RecalculationResult {
  organizationId: number;
  organizationName: string;
  previousTotal: number;
  newTotal: number;
  difference: number;
  fileCount: number;
  hadDiscrepancy: boolean;
  discrepancy?: StorageDiscrepancy;
}

export interface BatchRecalculationResult {
  totalOrganizations: number;
  successCount: number;
  errorCount: number;
  discrepanciesFound: number;
  totalBytesRecalculated: number;
  results: RecalculationResult[];
  errors: Array<{ organizationId: number; error: string }>;
}

export class StorageRecalculationApplicationService {
  private readonly workspaceScanner: WorkspaceStorageScanner;

  constructor(
    private readonly fileStorageRepository: IFileStorageRepository,
    private readonly organizationRepository: IOrganizationRepository,
    workspaceScanner?: WorkspaceStorageScanner
  ) {
    // Use provided scanner or create default instance
    this.workspaceScanner = workspaceScanner || new WorkspaceStorageScanner();
  }

  /**
   * Recalculate storage for a single organization
   * Compares tracked counters vs actual S3 usage and updates if needed
   */
  async recalculateOrganizationStorage(
    organizationId: number
  ): Promise<Result<RecalculationResult>> {
    try {
      // Get current organization data
      const orgIdVO = OrganizationId.fromNumber(organizationId);
      const organization = await this.organizationRepository.findById(orgIdVO);

      if (!organization) {
        return ResultHelpers.failure(`Organization ${organizationId} not found`);
      }

      // Get tracked storage from database
      const trackedTotal = organization.storageUsedBytes || 0;
      const trackedDatabase = organization.databaseStorageBytes || 0;
      const trackedChat = organization.chatStorageBytes || 0;
      const trackedSkill = organization.skillStorageBytes || 0;
      const trackedWorkspace = organization.workspaceStorageBytes || 0;

      logger.debug(
        `Recalculating storage for organization ${organizationId} (${organization.name.value})`
      );
      logger.debug(`Tracked storage: ${trackedTotal} bytes`);

      // Invalidate cache to ensure we get fresh S3 data
      invalidateOrgStorageCache(organizationId);
      this.workspaceScanner.invalidateCache(organizationId);

      // Scan actual S3 storage (database, chat, skill)
      const s3Breakdown = await this.fileStorageRepository.getOrganizationStorageBreakdown(
        organizationId
      );

      // Scan workspace storage from EFS
      const workspaceResult = await this.workspaceScanner.scanOrganization(organizationId);

      // Combine S3 + EFS results
      const actualBreakdown = {
        ...s3Breakdown,
        workspaceStorageBytes: workspaceResult.totalBytes,
        totalBytes: s3Breakdown.totalBytes + workspaceResult.totalBytes,
      };

      logger.debug(
        `Actual storage: ${actualBreakdown.totalBytes} bytes ` +
          `(S3: ${s3Breakdown.totalBytes}, workspace: ${workspaceResult.totalBytes}, ` +
          `${actualBreakdown.fileCount} S3 files, ${workspaceResult.agentCount} agents)`
      );

      // Calculate difference
      const difference = actualBreakdown.totalBytes - trackedTotal;
      const percentageDrift =
        trackedTotal > 0 ? Math.abs((difference / trackedTotal) * 100) : 0;

      const hadDiscrepancy = Math.abs(difference) > 1024; // > 1KB difference

      if (hadDiscrepancy) {
        logger.debug(
          `Storage discrepancy detected for organization ${organizationId}: ` +
            `tracked=${trackedTotal} actual=${actualBreakdown.totalBytes} ` +
            `diff=${difference} (${percentageDrift.toFixed(2)}%)`
        );
      }

      // Update organization storage counters with actual values
      await this.organizationRepository.update(orgIdVO, {
        storageUsedBytes: actualBreakdown.totalBytes,
        databaseStorageBytes: actualBreakdown.databaseStorageBytes,
        chatStorageBytes: actualBreakdown.chatStorageBytes,
        skillStorageBytes: actualBreakdown.skillStorageBytes,
        workspaceStorageBytes: actualBreakdown.workspaceStorageBytes,
      });

      logger.debug(
        `Updated storage for organization ${organizationId}: ${actualBreakdown.totalBytes} bytes`
      );

      const result: RecalculationResult = {
        organizationId,
        organizationName: organization.name.value,
        previousTotal: trackedTotal,
        newTotal: actualBreakdown.totalBytes,
        difference,
        fileCount: actualBreakdown.fileCount,
        hadDiscrepancy,
      };

      // Include detailed discrepancy if significant
      if (hadDiscrepancy) {
        result.discrepancy = {
          organizationId,
          organizationName: organization.name.value,
          tracked: {
            totalBytes: trackedTotal,
            databaseBytes: trackedDatabase,
            chatBytes: trackedChat,
            skillBytes: trackedSkill,
            workspaceBytes: trackedWorkspace,
          },
          actual: {
            totalBytes: actualBreakdown.totalBytes,
            databaseBytes: actualBreakdown.databaseStorageBytes,
            chatBytes: actualBreakdown.chatStorageBytes,
            skillBytes: actualBreakdown.skillStorageBytes,
            workspaceBytes: actualBreakdown.workspaceStorageBytes,
          },
          difference: {
            totalBytes: difference,
            databaseBytes: actualBreakdown.databaseStorageBytes - trackedDatabase,
            chatBytes: actualBreakdown.chatStorageBytes - trackedChat,
            skillBytes: actualBreakdown.skillStorageBytes - trackedSkill,
            workspaceBytes: actualBreakdown.workspaceStorageBytes - trackedWorkspace,
          },
          percentageDrift,
        };
      }

      return ResultHelpers.success(result);
    } catch (error) {
      logger.error(`Failed to recalculate storage for organization ${organizationId}:`, error);
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Unknown error during recalculation'
      );
    }
  }

  /**
   * Recalculate storage for all organizations
   * Uses proper repository pattern to get all organizations
   */
  async recalculateAllOrganizations(): Promise<Result<BatchRecalculationResult>> {
    logger.debug('Starting batch storage recalculation for all organizations');

    const batchResult: BatchRecalculationResult = {
      totalOrganizations: 0,
      successCount: 0,
      errorCount: 0,
      discrepanciesFound: 0,
      totalBytesRecalculated: 0,
      results: [],
      errors: [],
    };

    try {
      // Get all organizations using raw method (bypasses RLS for cross-org batch operation)
      // AIDEV-NOTE: This is intentional - scheduler needs visibility across all orgs
      const allOrganizations = await this.organizationRepository.findAllRaw();
      batchResult.totalOrganizations = allOrganizations.length;

      logger.debug(`Found ${allOrganizations.length} organizations to process`);

      // Process each organization
      for (const org of allOrganizations) {
        // AIDEV-NOTE: Wrap in withSystemContext so findById/update work with RLS
        const result = await withSystemContext(org.id.value, () =>
          this.recalculateOrganizationStorage(org.id.value)
        );

        if (result.success && result.data) {
          batchResult.successCount++;
          batchResult.totalBytesRecalculated += result.data.newTotal;
          batchResult.results.push(result.data);

          if (result.data.hadDiscrepancy) {
            batchResult.discrepanciesFound++;
          }
        } else {
          batchResult.errorCount++;
          batchResult.errors.push({
            organizationId: org.id.value,
            error: result.error || 'Unknown error',
          });
        }
      }

      logger.debug(
        `Batch recalculation complete: ${batchResult.successCount} success, ` +
          `${batchResult.errorCount} errors, ${batchResult.discrepanciesFound} discrepancies found`
      );

      // Log discrepancies for monitoring
      if (batchResult.discrepanciesFound > 0) {
        logger.debug(
          `Found ${batchResult.discrepanciesFound} organizations with storage drift`
        );

        // Log top discrepancies
        const topDiscrepancies = batchResult.results
          .filter((r) => r.hadDiscrepancy && r.discrepancy)
          .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
          .slice(0, 10);

        topDiscrepancies.forEach((r) => {
          logger.debug(
            `  - ${r.organizationName} (${r.organizationId}): ` +
              `${r.difference > 0 ? '+' : ''}${r.difference} bytes ` +
              `(${r.discrepancy?.percentageDrift.toFixed(2)}% drift)`
          );
        });
      }

      return ResultHelpers.success(batchResult);
    } catch (error) {
      logger.error('Batch recalculation failed:', error);
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Unknown error during batch recalculation'
      );
    }
  }

  /**
   * Get storage discrepancies without updating
   * Useful for monitoring/reporting
   */
  async detectDiscrepancies(
    thresholdBytes: number = 1024 * 1024 // 1MB default
  ): Promise<Result<StorageDiscrepancy[]>> {
    logger.debug(`Detecting storage discrepancies (threshold: ${thresholdBytes} bytes)`);

    const discrepancies: StorageDiscrepancy[] = [];

    try {
      // AIDEV-NOTE: Uses raw method to query across all orgs (bypasses RLS)
      // This is intentional - detecting discrepancies needs visibility across all organizations
      const allOrganizations = await this.organizationRepository.findAllRaw();

      for (const org of allOrganizations) {
        const trackedTotal = org.storageUsedBytes || 0;

        // Get S3 storage
        const s3Breakdown = await this.fileStorageRepository.getOrganizationStorageBreakdown(
          org.id.value
        );

        // Get workspace storage from EFS
        const workspaceResult = await this.workspaceScanner.scanOrganization(org.id.value);

        // Combine
        const actualBreakdown = {
          ...s3Breakdown,
          workspaceStorageBytes: workspaceResult.totalBytes,
          totalBytes: s3Breakdown.totalBytes + workspaceResult.totalBytes,
        };

        const difference = actualBreakdown.totalBytes - trackedTotal;

        if (Math.abs(difference) >= thresholdBytes) {
          discrepancies.push({
            organizationId: org.id.value,
            organizationName: org.name.value,
            tracked: {
              totalBytes: trackedTotal,
              databaseBytes: org.databaseStorageBytes || 0,
              chatBytes: org.chatStorageBytes || 0,
              skillBytes: org.skillStorageBytes || 0,
              workspaceBytes: org.workspaceStorageBytes || 0,
            },
            actual: {
              totalBytes: actualBreakdown.totalBytes,
              databaseBytes: actualBreakdown.databaseStorageBytes,
              chatBytes: actualBreakdown.chatStorageBytes,
              skillBytes: actualBreakdown.skillStorageBytes,
              workspaceBytes: actualBreakdown.workspaceStorageBytes,
            },
            difference: {
              totalBytes: difference,
              databaseBytes:
                actualBreakdown.databaseStorageBytes - (org.databaseStorageBytes || 0),
              chatBytes: actualBreakdown.chatStorageBytes - (org.chatStorageBytes || 0),
              skillBytes: actualBreakdown.skillStorageBytes - (org.skillStorageBytes || 0),
              workspaceBytes: actualBreakdown.workspaceStorageBytes - (org.workspaceStorageBytes || 0),
            },
            percentageDrift: trackedTotal > 0 ? Math.abs((difference / trackedTotal) * 100) : 0,
          });
        }
      }

      logger.debug(`Found ${discrepancies.length} organizations with storage discrepancies`);

      return ResultHelpers.success(discrepancies);
    } catch (error) {
      logger.error('Failed to detect discrepancies:', error);
      return ResultHelpers.failure(
        error instanceof Error ? error.message : 'Unknown error during detection'
      );
    }
  }
}
