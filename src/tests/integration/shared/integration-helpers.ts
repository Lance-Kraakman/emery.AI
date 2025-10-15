import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql, inArray, or, like } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { withRLSContext } from '@/lib/db/rls-context';
import { contextAwareDb, type ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import { db as rawDb, type DbClient } from '@/lib/db/client';
import type { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// AIDEV-NOTE: Integration test client for HTTP API, gRPC, and direct database operations
// Provides a unified interface for testing across all system boundaries
// Now includes Drizzle ORM support for RLS testing

export class IntegrationTestClient {
  private dbClient: Client | null = null;
  private pgClient: ReturnType<typeof postgres> | null = null;
  private _db: ContextAwareDbClient;
  private _cleanupDb: DbClient;
  
  constructor(
    private dbUrl = process.env.TEST_DATABASE_URL!,
    private appUrl = process.env.TEST_APP_URL!,
    private grpcUrl = process.env.TEST_GRPC_URL!
  ) {
    // AIDEV-NOTE: Dual database client approach:
    // - Context-aware client for normal test operations (with RLS)
    // - Raw superuser client for cleanup operations (bypasses RLS)
    this._db = contextAwareDb;
    this._cleanupDb = rawDb;
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

  // Context-aware database client (same as application services)
  public get db(): ContextAwareDbClient {
    return this._db;
  }

  // Raw superuser database client for cleanup (bypasses RLS)
  private get cleanupDb(): DbClient {
    return this._cleanupDb;
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
    // Test data will be seeded in individual tests using proper domain services.
    console.log('✅ Basic test data seeding skipped - will use domain services in tests');
  }
  
  async cleanTestData(): Promise<void> {
    // Clean up test data created during individual tests using superuser Drizzle client
    // Uses raw database client to bypass RLS and see all test organizations
    try {
      const db = this.cleanupDb;
      
      // Find all test organizations (they have distinctive naming patterns)
      const testOrgs = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(
          or(
            like(schema.organizations.name, '%Test Organization%'),
            like(schema.organizations.name, '%Integration Test%'),
            like(schema.organizations.name, '%Debug Test%'),
            like(schema.organizations.slug, '%-test-%'),
            like(schema.organizations.slug, '%test-organization%')
          )
        );
      
      if (testOrgs.length === 0) {
        console.log('🧹 No test organizations found, skipping cleanup');
        return;
      }
      
      const testOrgIds = testOrgs.map((org: any) => org.id);
      console.log(`🧹 Starting cleanup for ${testOrgIds.length} test organizations: [${testOrgIds.join(', ')}]`);
      
      // Delete in proper cascade order (deepest children first, then parents)
      // This prevents foreign key constraint violations
      
      // 1. Delete chat messages first (they reference chats and other chat messages)
      const chatsInOrgs = await db.select({ id: schema.chats.id }).from(schema.chats)
        .where(inArray(schema.chats.organizationId, testOrgIds));
      if (chatsInOrgs.length > 0) {
        const chatIds = chatsInOrgs.map((c: any) => c.id);
        await this.safeDelete(db, schema.chatMessages, inArray(schema.chatMessages.chatId, chatIds), 'chat_messages');
      }
      
      // 2. Delete chats (they reference organizations)
      await this.safeDelete(db, schema.chats, inArray(schema.chats.organizationId, testOrgIds), 'chats');
      
      // 3. Delete fields (they reference tables)
      // Note: fields don't have organizationId, so we need to find them through tables
      const tablesInOrgs = await db.select({ id: schema.tables.id }).from(schema.tables)
        .where(inArray(schema.tables.organizationId, testOrgIds));
      if (tablesInOrgs.length > 0) {
        const tableIds = tablesInOrgs.map((t: any) => t.id);
        await this.safeDelete(db, schema.fields, inArray(schema.fields.tableId, tableIds), 'fields');
      }
      
      // 4. Delete tasks (they reference agents, but we delete them before agents)
      await this.safeDelete(db, schema.tasks, inArray(schema.tasks.organizationId, testOrgIds), 'tasks');
      
      // 5. Delete agents (may be referenced by tasks, but tasks are already deleted)
      await this.safeDelete(db, schema.agents, inArray(schema.agents.organizationId, testOrgIds), 'agents');
      
      // 6. Delete RAG-related data (documents, indexes, query logs)
      await this.safeDelete(db, schema.ragQueryLogs, inArray(schema.ragQueryLogs.organizationId, testOrgIds), 'rag_query_logs');
      await this.safeDelete(db, schema.ragDocuments, inArray(schema.ragDocuments.organizationId, testOrgIds), 'rag_documents');
      await this.safeDelete(db, schema.ragIndexes, inArray(schema.ragIndexes.organizationId, testOrgIds), 'rag_indexes');
      
      // 7. Delete teams (they reference organizations)
      await this.safeDelete(db, schema.teams, inArray(schema.teams.organizationId, testOrgIds), 'teams');
      
      // 8. Delete invitations (they reference organizations)
      await this.safeDelete(db, schema.invitations, inArray(schema.invitations.organizationId, testOrgIds), 'invitations');
      
      // 9. Delete tables (they reference databases)
      await this.safeDelete(db, schema.tables, inArray(schema.tables.organizationId, testOrgIds), 'tables');
      
      // 10. Delete databases (they reference organizations)
      await this.safeDelete(db, schema.databases, inArray(schema.databases.organizationId, testOrgIds), 'databases');
      
      // 11. Clean up user_organizations relationships (they reference organizations)
      await this.safeDelete(db, schema.userOrganizations, inArray(schema.userOrganizations.organizationId, testOrgIds), 'user_organizations');
      
      // 12. Nullify user references to test organizations (soft reference)
      await db.update(schema.users)
        .set({ currentOrganizationId: null })
        .where(inArray(schema.users.currentOrganizationId, testOrgIds));
      console.log(`  🔄 Nullified user.current_organization_id references to test orgs`);
      
      // 13. Finally delete the test organizations themselves
      await this.safeDelete(db, schema.organizations, inArray(schema.organizations.id, testOrgIds), 'organizations');
      
      console.log(`✅ Test data cleanup completed successfully for organizations [${testOrgIds.join(', ')}]`);
      
    } catch (error) {
      console.error('❌ Error during test cleanup:', error);
      // Don't throw - let tests continue even if cleanup partially fails
    }
  }

  // Helper method to safely delete from table with proper error handling
  private async safeDelete<T>(
    db: DbClient,
    table: T, 
    condition: any,
    tableName: string
  ): Promise<void> {
    try {
      const result = await db.delete(table as any).where(condition);
      console.log(`  🗑️  Cleaned ${tableName}: ${result.count || 0} rows deleted`);
    } catch (error: any) {
      // Skip if table doesn't exist (42P01 = undefined_table)
      if (error.code === '42P01') {
        console.log(`  ⏭️  Skipped ${tableName}: table doesn't exist`);
      } else {
        console.error(`  ⚠️  Error cleaning ${tableName}:`, error.message);
        // Don't throw - continue with other tables
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

  // Context Management using RLS utility function
  async withTestContext<T>(orgId: OrganizationId, operation: () => Promise<T>, userId?: UserId): Promise<T> {
    return withRLSContext(this.db, orgId, async (tx) => {
      // Operation will use the transaction with proper RLS context set
      return await operation();
    }, userId);
  }

  // RAG indexing helper - wait for index to complete building
  async waitForIndexComplete(indexId: string, timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 200; // Check every 200ms

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Query index status using raw SQL to bypass any service caching
        const result = await this.query(
          'SELECT status FROM rag_indexes WHERE id = $1',
          [indexId]
        );

        if (result.length === 0) {
          throw new Error(`Index ${indexId} not found`);
        }

        const status = result[0].status;
        
        if (status === 'active') {
          console.log(`✅ Index ${indexId.substring(0, 8)} completed building`);
          return;
        }

        if (status === 'error') {
          throw new Error(`Index ${indexId} failed to build`);
        }

        // Status is 'building' - keep waiting
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }
        // Other database errors - keep retrying
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error(`Timeout waiting for index ${indexId} to complete building after ${timeoutMs}ms`);
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
      }
    } catch (error) {
      console.warn('Error disconnecting from database:', error);
    }
  }
}

// Singleton instance for use across all integration tests
export const testClient = new IntegrationTestClient();

