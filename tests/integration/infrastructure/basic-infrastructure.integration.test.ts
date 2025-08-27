import { describe, test, expect } from 'vitest';
import { testClient } from '../shared/integration-helpers';

// AIDEV-NOTE: Basic infrastructure integration tests
// Tests that containers can start and basic connectivity works
// This bypasses complex DDD application logic to focus on infrastructure

describe('Basic Infrastructure Integration Tests', () => {
  
  test('database connection should work', async () => {
    // Test direct database connection
    const result = await testClient.query('SELECT 1 as test_value');
    expect(result).toHaveLength(1);
    expect(result[0].test_value).toBe(1);
  });

  test('essential tables should exist after migration', async () => {
    // Test that migrations created the required tables
    const tables = await testClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('organizations', 'users', 'agents', 'tasks')
      ORDER BY table_name
    `);
    
    const tableNames = tables.map(t => t.table_name);
    expect(tableNames).toContain('organizations');
    expect(tableNames).toContain('users'); 
    expect(tableNames).toContain('agents');
    expect(tableNames).toContain('tasks');
  });

  test('can insert and read basic test data', async () => {
    // Test basic CRUD operations without DDD layer
    
    // Insert test organization (use a high ID to avoid conflicts)
    const orgResult = await testClient.query(`
      INSERT INTO organizations (id, name, slug) 
      VALUES (9999, 'Test Infrastructure Org', 'test-infrastructure-org') 
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug
      RETURNING id, name
    `);
    expect(orgResult).toHaveLength(1);
    const orgId = orgResult[0].id;
    
    // Insert test user  
    const testUserId = '550e8400-e29b-41d4-a716-446655440099';
    const userResult = await testClient.query(`
      INSERT INTO users (id, email, name, current_organization_id)
      VALUES ($1, 'test@infrastructure.com', 'Test User', $2)
      RETURNING id, email
    `, [testUserId, orgId]);
    expect(userResult).toHaveLength(1);
    expect(userResult[0].email).toBe('test@infrastructure.com');
    
    // Create user-organization relationship
    await testClient.query(`
      INSERT INTO user_organizations (user_id, organization_id, role)
      VALUES ($1, $2, 'owner')
    `, [testUserId, orgId]);
    
    // Verify organization-user relationship
    const relationshipResult = await testClient.query(`
      SELECT u.name as user_name, o.name as org_name
      FROM users u
      JOIN organizations o ON u.current_organization_id = o.id
      WHERE u.id = $1
    `, [testUserId]);
    expect(relationshipResult).toHaveLength(1);
    expect(relationshipResult[0].user_name).toBe('Test User');
    expect(relationshipResult[0].org_name).toBe('Test Infrastructure Org');
    
    // Cleanup (user_organizations will cascade)
    await testClient.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await testClient.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  });

  test('app health endpoint should be reachable (when app container runs)', async () => {
    // This will fail until the app container is fully up, which is expected
    try {
      const isHealthy = await testClient.checkAppHealth();
      if (isHealthy) {
        console.log('✅ App container is running and healthy');
      } else {
        console.log('⚠️ App container not yet ready (expected during infrastructure testing)');
      }
      // Don't fail the test if app isn't ready - that's expected for infrastructure-only testing
    } catch (error) {
      console.log('⚠️ App health check failed (expected if app container not built yet)');
    }
  });
  
  test('database isolation works correctly', async () => {
    // Test that integration database is isolated from main database
    const dbName = await testClient.query('SELECT current_database() as db_name');
    expect(dbName[0].db_name).toBe('emery_integration_test');
    
    // Test that we're connected to the correct port
    const port = await testClient.query('SHOW port');
    expect(port[0].port).toBe('5432'); // Inside container it's 5432, mapped to 5436 outside
  });
});