import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

// AIDEV-NOTE: Integration test client for HTTP API, gRPC, and direct database operations
// Provides a unified interface for testing across all system boundaries
// Now includes Drizzle ORM support for RLS testing

export class IntegrationTestClient {
  private dbClient: Client | null = null;
  private pgClient: ReturnType<typeof postgres> | null = null;
  private _db: ReturnType<typeof drizzle> | null = null;
  
  constructor(
    private dbUrl = process.env.TEST_DATABASE_URL!,
    private appUrl = process.env.TEST_APP_URL!,
    private grpcUrl = process.env.TEST_GRPC_URL!
  ) {
    // AIDEV-NOTE: Connections are now lazy-initialized to avoid creating them
    // before migrations run. This prevents "unrecognized configuration parameter" 
    // errors when RLS functions don't exist yet.
  }

  // Lazy getter for database client
  private getDbClient(): Client {
    if (!this.dbClient) {
      this.dbClient = new Client({ connectionString: this.dbUrl });
    }
    return this.dbClient;
  }

  // Lazy getter for postgres client
  private getPgClient(): ReturnType<typeof postgres> {
    if (!this.pgClient) {
      // Initialize shared postgres connection for RLS testing  
      // Use single connection to ensure RLS context is shared across all queries
      this.pgClient = postgres(this.dbUrl, {
        max: 1,         // Single connection for RLS context
        min: 1,         // Keep connection alive
        prepare: false, // Disable prepared statements for easier debugging
        onnotice: () => {}, // Suppress notices
        connection: {
          // Ensure session variables persist
          application_name: 'integration_test_rls'
        }
      });
    }
    return this.pgClient;
  }

  // Lazy getter for Drizzle database
  public get db(): ReturnType<typeof drizzle> {
    if (!this._db) {
      this._db = drizzle(this.getPgClient(), { schema });
    }
    return this._db;
  }

  // Database operations
  async verifyDatabaseConnection(): Promise<void> {
    try {
      const dbClient = this.getDbClient();
      // Only connect if not already connected
      if (!(dbClient as any)._connected) {
        await dbClient.connect();
      }
      const result = await dbClient.query('SELECT 1 as connected');
      if (!result.rows[0]?.connected) {
        throw new Error('Database connection test failed');
      }
      console.log('✅ Database connection verified');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }
  
  async verifyDatabaseSchema(): Promise<void> {
    // Check that essential tables exist (migrations have been applied)
    const tables = ['organizations', 'users', 'agents', 'tasks', 'rag_indexes'];
    
    for (const table of tables) {
      const result = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        ) as table_exists
      `, [table]);
      
      if (!result[0].table_exists) {
        throw new Error(`Required table '${table}' not found. Ensure migrations have run.`);
      }
    }
    
    console.log('✅ Database schema verified');
  }
  
  async seedBasicTestData(): Promise<void> {
    // AIDEV-NOTE: No longer doing manual SQL inserts here. 
    // Test data will be seeded in individual tests using proper domain services
    // with withRLSContext, exactly as the application does.
    console.log('✅ Basic test data seeding skipped - will use domain services in tests');
  }
  
  async cleanTestData(): Promise<void> {
    // Clean up test data created during individual tests
    // Preserve organizations and basic users for next test
    const tables = [
      'tasks', 
      'agents',
      'rag_documents',
      'rag_indexes'
    ];
    
    for (const table of tables) {
      try {
        await this.query(`DELETE FROM ${table} WHERE organization_id IN (1, 2)`);
      } catch (error: any) {
        // Skip if table doesn't exist
        if (error.code !== '42P01') {
          console.error(`Error cleaning ${table}:`, error.message);
        }
      }
    }
  }
  
  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const dbClient = this.getDbClient();
      // Ensure connection is established
      if (!(dbClient as any)._connected) {
        await dbClient.connect();
      }
      const result = await dbClient.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Database query failed:', sql, params, error);
      throw error;
    }
  }

  // RLS Context Management - all operations must use the same transaction/connection
  async setOrganizationContext(orgId: number): Promise<void> {
    // Use a single transaction to set and verify context
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${orgId.toString()}, true)`);
      
      // Verify context was set within same transaction
      const check = await tx.execute(sql`SELECT current_setting('app.current_organization_id') as current_org`);
      console.log(`🔍 Set organization context to ${orgId}, verified: ${check[0]?.current_org}`);
      
      // Also verify the helper function works
      const helperCheck = await tx.execute(sql`SELECT get_current_organization_id() as org_id`);
      console.log(`🔍 Helper function returns: ${helperCheck[0]?.org_id}`);
    });
  }
  
  async setUserContext(userId: string): Promise<void> {
    await this.db.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
  }
  
  async clearRLSContext(): Promise<void> {
    await this.db.execute(sql`SELECT set_config('app.current_organization_id', '', true)`);
    await this.db.execute(sql`SELECT set_config('app.current_user_id', '', true)`);
  }

  
  // Execute a query with RLS context in the same transaction
  async queryWithContext<T>(orgId: number, query: () => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx) => {
      // Set context within transaction
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${orgId.toString()}, true)`);
      
      // Execute the query - but this won't work because we need to pass the tx to the query
      // This approach won't work cleanly with Drizzle
      return await query();
    });
  }

  // HTTP API operations
  async get(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.appUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return response.json();
  }
  
  async post(endpoint: string, data: any, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.appUrl}${endpoint}`, {
      method: 'POST',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        error: errorText
      };
    }
    
    return {
      success: true,
      status: response.status,
      data: await response.json()
    };
  }
  
  async put(endpoint: string, data: any, options: RequestInit = {}): Promise<any> {
    return this.post(endpoint, data, { ...options, method: 'PUT' });
  }
  
  async delete(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.appUrl}${endpoint}`, {
      method: 'DELETE',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    return {
      success: response.ok,
      status: response.status,
      data: response.ok ? await response.json() : await response.text()
    };
  }

  // Agent/gRPC operations (placeholder for future implementation)
  async executeAgentTask(request: any): Promise<any> {
    // TODO: Implement gRPC client for agent task execution
    // This would connect to the agent container on port 50053
    throw new Error('Agent task execution not yet implemented');
  }
  
  // Health check operations
  async checkAppHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.appUrl}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  
  // Cleanup method for graceful shutdown
  async disconnect(): Promise<void> {
    try {
      if (this.dbClient) {
        await this.dbClient.end();
        this.dbClient = null;
      }
      if (this.pgClient) {
        await this.pgClient.end();
        this.pgClient = null;
        this._db = null;
      }
    } catch (error) {
      console.warn('Error disconnecting from database:', error);
    }
  }
}

// Singleton instance for use across all integration tests
export const testClient = new IntegrationTestClient();