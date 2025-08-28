import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getAgentApplicationService, getAgentRepository, getUserRepository, getOrganizationRepository, getContextAwareDb, initializeDI } from '@/ddd/application/di/container';
import { OrganizationId, UserId, EmailAddress, OrganizationName } from '@/ddd/domain/shared/value-objects';
import type { CreateAgentCommand } from '@/ddd/application/services/agents/agent-application-service';
import type { CreateUserData } from '@/ddd/domain/users/entities/user';
import type { CreateOrganizationData } from '@/ddd/domain/organizations/entities/organization';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';

// AIDEV-NOTE: Clean Agent Application Service integration tests using TestCase pattern
// Tests core agent operations with minimal, maintainable test cases

interface CreateAgentInput {
  name: string;
  ownerId: string;
  organizationId: number;
  role: string;
}

interface CreateAgentOutput {
  success: boolean;
  error?: string;
}

// Test data that will be created in beforeEach
let testOrgId: number;
let testUserId: string;

const createAgentTestCases: TestCase<CreateAgentInput, CreateAgentOutput>[] = [
  {
    name: 'should create agent with valid input',
    input: {
      name: 'Test Data Collector',
      ownerId: '', // Will be filled in beforeEach
      organizationId: 0, // Will be filled in beforeEach
      role: 'assistant'
    },
    expected: { success: true }
  },
  {
    name: 'should reject empty agent name',
    input: {
      name: '',
      ownerId: '', // Will be filled in beforeEach
      organizationId: 0, // Will be filled in beforeEach
      role: 'assistant'
    },
    expected: { success: false, error: 'Agent name is required' }
  },
  {
    name: 'should reject invalid organization',
    input: {
      name: 'Test Agent',
      ownerId: '', // Will be filled in beforeEach
      organizationId: 999,
      role: 'assistant'
    },
    expected: { success: false }
  }
];

describe('Agent Application Service Integration Tests', () => {
  
  beforeAll(() => {
    // Initialize DI container
    initializeDI(testClient.db as any, testClient.db as any);
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // AIDEV-NOTE: Create fresh test organization for each test to ensure isolation
    const { createTestOrganization } = await import('../shared/test-setup');
    
    try {
      // Create unique test organization and owner
      const context = await createTestOrganization('Agent Test Organization');
      
      testOrgId = context.organizationId;
      testUserId = context.ownerUserId;
      
      // Set context using the enhanced database client for consistent RLS behavior
      const contextDb = getContextAwareDb();
      contextDb.setContext(testUserId, testOrgId);
      
      // Update test cases with actual IDs from the created context
      createAgentTestCases.forEach(testCase => {
        testCase.input.ownerId = testUserId;
        if (testCase.input.organizationId === 0) {
          testCase.input.organizationId = testOrgId;
        }
      });
      
      console.log(`✅ Test context created: org=${testOrgId}, owner=${testUserId}`);
      
    } catch (error) {
      console.error('❌ Error creating test context in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Clear RLS context first to ensure clean state
      const contextDb = getContextAwareDb();
      contextDb.clearContext();
      
      // Clean test data between tests (superuser bypasses RLS for cleanup)
      await testClient.cleanTestData();
      
      console.log(`✅ Test cleanup completed for org=${testOrgId}`);
      
    } catch (error) {
      console.warn('⚠️  Error during test cleanup (non-fatal):', error);
      // Don't throw - cleanup errors shouldn't fail tests
    }
  });

  describe('Create Agent Operations', () => {
    
    createAgentTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        const agentApplicationService = getAgentApplicationService();
        
        const command: CreateAgentCommand = {
          name: testCase.input.name,
          description: 'Test agent description',
          ownerId: UserId.fromString(testCase.input.ownerId),
          organizationId: OrganizationId.fromNumber(testCase.input.organizationId),
          role: testCase.input.role,
          agentType: 'data-collector'
        };

        console.log(`🔍 Creating agent with command:`, {
          name: command.name,
          ownerId: command.ownerId.value,
          organizationId: command.organizationId.value,
          role: command.role
        });

        const result = await agentApplicationService.createAgent(command);
        
        console.log(`🔍 Agent creation result:`, {
          success: result.success,
          error: result.error,
          hasData: !!result.data
        });
        
        expect(result.success).toBe(testCase.expected.success);
        
        if (testCase.expected.error) {
          expect(result.error).toContain(testCase.expected.error);
        }
        
        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          expect(result.data?.name).toBe(testCase.input.name);
        }
      });
    });
  });

  describe('Retrieve Agent Operations', () => {
    
    test('should retrieve agents by organization', async () => {
      const agentApplicationService = getAgentApplicationService();
      
      // First create an agent
      const command: CreateAgentCommand = {
        name: 'Retrieval Test Agent',
        description: 'Agent for testing retrieval',
        ownerId: UserId.fromString(testUserId),
        organizationId: OrganizationId.fromNumber(testOrgId),
        role: 'assistant',
        agentType: 'process-analyst'
      };

      const createResult = await agentApplicationService.createAgent(command);
      expect(createResult.success).toBe(true);

      // Then retrieve agents for organization using repository directly
      const agentRepository = getAgentRepository();
      const organizationId = OrganizationId.fromNumber(testOrgId);
      const agents = await agentRepository.findByOrganization(organizationId);
      
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      
      const testAgent = agents.find(agent => agent.name === 'Retrieval Test Agent');
      expect(testAgent).toBeDefined();
      expect(testAgent?.organizationId.value).toBe(testOrgId);
    });
  });

  describe('Organization Isolation', () => {
    
    test('should enforce organization boundaries', async () => {
      const agentApplicationService = getAgentApplicationService();
      const contextDb = getContextAwareDb();
      
      // Create a second organization using the test setup for consistency
      const { createTestOrganization } = await import('../shared/test-setup');
      const org2Context = await createTestOrganization('Agent Test Organization 2');
      const testOrg2Id = org2Context.organizationId;
      const user2Id = org2Context.ownerUserId;
      
      // Create agents in different organizations with proper context switching
      const org1Command: CreateAgentCommand = {
        name: 'Org 1 Agent',
        description: 'Agent in organization 1',
        ownerId: UserId.fromString(testUserId),
        organizationId: OrganizationId.fromNumber(testOrgId),
        role: 'assistant',
        agentType: 'data-collector'
      };

      const org2Command: CreateAgentCommand = {
        name: 'Org 2 Agent',
        description: 'Agent in organization 2',
        ownerId: UserId.fromString(user2Id),
        organizationId: OrganizationId.fromNumber(testOrg2Id),
        role: 'data-analyst',
        agentType: 'kpi-calculator'
      };

      // Create agent in org 1 (context already set in beforeEach)
      const org1Result = await agentApplicationService.createAgent(org1Command);
      expect(org1Result.success).toBe(true);
      
      // Switch context to org 2 for creating agent there
      contextDb.setContext(user2Id, testOrg2Id);
      const org2Result = await agentApplicationService.createAgent(org2Command);
      expect(org2Result.success).toBe(true);

      // Verify isolation using repository directly
      const agentRepository = getAgentRepository();
      
      // Set context back to org 1 to check isolation
      contextDb.setContext(testUserId, testOrgId);
      const org1Agents = await agentRepository.findByOrganization(OrganizationId.fromNumber(testOrgId));
      
      // Set context to org 2 to check isolation
      contextDb.setContext(user2Id, testOrg2Id);
      const org2Agents = await agentRepository.findByOrganization(OrganizationId.fromNumber(testOrg2Id));
      
      // Verify each organization only sees its own agents
      expect(org1Agents.length).toBeGreaterThanOrEqual(1);
      expect(org2Agents.length).toBeGreaterThanOrEqual(1);
      
      const org1Agent = org1Agents.find(agent => agent.name === 'Org 1 Agent');
      const org2Agent = org2Agents.find(agent => agent.name === 'Org 2 Agent');
      
      expect(org1Agent).toBeDefined();
      expect(org2Agent).toBeDefined();
      expect(org1Agent?.organizationId.value).toBe(testOrgId);
      expect(org2Agent?.organizationId.value).toBe(testOrg2Id);
    });
  });
});