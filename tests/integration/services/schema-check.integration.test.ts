import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

// AIDEV-NOTE: Schema verification test to understand actual database structure
// Checks what columns exist in key tables

describe('Schema Verification Test', () => {
  let dbClient: Client;
  
  beforeAll(async () => {
    console.log('🔧 Setting up schema verification test...');
    
    const dbUrl = 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
    dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();
    
    console.log('✅ Schema verification test setup complete');
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }
  });

  test('should show agents table schema', async () => {
    const result = await dbClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'agents'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Agents table columns:');
    for (const column of result.rows) {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    }
    
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('should show tasks table schema', async () => {
    const result = await dbClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tasks'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Tasks table columns:');
    for (const column of result.rows) {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    }
    
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('should show organizations table schema', async () => {
    const result = await dbClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Organizations table columns:');
    for (const column of result.rows) {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    }
    
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('should show users table schema', async () => {
    const result = await dbClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users table columns:');
    for (const column of result.rows) {
      console.log(`  - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`);
    }
    
    expect(result.rows.length).toBeGreaterThan(0);
  });
});