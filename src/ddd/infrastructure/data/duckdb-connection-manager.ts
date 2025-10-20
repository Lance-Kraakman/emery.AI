/**
 * DuckDB Connection Manager - Singleton Pattern
 *
 * Prevents multiple DuckDB connections from being created during build/runtime.
 * Ensures only one DuckDB instance exists to avoid extension registration conflicts.
 *
 * AIDEV-NOTE: Uses dynamic import to avoid loading native module during Next.js build
 * Uses official @duckdb/node-api package with promise-based API
 */

import type { DuckDBConnection } from '@duckdb/node-api';

export class DuckDBConnectionManager {
  private static instance: DuckDBConnectionManager | null = null;
  private connection: DuckDBConnection | null = null;
  private initializationPromise: Promise<DuckDBConnection | null> | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DuckDBConnectionManager {
    if (!DuckDBConnectionManager.instance) {
      DuckDBConnectionManager.instance = new DuckDBConnectionManager();
    }
    return DuckDBConnectionManager.instance;
  }

  /**
   * Get or create DuckDB connection (singleton)
   * Returns null during build time to avoid initialization conflicts
   */
  async getConnection(): Promise<DuckDBConnection | null> {
    // Skip DuckDB during build to avoid native module loading
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' ||
                        process.env.npm_lifecycle_event === 'build';

    if (isBuildTime) {
      console.log('[DuckDB] Skipping initialization during build phase');
      return null;
    }

    // Return existing connection if already initialized
    if (this.isInitialized && this.connection) {
      return this.connection;
    }

    // Wait for ongoing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create new connection
    this.initializationPromise = this.initialize();
    return this.initializationPromise;
  }

  private async initialize(): Promise<DuckDBConnection | null> {
    try {
      console.log('[DuckDB] Creating singleton connection with @duckdb/node-api...');

      // Dynamic import to avoid loading native module during Next.js build
      const { DuckDBConnection } = await import('@duckdb/node-api');

      // Create connection (uses default in-memory instance)
      this.connection = await DuckDBConnection.create();
      console.log('[DuckDB] Connection created, installing extensions...');

      // Install extensions globally for this connection
      // AIDEV-NOTE: Use arrow FROM community repository for ARM64 support
      // The community arrow extension is an alias for nanoarrow and supports all platforms
      await this.connection.run("INSTALL arrow FROM community; LOAD arrow; INSTALL httpfs; LOAD httpfs;");
      console.log('[DuckDB] ✅ Extensions loaded: arrow (nanoarrow), httpfs');

      // Configure S3 if credentials are available
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const region = process.env.AWS_REGION || 'ap-southeast-2';
        // AIDEV-NOTE: Support both S3_ENDPOINT_URL and AWS_ENDPOINT_URL for compatibility
        // AWS SDK uses AWS_ENDPOINT_URL, but some configs use S3_ENDPOINT_URL
        const endpointRaw = process.env.S3_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL;

        // DuckDB expects endpoint without protocol (e.g., 'minio:9000' not 'http://minio:9000')
        // AWS SDK clients expect endpoint WITH protocol
        let endpoint: string | undefined;
        let useSSL = true;

        if (endpointRaw) {
          useSSL = !endpointRaw.startsWith('http://');
          // Strip protocol from endpoint for DuckDB
          endpoint = endpointRaw.replace(/^https?:\/\//, '');
        }

        console.log(`[DuckDB] 🔧 Configuring S3 access:`, {
          region,
          endpoint: endpoint || '(AWS default)',
          endpointSource: process.env.S3_ENDPOINT_URL ? 'S3_ENDPOINT_URL' :
                         process.env.AWS_ENDPOINT_URL ? 'AWS_ENDPOINT_URL' : 'none',
          useSSL
        });

        const s3Config = [
          `SET s3_region='${region}';`,
          `SET s3_access_key_id='${process.env.AWS_ACCESS_KEY_ID}';`,
          `SET s3_secret_access_key='${process.env.AWS_SECRET_ACCESS_KEY}';`
        ];

        if (endpoint) {
          s3Config.push(`SET s3_endpoint='${endpoint}';`);
          s3Config.push(`SET s3_use_ssl='${useSSL}';`);
          // AIDEV-NOTE: S3-compatible services use path-style URLs (bucket.s3.endpoint vs endpoint/bucket)
          // This is standard for custom endpoints (MinIO, LocalStack, etc.)
          s3Config.push(`SET s3_url_style='path';`);
        }

        await this.connection.run(s3Config.join(' '));
        console.log('[DuckDB] ✅ S3 configuration applied successfully');
      } else {
        console.warn('[DuckDB] ⚠️  No S3 credentials found (S3 queries will fail)');
      }

      this.isInitialized = true;
      this.initializationPromise = null;
      console.log('[DuckDB] ✅ Singleton connection fully initialized');
      return this.connection;
    } catch (error) {
      console.error('[DuckDB] ❌ Failed to initialize connection:', error);
      this.connection = null;
      this.isInitialized = false;
      this.initializationPromise = null;
      throw error; // Propagate error to crash server startup
    }
  }

  /**
   * Reset connection (useful for testing)
   */
  async reset(): Promise<void> {
    if (this.connection) {
      this.connection.closeSync();
    }
    this.connection = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// Export singleton instance getter
export async function getDuckDBConnection(): Promise<DuckDBConnection | null> {
  return DuckDBConnectionManager.getInstance().getConnection();
}
