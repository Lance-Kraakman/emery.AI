import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { getAgentApplicationService, getAgentRepository } from '@/ddd/application/di/container';
import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { CreateAgentCommand } from '@/ddd/application/services/agents/agent-application-service';
import { testDb, initializeTestDI, seedBasicTestData } from '../shared/test-helpers';
import type { TestCase } from '../../shared/types';

// AIDEV-NOTE: Clean Agent Application Service integration tests using TestCase pattern
// Tests core agent operations with minimal, maintainable test cases

interface CreateAgentInput {
  name: string;
  ownerId: string;
  organizationId: number;
  roleId: number;
}

interface CreateAgentOutput {
  success: boolean;
  error?: string;
}

const createAgentTestCases: TestCase<CreateAgentInput, CreateAgentOutput>[] = [
  {
    name: 'should create agent with valid input',
    input: {
      name: 'Test Data Collector',
      ownerId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: 1,
      roleId: 1
    },
    expected: { success: true }
  },
  {
    name: 'should reject empty agent name',
    input: {
      name: '',
      ownerId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: 1,
      roleId: 1
    },
    expected: { success: false, error: 'Agent name is required' }
  },
  {
    name: 'should reject invalid organization',
    input: {
      name: 'Test Agent',
      ownerId: '550e8400-e29b-41d4-a716-446655440001',
      organizationId: 999,
      roleId: 1
    },
    expected: { success: false }
  }
];

describe('Agent Application Service Integration Tests', () => {
  
  beforeAll(async () => {
    initializeTestDI();
    await seedBasicTestData();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  afterEach(async () => {
    await testDb.cleanTestData();
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
          roleId: testCase.input.roleId,
          agentType: 'data-collector'
        };

        const result = await agentApplicationService.createAgent(command);
        
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
        ownerId: UserId.fromString('550e8400-e29b-41d4-a716-446655440001'),
        organizationId: OrganizationId.fromNumber(1),
        roleId: 1,
        agentType: 'process-analyst'
      };

      const createResult = await agentApplicationService.createAgent(command);
      expect(createResult.success).toBe(true);

      // Then retrieve agents for organization using repository directly
      const agentRepository = getAgentRepository();
      const organizationId = OrganizationId.fromNumber(1);
      const agents = await agentRepository.findByOrganization(organizationId);
      
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      
      const testAgent = agents.find(agent => agent.name === 'Retrieval Test Agent');
      expect(testAgent).toBeDefined();
      expect(testAgent?.organizationId.value).toBe(1);
    });
  });

  describe('Organization Isolation', () => {
    
    test('should enforce organization boundaries', async () => {
      const agentApplicationService = getAgentApplicationService();
      
      // Create agents in different organizations
      const org1Command: CreateAgentCommand = {
        name: 'Org 1 Agent',
        description: 'Agent in organization 1',
        ownerId: UserId.fromString('550e8400-e29b-41d4-a716-446655440001'),
        organizationId: OrganizationId.fromNumber(1),
        roleId: 1,
        agentType: 'data-collector'
      };

      const org2Command: CreateAgentCommand = {
        name: 'Org 2 Agent',
        description: 'Agent in organization 2',
        ownerId: UserId.fromString('550e8400-e29b-41d4-a716-446655440002'),
        organizationId: OrganizationId.fromNumber(2),
        roleId: 2,
        agentType: 'kpi-calculator'
      };

      await agentApplicationService.createAgent(org1Command);
      await agentApplicationService.createAgent(org2Command);

      // Verify isolation using repository directly
      const agentRepository = getAgentRepository();
      const org1Agents = await agentRepository.findByOrganization(OrganizationId.fromNumber(1));
      const org2Agents = await agentRepository.findByOrganization(OrganizationId.fromNumber(2));
      
      expect(org1Agents.length).toBe(1);
      expect(org2Agents.length).toBe(1);
      expect(org1Agents[0].name).toBe('Org 1 Agent');
      expect(org2Agents[0].name).toBe('Org 2 Agent');
    });
  });
});