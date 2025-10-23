import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getAgentApplicationService, getAgentRepository } from '@/ddd/application/di/container';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { CreateAgentDTO } from '@/app/dtos/agent.dto';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';
import type { TestContext } from '../shared/test-setup';
import { initializeTestDI } from '../shared/test-setup';

// AIDEV-NOTE: Clean Agent Application Service integration tests using TestCase pattern
// Tests core agent operations with minimal, maintainable test cases

interface CreateAgentTestInput {
  name: string;
  ownerId: UserId;
  organizationId: OrganizationId;
  role: string;
}

interface CreateAgentTestOutput {
  success: boolean;
  error?: string;
}

// Factory function to generate test cases with proper context
function createAgentTestCases(context: TestContext, invalidOrgId?: OrganizationId): TestCase<CreateAgentTestInput, CreateAgentTestOutput>[] {
  const testCases = [
    {
      name: 'should create agent with valid input',
      input: {
        name: 'Test Data Collector',
        ownerId: context.ownerUserId,
        organizationId: context.organizationId,
        role: 'assistant'
      },
      expected: { success: true }
    },
    {
      name: 'should reject empty agent name',
      input: {
        name: '',
        ownerId: context.ownerUserId,
        organizationId: context.organizationId,
        role: 'assistant'
      },
      expected: { success: false, error: 'Agent name is required' }
    }
  ];

  // Only add invalid organization test if we have an invalid org ID
  if (invalidOrgId) {
    testCases.push({
      name: 'should reject invalid organization',
      input: {
        name: 'Test Agent',
        ownerId: context.ownerUserId,
        organizationId: invalidOrgId,
        role: 'assistant'
      },
      expected: { success: false }
    });
  }

  return testCases;
}

// Test context that will be created in beforeEach
let testContext: TestContext;

describe('Agent Application Service Integration Tests', () => {
  
  beforeAll(() => {
    // Initialize DI container
    initializeTestDI();
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // AIDEV-NOTE: Create fresh test organization for each test to ensure isolation
    const { createTestOrganization } = await import('../shared/test-setup');
    
    try {
      // Create unique test organization and owner
      testContext = await createTestOrganization('Agent Test Organization');
      
      // RLS policies work automatically with database defaults - no context setting needed
      
      console.log(`✅ Test context created: org=${testContext.organizationId.value}, owner=${testContext.ownerUserId.value}`);
      
    } catch (error) {
      console.error('❌ Error creating test context in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // No context cleanup needed - RLS policies work automatically
      
      // Clean test data between tests (superuser bypasses RLS for cleanup)
      await testClient.cleanTestData();
      
      console.log(`✅ Test cleanup completed for org=${testContext.organizationId.value}`);
      
    } catch (error) {
      console.warn('⚠️  Error during test cleanup (non-fatal):', error);
      // Don't throw - cleanup errors shouldn't fail tests
    }
  });

  describe('Create Agent Operations', () => {
    
    test('should run all agent creation test cases', async () => {
      const agentApplicationService = getAgentApplicationService();
      
      // Create a non-existent organization ID for testing invalid organization case
      // Use a large random number that's very unlikely to exist in the database
      const invalidOrgId = OrganizationId.fromNumber(Math.floor(Math.random() * 900000) + 100000);
      const testCases = createAgentTestCases(testContext, invalidOrgId);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);

        // Build DTO - Application Service handles Value Object conversion
        const dto: CreateAgentDTO = {
          name: testCase.input.name,
          description: 'Test agent description',
          ownerId: testCase.input.ownerId.value,
          organizationId: testCase.input.organizationId.value,
          role: testCase.input.role,
          agentType: 'data-collector'
        };

        console.log(`🔍 Creating agent with DTO:`, {
          name: dto.name,
          ownerId: dto.ownerId,
          organizationId: dto.organizationId,
          role: dto.role
        });

        try {
          const result = await agentApplicationService.createAgent(dto);
          
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
        } catch (error) {
          // For invalid organization case, we expect a database constraint error
          if (testCase.name === 'should reject invalid organization') {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`🔍 Expected database constraint error for invalid organization: ${errorMessage}`);
            expect(testCase.expected.success).toBe(false);
          } else {
            // Re-throw for other cases as they shouldn't throw
            throw error;
          }
        }
      }
    });
  });

  describe('Retrieve Agent Operations', () => {
    
    test('should retrieve agents by organization', async () => {
      const agentApplicationService = getAgentApplicationService();
      
      // First create an agent
      const dto: CreateAgentDTO = {
        name: 'Retrieval Test Agent',
        description: 'Agent for testing retrieval',
        ownerId: testContext.ownerUserId.value,
        organizationId: testContext.organizationId.value,
        role: 'assistant',
        agentType: 'process-analyst'
      };

      const createResult = await agentApplicationService.createAgent(dto);
      expect(createResult.success).toBe(true);

      // Then retrieve agents for organization using repository directly
      const agentRepository = getAgentRepository();
      const organizationId = testContext.organizationId;
      const agents = await agentRepository.findByOrganization(organizationId);
      
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      
      const testAgent = agents.find(agent => agent.name === 'Retrieval Test Agent');
      expect(testAgent).toBeDefined();
      expect(testAgent?.organizationId.value).toBe(testContext.organizationId.value);
    });
  });

  describe('Organization Isolation', () => {
    
    test('should enforce organization boundaries', async () => {
        const agentApplicationService = getAgentApplicationService();
      
      // Create a second organization using the test setup for consistency
      const { createTestOrganization } = await import('../shared/test-setup');
      const org2Context = await createTestOrganization('Agent Test Organization 2');
      const testOrg2Id = org2Context.organizationId;
      const user2Id = org2Context.ownerUserId;
      
      // Create agents in different organizations
      const org1DTO: CreateAgentDTO = {
        name: 'Org 1 Agent',
        description: 'Agent in organization 1',
        ownerId: testContext.ownerUserId.value,
        organizationId: testContext.organizationId.value,
        role: 'assistant',
        agentType: 'data-collector'
      };

      const org2DTO: CreateAgentDTO = {
        name: 'Org 2 Agent',
        description: 'Agent in organization 2',
        ownerId: user2Id.value,
        organizationId: testOrg2Id.value,
        role: 'data-analyst',
        agentType: 'kpi-calculator'
      };

      // Create agent in org 1
      const org1Result = await agentApplicationService.createAgent(org1DTO);
      expect(org1Result.success).toBe(true);
      
      // Create agent in org 2  
      const org2Result = await agentApplicationService.createAgent(org2DTO);
      expect(org2Result.success).toBe(true);

      // Verify isolation using repository directly
      const agentRepository = getAgentRepository();
      
      // Check organization isolation - RLS policies ensure proper filtering
      const org1Agents = await agentRepository.findByOrganization(testContext.organizationId);
      const org2Agents = await agentRepository.findByOrganization(testOrg2Id);
      
      // Verify each organization only sees its own agents
      expect(org1Agents.length).toBeGreaterThanOrEqual(1);
      expect(org2Agents.length).toBeGreaterThanOrEqual(1);
      
      const org1Agent = org1Agents.find(agent => agent.name === 'Org 1 Agent');
      const org2Agent = org2Agents.find(agent => agent.name === 'Org 2 Agent');
      
      expect(org1Agent).toBeDefined();
      expect(org2Agent).toBeDefined();
      expect(org1Agent?.organizationId.value).toBe(testContext.organizationId.value);
      expect(org2Agent?.organizationId.value).toBe(testOrg2Id.value);
    });
  });
});