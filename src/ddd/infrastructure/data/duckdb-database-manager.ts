/**
 * DuckDB Database Manager
 *
 * Manages DuckDB database files stored in S3.
 * One .duckdb file per domain Database (not per table).
 *
 * AIDEV-NOTE: Phase 1 Implementation (Simple)
 * - PostgreSQL advisory locks for distributed coordination
 * - Download → Execute → Upload pattern
 * - No connection pooling (can be slow under high load)
 *
 * AIDEV-NOTE: Future Optimization (Phase 2)
 * When performance becomes an issue, implement:
 * 1. Redis distributed locks (faster than PostgreSQL advisory locks)
 * 2. Connection pooling:
 *    - Keep active .duckdb connections in memory
 *    - Avoid re-downloading frequently accessed databases
 *    - Use CHECKPOINT command to flush WAL without closing: await conn.run('CHECKPOINT')
 * 3. Write-behind caching:
 *    - Mark connections as "dirty" on writes
 *    - Background process syncs to S3 every 5 seconds
 *    - Reduces S3 uploads from N writes → 1 upload per 5 seconds
 * 4. Connection eviction:
 *    - Close idle connections after 5 minutes
 *    - Free up memory for hot databases
 *
 * See Redis implementation example at:
 * https://github.com/mike-marcacci/node-redlock
 */

import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { DbClient } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class DuckDBDatabaseManager {
  constructor(private db: DbClient) {}

  /**
   * Execute operation with database-level locking
   * Downloads .duckdb from S3, executes operation, uploads back to S3
   */
  async withDatabaseLock<T>(
    organizationId: OrganizationId,
    databaseId: DatabaseId,
    operation: (conn: DuckDBConnection) => Promise<T>
  ): Promise<T> {
    // Acquire PostgreSQL advisory lock (distributed across all processes)
    // Use unique lock ID combining org and database IDs
    const lockId = (organizationId.value * 1000000) + databaseId.value;
    await this.db.execute(sql`SELECT pg_advisory_lock(${lockId})`);

    try {
      // Download .duckdb file from S3 to local temp
      const localPath = await this.downloadDatabase(organizationId, databaseId);

      // Open DuckDB instance for the database file
      const instance = await DuckDBInstance.create(localPath);

      try {
        // Create connection to the instance
        const conn = await DuckDBConnection.create(instance);

        // Execute operation
        const result = await operation(conn);

        // CRITICAL: Close connection and instance BEFORE uploading
        // This ensures all changes are flushed to disk
        conn.closeSync();
        instance.closeSync();

        // Upload modified file back to S3
        await this.uploadDatabase(organizationId, databaseId, localPath);

        return result;
      } finally {
        // Cleanup local file
        try {
          fs.unlinkSync(localPath);
        } catch (err) {
          console.warn(`[DuckDBDatabaseManager] Failed to cleanup ${localPath}:`, err);
        }
      }
    } finally {
      // Release PostgreSQL advisory lock
      await this.db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
    }
  }

  /**
   * Download database file from S3 to local /tmp
   * Returns path - DuckDB will create new file if it doesn't exist
   */
  private async downloadDatabase(
    organizationId: OrganizationId,
    databaseId: DatabaseId
  ): Promise<string> {
    const s3Key = `org_${organizationId.value}/db_${databaseId.value}/data.duckdb`;
    const localPath = path.join(
      os.tmpdir(),
      `org_${organizationId.value}_db_${databaseId.value}_${Date.now()}.duckdb`
    );

    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }));

      if (!response.Body) {
        // Database doesn't exist in S3 - DuckDB will create new file
        console.log(`[DuckDBDatabaseManager] No existing database in S3, will create new at ${localPath}`);
        return localPath;
      }

      const buffer = Buffer.from(await response.Body.transformToByteArray());
      fs.writeFileSync(localPath, buffer);

      console.log(`[DuckDBDatabaseManager] Downloaded ${s3Key} (${buffer.length} bytes) to ${localPath}`);
      return localPath;

    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        // Database doesn't exist in S3 - DuckDB will create new file
        console.log(`[DuckDBDatabaseManager] No existing database in S3, will create new at ${localPath}`);
        return localPath;
      }
      throw error;
    }
  }

  /**
   * Upload database file from local /tmp to S3
   */
  private async uploadDatabase(
    organizationId: OrganizationId,
    databaseId: DatabaseId,
    localPath: string
  ): Promise<void> {
    const s3Key = `org_${organizationId.value}/db_${databaseId.value}/data.duckdb`;

    const buffer = fs.readFileSync(localPath);

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: 'application/vnd.duckdb'
    }));

    console.log(`[DuckDBDatabaseManager] Uploaded ${localPath} (${buffer.length} bytes) to ${s3Key}`);
  }
}
