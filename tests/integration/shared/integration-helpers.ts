import { Client } from 'pg';

// AIDEV-NOTE: Integration test client for HTTP API, gRPC, and direct database operations
// Provides a unified interface for testing across all system boundaries

export class IntegrationTestClient {
  private dbClient: Client;
  
  constructor(
    private dbUrl = process.env.TEST_DATABASE_URL!,
    private appUrl = process.env.TEST_APP_URL!,
    private grpcUrl = process.env.TEST_GRPC_URL!
  ) {
    this.dbClient = new Client({ connectionString: this.dbUrl });
  }

  // Database operations
  async verifyDatabaseConnection(): Promise<void> {
    try {
      // Only connect if not already connected
      if (!(this.dbClient as any)._connected) {
        await this.dbClient.connect();
      }
      const result = await this.dbClient.query('SELECT 1 as connected');
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
    // Seed essential test data (organizations and test users)
    // This data persists across individual tests
    await this.query(`
      INSERT INTO organizations (id, name, slug) VALUES 
      (1, 'Test Organization 1', 'test-org-1'),
      (2, 'Test Organization 2', 'test-org-2')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Reset sequence to avoid conflicts with auto-increment in other tests
    // Set to MAX(id) + 1 to ensure next auto-increment doesn't conflict
    await this.query(`
      SELECT setval(pg_get_serial_sequence('organizations', 'id'), 
                   GREATEST(COALESCE(MAX(id), 0) + 1, 3)) FROM organizations
    `);
    
    await this.query(`
      INSERT INTO users (id, email, name, current_organization_id) VALUES 
      ('550e8400-e29b-41d4-a716-446655440001', 'test1@example.com', 'Test User 1', 1),
      ('550e8400-e29b-41d4-a716-446655440002', 'test2@example.com', 'Test User 2', 2)
      ON CONFLICT (id) DO NOTHING  
    `);
    
    await this.query(`
      INSERT INTO user_organizations (user_id, organization_id, role) VALUES 
      ('550e8400-e29b-41d4-a716-446655440001', 1, 'owner'),
      ('550e8400-e29b-41d4-a716-446655440002', 2, 'owner')
      ON CONFLICT DO NOTHING  
    `);
    
    console.log('✅ Basic test data seeded with sequence reset');
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
      // Ensure connection is established
      if (!(this.dbClient as any)._connected) {
        await this.dbClient.connect();
      }
      const result = await this.dbClient.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Database query failed:', sql, params, error);
      throw error;
    }
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
      await this.dbClient.end();
    } catch (error) {
      console.warn('Error disconnecting from database:', error);
    }
  }
}

// Singleton instance for use across all integration tests
export const testClient = new IntegrationTestClient();