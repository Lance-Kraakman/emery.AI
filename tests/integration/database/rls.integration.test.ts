import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { testClient } from '../shared/integration-helpers';
import { TestCase } from '../shared/test-case';

// AIDEV-NOTE: Integration tests for Row Level Security (RLS) multi-tenant isolation
// Ports existing Python-based RLS tests to unified Vitest system with TestCase pattern

interface RLSTestInput {
  organizationId: number;
  userId?: string;
  action: 'create' | 'read' | 'update' | 'delete';
  resourceType: 'organization' | 'user' | 'agent' | 'task' | 'rag_index';
  resourceData?: Record<string, any>;
}

interface RLSTestOutput {
  allowed: boolean;
  rowCount?: number;
  visibleItems?: any[];
  error?: string;
}

// Test data setup
let testOrgs: { org1: number; org2: number } = { org1: 0, org2: 0 };
let testUsers: { user1: string; user2: string } = { user1: '', user2: '' };
let testAgents: { agent1: number; agent2: number } = { agent1: 0, agent2: 0 };

describe('RLS Multi-Tenant Isolation Integration Tests', () => {
  
  beforeAll(async () => {
    // Create test organizations 
    const org1Result = await testClient.query(`
      INSERT INTO organizations (name, slug, created_at) 
      VALUES ('RLS Test Org 1', 'rls-test-org-1', NOW())
      RETURNING id
    `);
    testOrgs.org1 = org1Result[0].id;

    const org2Result = await testClient.query(`
      INSERT INTO organizations (name, slug, created_at) 
      VALUES ('RLS Test Org 2', 'rls-test-org-2', NOW())
      RETURNING id
    `);
    testOrgs.org2 = org2Result[0].id;

    // Create test users  
    const user1Id = 'rls-user-1-' + Math.random().toString(36).substring(7);
    const user2Id = 'rls-user-2-' + Math.random().toString(36).substring(7);
    
    await testClient.query(`
      INSERT INTO users (id, name, email, organization_id, created_at, updated_at) 
      VALUES ($1, 'RLS User 1', $2, $3, NOW(), NOW())
    `, [user1Id, `${user1Id}@test.com`, testOrgs.org1]);
    testUsers.user1 = user1Id;

    await testClient.query(`
      INSERT INTO users (id, name, email, organization_id, created_at, updated_at) 
      VALUES ($1, 'RLS User 2', $2, $3, NOW(), NOW())
    `, [user2Id, `${user2Id}@test.com`, testOrgs.org2]);
    testUsers.user2 = user2Id;

    // Create test agents
    const agent1Result = await testClient.query(`
      INSERT INTO agents (name, owner_id, organization_id, status, api_key, created_at, updated_at) 
      VALUES ('RLS Agent 1', $1, $2, 'active', 'key_' || md5(random()::text), NOW(), NOW())
      RETURNING id
    `, [testUsers.user1, testOrgs.org1]);
    testAgents.agent1 = agent1Result[0].id;

    const agent2Result = await testClient.query(`
      INSERT INTO agents (name, owner_id, organization_id, status, api_key, created_at, updated_at) 
      VALUES ('RLS Agent 2', $1, $2, 'active', 'key_' || md5(random()::text), NOW(), NOW())
      RETURNING id
    `, [testUsers.user2, testOrgs.org2]);
    testAgents.agent2 = agent2Result[0].id;
  });

  beforeEach(async () => {
    // Clear RLS context before each test
    await testClient.query("SELECT set_config('app.current_organization_id', '', true)");
    await testClient.query("SELECT set_config('app.current_user_id', '', true)");
  });

  describe('Organization-Level Data Isolation', () => {
    test('should show organizations only to their members', async () => {
      // Set context for org 1
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org1.toString()]);
      
      const org1Result = await testClient.query("SELECT id, name FROM organizations ORDER BY id");
      expect(org1Result).toHaveLength(1);
      expect(org1Result[0].id).toBe(testOrgs.org1);
      expect(org1Result[0].name).toBe('RLS Test Org 1');

      // Set context for org 2
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org2.toString()]);
      
      const org2Result = await testClient.query("SELECT id, name FROM organizations ORDER BY id");
      expect(org2Result).toHaveLength(1);
      expect(org2Result[0].id).toBe(testOrgs.org2);
      expect(org2Result[0].name).toBe('RLS Test Org 2');
    });

    test('should isolate users by organization', async () => {
      // Set context for org 1  
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org1.toString()]);
      
      const org1Users = await testClient.query("SELECT id, name FROM users WHERE name LIKE 'RLS User %' ORDER BY name");
      expect(org1Users).toHaveLength(1);
      expect(org1Users[0].id).toBe(testUsers.user1);
      expect(org1Users[0].name).toBe('RLS User 1');

      // Set context for org 2
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org2.toString()]);
      
      const org2Users = await testClient.query("SELECT id, name FROM users WHERE name LIKE 'RLS User %' ORDER BY name");
      expect(org2Users).toHaveLength(1);
      expect(org2Users[0].id).toBe(testUsers.user2);
      expect(org2Users[0].name).toBe('RLS User 2');
    });

    test('should isolate agents by organization', async () => {
      // Set context for org 1
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org1.toString()]);
      
      const org1Agents = await testClient.query("SELECT id, name, organization_id FROM agents WHERE name LIKE 'RLS Agent %' ORDER BY id");
      expect(org1Agents).toHaveLength(1);
      expect(org1Agents[0].id).toBe(testAgents.agent1);
      expect(org1Agents[0].name).toBe('RLS Agent 1');
      expect(org1Agents[0].organization_id).toBe(testOrgs.org1);

      // Set context for org 2
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org2.toString()]);
      
      const org2Agents = await testClient.query("SELECT id, name, organization_id FROM agents WHERE name LIKE 'RLS Agent %' ORDER BY id");
      expect(org2Agents).toHaveLength(1);
      expect(org2Agents[0].id).toBe(testAgents.agent2);
      expect(org2Agents[0].name).toBe('RLS Agent 2');
      expect(org2Agents[0].organization_id).toBe(testOrgs.org2);
    });

  });

  describe('RAG Index Isolation', () => {
    test('should isolate RAG indexes by organization', async () => {
      // Create RAG index for org 1
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org1.toString()]);
      
      const ragResult = await testClient.query(`
        INSERT INTO rag_indexes (name, organization_id, domain_type, domain_id, created_at, updated_at)
        VALUES ('RLS RAG Index 1', $1, 'table', '1', NOW(), NOW())
        RETURNING id
      `, [testOrgs.org1]);
      
      const ragIndexId = ragResult[0].id;
      expect(ragIndexId).toBeDefined();

      // Verify index is visible in org 1
      const org1Indexes = await testClient.query(`
        SELECT COUNT(*) as count FROM rag_indexes 
        WHERE organization_id = $1
      `, [testOrgs.org1]);
      expect(parseInt(org1Indexes[0].count)).toBeGreaterThan(0);

      // Switch to org 2 context and verify isolation
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org2.toString()]);
      
      const org2Indexes = await testClient.query(`
        SELECT COUNT(*) as count FROM rag_indexes 
        WHERE organization_id = $1
      `, [testOrgs.org1]);
      expect(parseInt(org2Indexes[0].count)).toBe(0);
    });
  });

  describe('RLS Helper Functions', () => {
    test('should return current organization ID from RLS context', async () => {
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org1.toString()]);
      
      const result = await testClient.query('SELECT get_current_organization_id() as org_id');
      expect(result[0].org_id).toBe(testOrgs.org1);
    });

    test('should handle missing organization context gracefully', async () => {
      // Clear organization context
      await testClient.query("SELECT set_config('app.current_organization_id', '', true)");
      
      const result = await testClient.query('SELECT get_current_organization_id() as org_id');
      expect(result[0].org_id).toBeNull();
    });
  });

  describe('Vector Search Isolation', () => {
    test('should isolate vector search by organization', async () => {
      // Set context for org 1
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org1.toString()]);
      
      // Create a test RAG index
      const ragResult = await testClient.query(`
        INSERT INTO rag_indexes (name, organization_id, domain_type, domain_id, created_at, updated_at)
        VALUES ('Vector Test Index', $1, 'table', '1', NOW(), NOW())
        RETURNING id
      `, [testOrgs.org1]);
      
      const ragIndexId = ragResult[0].id;
      
      // Insert a test document (simplified)
      await testClient.query(`
        INSERT INTO rag_documents (rag_index_id, organization_id, content, created_at, updated_at)
        VALUES ($1, $2, 'Test document content', NOW(), NOW())
      `, [ragIndexId, testOrgs.org1]);
      
      // Verify the document is accessible within the same organization
      const docs = await testClient.query(`
        SELECT COUNT(*) as count FROM rag_documents 
        WHERE rag_index_id = $1
      `, [ragIndexId]);
      
      expect(parseInt(docs[0].count)).toBe(1);
      
      // Switch organization context and verify isolation
      await testClient.query("SELECT set_config('app.current_organization_id', $1, true)", [testOrgs.org2.toString()]);
      
      const isolatedDocs = await testClient.query(`
        SELECT COUNT(*) as count FROM rag_documents 
        WHERE rag_index_id = $1
      `, [ragIndexId]);
      
      expect(parseInt(isolatedDocs[0].count)).toBe(0);
    });
  });
});