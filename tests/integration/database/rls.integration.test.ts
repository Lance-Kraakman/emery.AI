import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { testClient } from '../shared/integration-helpers';
import { TestCase } from '../shared/test-case';
import { organizations, users, agents, ragIndexes, ragDocuments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

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
    // Use the existing organizations from seed data (IDs 1 and 2)
    // The organizations RLS policy prevents creating new orgs without existing context
    testOrgs.org1 = 1; // From seed data: 'Test Organization 1'
    testOrgs.org2 = 2; // From seed data: 'Test Organization 2'

    // Create test users with proper RLS context
    const user1Id = '550e8400-e29b-41d4-a716-446655440101'; // Unique UUID for RLS test
    const user2Id = '550e8400-e29b-41d4-a716-446655440102'; // Unique UUID for RLS test
    
    await testClient.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
      await tx.execute(sql`
        INSERT INTO users (id, name, email, current_organization_id, created_at) 
        VALUES (${user1Id}, 'RLS User 1', 'rls-user-1@test.com', ${testOrgs.org1}, NOW())
      `);
    });
    testUsers.user1 = user1Id;

    await testClient.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
      await tx.execute(sql`
        INSERT INTO users (id, name, email, current_organization_id, created_at) 
        VALUES (${user2Id}, 'RLS User 2', 'rls-user-2@test.com', ${testOrgs.org2}, NOW())
      `);
    });
    testUsers.user2 = user2Id;

    // Create test agents with proper RLS context
    testAgents.agent1 = await testClient.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
      const result = await tx.execute(sql`
        INSERT INTO agents (name, owner_id, organization_id, status, api_key, created_at) 
        VALUES ('RLS Agent 1', ${testUsers.user1}, ${testOrgs.org1}, 'active', 'rls_test_key_1', NOW())
        RETURNING id
      `);
      return (result[0] as any).id as number;
    });

    testAgents.agent2 = await testClient.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
      const result = await tx.execute(sql`
        INSERT INTO agents (name, owner_id, organization_id, status, api_key, created_at) 
        VALUES ('RLS Agent 2', ${testUsers.user2}, ${testOrgs.org2}, 'active', 'rls_test_key_2', NOW())
        RETURNING id
      `);
      return (result[0] as any).id as number;
    });
  });

  beforeEach(async () => {
    // Clear RLS context before each test
    await testClient.clearRLSContext();
  });

  describe('Organization-Level Data Isolation', () => {
    test('should show organizations only to their members', async () => {
      // Test org 1 isolation - set context and query within same transaction
      const org1Result = await testClient.db.transaction(async (tx) => {
        // Set context within transaction
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        // Query within same transaction 
        return await tx.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .orderBy(organizations.id);
      });
      expect(org1Result).toHaveLength(1);
      expect(org1Result[0].id).toBe(testOrgs.org1);
      expect(org1Result[0].name).toBe('Test Organization 1'); // From seed data

      // Test org 2 isolation - set context and query within same transaction
      const org2Result = await testClient.db.transaction(async (tx) => {
        // Set context within transaction
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
        
        // Query within same transaction
        return await tx.select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .orderBy(organizations.id);
      });
      expect(org2Result).toHaveLength(1);
      expect(org2Result[0].id).toBe(testOrgs.org2);
      expect(org2Result[0].name).toBe('Test Organization 2'); // From seed data
    });

    test('should isolate users by organization', async () => {
      // Test org 1 user isolation
      const org1Users = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        return await tx.select({ id: users.id, name: users.name })
          .from(users)
          .where(sql`${users.name} LIKE 'RLS User %'`)
          .orderBy(users.name);
      });
      expect(org1Users).toHaveLength(1);
      expect(org1Users[0].id).toBe(testUsers.user1);
      expect(org1Users[0].name).toBe('RLS User 1');

      // Test org 2 user isolation
      const org2Users = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
        
        return await tx.select({ id: users.id, name: users.name })
          .from(users)
          .where(sql`${users.name} LIKE 'RLS User %'`)
          .orderBy(users.name);
      });
      expect(org2Users).toHaveLength(1);
      expect(org2Users[0].id).toBe(testUsers.user2);
      expect(org2Users[0].name).toBe('RLS User 2');
    });

    test('should isolate agents by organization', async () => {
      // Test org 1 agent isolation
      const org1Agents = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        return await tx.select({ 
          id: agents.id, 
          name: agents.name, 
          organizationId: agents.organizationId 
        })
          .from(agents)
          .where(sql`${agents.name} LIKE 'RLS Agent %'`)
          .orderBy(agents.id);
      });
      expect(org1Agents).toHaveLength(1);
      expect(org1Agents[0].id).toBe(testAgents.agent1);
      expect(org1Agents[0].name).toBe('RLS Agent 1');
      expect(org1Agents[0].organizationId).toBe(testOrgs.org1);

      // Test org 2 agent isolation
      const org2Agents = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
        
        return await tx.select({ 
          id: agents.id, 
          name: agents.name, 
          organizationId: agents.organizationId 
        })
          .from(agents)
          .where(sql`${agents.name} LIKE 'RLS Agent %'`)
          .orderBy(agents.id);
      });
      expect(org2Agents).toHaveLength(1);
      expect(org2Agents[0].id).toBe(testAgents.agent2);
      expect(org2Agents[0].name).toBe('RLS Agent 2');
      expect(org2Agents[0].organizationId).toBe(testOrgs.org2);
    });

  });

  describe('RAG Index Isolation', () => {
    test('should isolate RAG indexes by organization', async () => {
      // Create RAG index for org 1 using transaction with proper RLS context
      const ragIndexId = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        const result = await tx.execute(sql`
          INSERT INTO rag_indexes (name, organization_id, domain_types, domain_filters, created_at)
          VALUES ('RLS RAG Index 1', ${testOrgs.org1}, ${JSON.stringify(['table'])}, ${JSON.stringify({domain_id: '1'})}, NOW())
          RETURNING id
        `);
        return (result[0] as any).id as number;
      });
      expect(ragIndexId).toBeDefined();

      // Verify index is visible in org 1 context
      const org1Count = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        const result = await tx.execute(sql`
          SELECT COUNT(*) as count FROM rag_indexes 
          WHERE organization_id = ${testOrgs.org1}
        `);
        return parseInt((result[0] as any).count as string);
      });
      expect(org1Count).toBeGreaterThan(0);

      // Verify index is NOT visible from org 2 context (should return 0)
      const org2Count = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
        
        const result = await tx.execute(sql`
          SELECT COUNT(*) as count FROM rag_indexes 
          WHERE organization_id = ${testOrgs.org1}
        `);
        return parseInt((result[0] as any).count as string);
      });
      expect(org2Count).toBe(0);
    });
  });

  describe('RLS Helper Functions', () => {
    test('should return current organization ID from RLS context', async () => {
      const orgId = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        const result = await tx.execute(sql`SELECT get_current_organization_id() as org_id`);
        return result[0]?.org_id || null;
      });
      
      expect(orgId).toBe(testOrgs.org1);
    });

    test('should handle missing organization context gracefully', async () => {
      const orgId = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', '', true)`);
        
        const result = await tx.execute(sql`SELECT get_current_organization_id() as org_id`);
        return result[0]?.org_id || null;
      });
      
      expect(orgId).toBeNull();
    });
  });

  describe('Vector Search Isolation', () => {
    test('should isolate vector search by organization', async () => {
      // Create a test RAG index with transaction and proper RLS context
      const ragIndexId = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        const result = await tx.execute(sql`
          INSERT INTO rag_indexes (name, organization_id, domain_types, domain_filters, created_at)
          VALUES ('Vector Test Index', ${testOrgs.org1}, ${JSON.stringify(['table'])}, ${JSON.stringify({domain_id: '1'})}, NOW())
          RETURNING id
        `);
        return (result[0] as any).id as number;
      });
      
      // Insert a test document with proper RLS context
      await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        await tx.execute(sql`
          INSERT INTO rag_documents (rag_index_id, organization_id, domain_type, source_id, source_name, title, content, content_hash, indexed_at)
          VALUES (${ragIndexId}, ${testOrgs.org1}, 'table', '1', 'Test Table', 'Test Document', 'Test document content', 'hash123', NOW())
        `);
      });
      
      // Verify the document is accessible within org 1 context
      const docCount = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org1.toString()}, true)`);
        
        const result = await tx.execute(sql`
          SELECT COUNT(*) as count FROM rag_documents 
          WHERE rag_index_id = ${ragIndexId}
        `);
        return parseInt((result[0] as any).count as string);
      });
      expect(docCount).toBe(1);
      
      // Verify isolation from org 2 context (should return 0)
      const isolatedDocCount = await testClient.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgs.org2.toString()}, true)`);
        
        const result = await tx.execute(sql`
          SELECT COUNT(*) as count FROM rag_documents 
          WHERE rag_index_id = ${ragIndexId}
        `);
        return parseInt((result[0] as any).count as string);
      });
      expect(isolatedDocCount).toBe(0);
    });
  });
});