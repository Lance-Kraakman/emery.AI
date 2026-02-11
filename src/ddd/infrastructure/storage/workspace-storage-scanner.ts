/**
 * Workspace Storage Scanner
 *
 * Scans EFS filesystem to calculate workspace storage usage per organization.
 * Used by StorageRecalculationApplicationService to get accurate workspace sizes.
 *
 * Workspace path structure:
 *   {WORKSPACE_STORAGE_PATH}/{orgId}/agents/{agentId}/
 *
 * Note: This only works when the scheduler has EFS mounted.
 * Set WORKSPACE_STORAGE_PATH env var to enable.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('WorkspaceStorageScanner');

// Cache results for 1 hour (same as S3 scanner)
const CACHE_TTL_MS = 60 * 60 * 1000;

interface WorkspaceScanResult {
  totalBytes: number;
  agentCount: number;
  scannedAt: Date;
}

interface CacheEntry {
  data: WorkspaceScanResult;
  cachedAt: number;
}

// In-memory cache for scan results
const scanCache = new Map<number, CacheEntry>();

export class WorkspaceStorageScanner {
  private readonly workspacePath: string | null;

  constructor() {
    this.workspacePath = process.env.WORKSPACE_STORAGE_PATH || null;

    if (this.workspacePath) {
      logger.debug(`Workspace storage scanner initialized with path: ${this.workspacePath}`);
    } else {
      logger.debug('WORKSPACE_STORAGE_PATH not set - workspace storage scanning disabled');
    }
  }

  /**
   * Check if the scanner is available (EFS mounted)
   */
  isAvailable(): boolean {
    if (!this.workspacePath) {
      return false;
    }

    try {
      return fs.existsSync(this.workspacePath);
    } catch {
      return false;
    }
  }

  /**
   * Scan a single organization's workspace storage
   */
  async scanOrganization(orgId: number): Promise<WorkspaceScanResult> {
    // Check cache first
    const cached = scanCache.get(orgId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      logger.debug(`Cache hit for org ${orgId}`);
      return cached.data;
    }

    if (!this.isAvailable()) {
      logger.debug(`Scanner not available, returning 0 for org ${orgId}`);
      return {
        totalBytes: 0,
        agentCount: 0,
        scannedAt: new Date(),
      };
    }

    const orgPath = path.join(this.workspacePath!, String(orgId));

    if (!fs.existsSync(orgPath)) {
      logger.debug(`Org path does not exist: ${orgPath}`);
      return {
        totalBytes: 0,
        agentCount: 0,
        scannedAt: new Date(),
      };
    }

    try {
      const result = await this.scanDirectory(orgPath);

      // Count agents (subdirectories in agents/ folder)
      const agentsPath = path.join(orgPath, 'agents');
      let agentCount = 0;
      if (fs.existsSync(agentsPath)) {
        const agentDirs = fs.readdirSync(agentsPath, { withFileTypes: true });
        agentCount = agentDirs.filter((d) => d.isDirectory()).length;
      }

      const scanResult: WorkspaceScanResult = {
        totalBytes: result,
        agentCount,
        scannedAt: new Date(),
      };

      // Cache the result
      scanCache.set(orgId, { data: scanResult, cachedAt: Date.now() });

      logger.debug(
        `Scanned org ${orgId}: ${this.formatBytes(result)} across ${agentCount} agents`
      );

      return scanResult;
    } catch (error) {
      logger.error(`Failed to scan org ${orgId}:`, error);
      return {
        totalBytes: 0,
        agentCount: 0,
        scannedAt: new Date(),
      };
    }
  }

  /**
   * Scan all organizations and return a map of orgId -> workspace bytes
   */
  async scanAllOrganizations(): Promise<Map<number, WorkspaceScanResult>> {
    const results = new Map<number, WorkspaceScanResult>();

    if (!this.isAvailable()) {
      logger.debug('Scanner not available, returning empty results');
      return results;
    }

    try {
      const entries = fs.readdirSync(this.workspacePath!, { withFileTypes: true });

      for (const entry of entries) {
        // Skip non-directories and non-numeric names
        if (!entry.isDirectory()) continue;

        const orgId = parseInt(entry.name, 10);
        if (isNaN(orgId)) continue;

        const result = await this.scanOrganization(orgId);
        results.set(orgId, result);
      }

      logger.debug(`Scanned ${results.size} organizations`);
      return results;
    } catch (error) {
      logger.error('Failed to scan all organizations:', error);
      return results;
    }
  }

  /**
   * Invalidate cache for an organization (call after workspace changes)
   */
  invalidateCache(orgId: number): void {
    scanCache.delete(orgId);
    logger.debug(`Cache invalidated for org ${orgId}`);
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    scanCache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Recursively scan a directory and return total size in bytes
   */
  private async scanDirectory(dirPath: string): Promise<number> {
    let totalBytes = 0;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        totalBytes += await this.scanDirectory(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          totalBytes += stats.size;
        } catch {
          // Skip files we can't stat (permissions, etc.)
        }
      }
      // Skip symlinks, devices, etc.
    }

    return totalBytes;
  }

  /**
   * Format bytes for human-readable logging
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
