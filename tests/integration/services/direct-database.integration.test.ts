import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

// AIDEV-NOTE: Direct database integration test bypassing testClient
// Tests raw database connectivity to isolate hanging issue

describe('Direct Database Integration Test', () => {
  let dbClient: Client;
  
  beforeAll(async () => {
    console.log('🔧 Setting up direct database test...');
    
    // Connect directly without testClient
    const dbUrl = 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
    console.log('🔄 Connecting to:', dbUrl);
    
    dbClient = new Client({ connectionString: dbUrl });
    
    try {
      await dbClient.connect();
      console.log('✅ Direct database connection successful');
    } catch (error) {
      console.error('❌ Direct database connection failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }
  });

  test('should execute simple query', async () => {
    const result = await dbClient.query('SELECT 1 as test_value');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].test_value).toBe(1);
    console.log('✅ Simple query successful');
  });

  test('should check if organizations table exists', async () => {
    const result = await dbClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'organizations'
      ) as table_exists
    `);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].table_exists).toBe(true);
    console.log('✅ Organizations table exists');
  });

  test('should check current database connection', async () => {
    const result = await dbClient.query('SELECT current_database() as db_name, current_user as user_name');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].db_name).toBe('emery_integration_test');
    expect(result.rows[0].user_name).toBe('postgres');
    console.log('✅ Connected to correct database:', result.rows[0]);
  });

  test('should count rows in organizations table', async () => {
    const result = await dbClient.query('SELECT COUNT(*) as count FROM organizations');
    expect(result.rows).toHaveLength(1);
    console.log('✅ Organizations table has', result.rows[0].count, 'rows');
  });
});