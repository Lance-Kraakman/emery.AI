/**
 * DuckDB Connection Manager - Singleton Pattern
 *
 * Prevents multiple DuckDB connections from being created during build/runtime.
 * Ensures only one DuckDB instance exists to avoid extension registration conflicts.
 *
 * AIDEV-NOTE: Singleton to prevent "Attempted to register an already registered secret type: 's3'" errors
 */

import * as duckdb from 'duckdb';

export class DuckDBConnectionManager {
  private static instance: DuckDBConnectionManager | null = null;
  private connection: duckdb.Database | null = null;
  private initializationPromise: Promise<duckdb.Database | null> | null = null;
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
  async getConnection(): Promise<duckdb.Database | null> {
    // Skip DuckDB during build to avoid extension conflicts
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

  private async initialize(): Promise<duckdb.Database | null> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[DuckDB] Creating singleton connection with stable API...');

        // Create in-memory database with unsigned extensions enabled (for Arrow)
        this.connection = new duckdb.Database(':memory:', {
          allow_unsigned_extensions: 'true'
        });

        this.isInitialized = true;
        this.initializationPromise = null;
        console.log('[DuckDB] Singleton connection created successfully');
        resolve(this.connection);
      } catch (error) {
        console.warn('[DuckDB] Failed to create connection, using fallback repository:', error);
        this.connection = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        resolve(null);
      }
    });
  }

  /**
   * Reset connection (useful for testing)
   */
  reset(): void {
    // Note: DuckDBConnection doesn't have a close method in @duckdb/node-api
    // Connection will be garbage collected
    this.connection = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// Export singleton instance getter
export async function getDuckDBConnection(): Promise<duckdb.Database | null> {
  return DuckDBConnectionManager.getInstance().getConnection();
}
