// AIDEV-NOTE: Unit tests for AgentApplicationService
// Tests business logic, validation, and repository interactions without infrastructure dependencies

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import type { 
  CreateAgentCommand, 
  UpdateAgentCommand, 
  AgentFilters,
  AgentApplicationResult 
} from '@/ddd/application/services/agents/agent-application-service';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { AgentId, OrganizationId, UserId, TeamId, AgentStatus } from '@/ddd/domain/shared/value-objects';
import { MockRepositoryFactory, MockEntityFactory } from '../shared/mock-factories';
import { TestHelpers } from '../shared/test-helpers';
import type { TestCase } from '../shared/test-case';

describe('AgentApplicationService', () => {
  let service: AgentApplicationService;
  let mockAgentRepository: ReturnType<typeof MockRepositoryFactory.createAgentRepository>;
  let mockRoleRepository: ReturnType<typeof MockRepositoryFactory.createRoleRepository>;
  let mockTeamRepository: ReturnType<typeof MockRepositoryFactory.createTeamRepository>;

  beforeEach(() => {
    TestHelpers.setupConsoleMocks();
    
    mockAgentRepository = MockRepositoryFactory.createAgentRepository();
    mockRoleRepository = MockRepositoryFactory.createRoleRepository();
    mockTeamRepository = MockRepositoryFactory.createTeamRepository();
    
    service = new AgentApplicationService(
      mockAgentRepository,
      mockRoleRepository,
      mockTeamRepository
    );
    
    vi.clearAllMocks();
  });

  describe('createAgent', () => {
    const validCommand: CreateAgentCommand = {
      name: 'Test Agent',
      role: 'assistant',
      description: 'Test description',
      persona: 'Helpful assistant',
      ownerId: UserId.fromString('550e8400-e29b-41d4-a716-446655440001'),
      organizationId: OrganizationId.fromNumber(1),
      roleId: 1,
      agentType: 'data-collector',
      tools: [],
      servers: [],
      capabilities: [],
      status: 'active'
    };

    const testCases: TestCase<CreateAgentCommand, AgentApplicationResult<Agent>>[] = [
      {
        name: 'should create agent with valid data',
        input: validCommand,
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Test Agent',
            role: 'assistant',
            description: 'Test description'
          })
        }
      },
      {
        name: 'should fail with empty name',
        input: { ...validCommand, name: '' },
        expected: {
          success: false,
          error: 'Agent name is required'
        }
      },
      {
        name: 'should fail with whitespace-only name',
        input: { ...validCommand, name: '   ' },
        expected: {
          success: false,
          error: 'Agent name is required'
        }
      },
      {
        name: 'should create agent without optional fields',
        input: {
          name: 'Minimal Agent',
          ownerId: UserId.fromString('550e8400-e29b-41d4-a716-446655440002'),
          organizationId: OrganizationId.fromNumber(1)
        },
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Minimal Agent'
          })
        }
      }
    ];

    test.each(testCases)('$name', async ({ input, expected }) => {
      // Setup mocks
      const mockAgent = MockEntityFactory.createAgent({ name: input.name });
      mockAgentRepository.save.mockResolvedValue(mockAgent);
      
      if (input.roleId) {
        mockRoleRepository.findById.mockResolvedValue({ id: input.roleId });
      }

      const result = await service.createAgent(input);

      expect(result).toEqual(expected);
      
      if (expected.success) {
        expect(mockAgentRepository.save).toHaveBeenCalledTimes(1);
      }
    });

    it('should fail when role does not exist', async () => {
      mockRoleRepository.findById.mockResolvedValue(null);
      
      const result = await service.createAgent(validCommand);
      
      expect(result).toEqual({
        success: false,
        error: `Role with ID ${validCommand.roleId} not found`
      });
    });

    it('should handle repository errors', async () => {
      // Mock role exists to pass validation, then fail on repository save
      mockRoleRepository.findById.mockResolvedValue({ id: validCommand.roleId });
      mockAgentRepository.save.mockRejectedValue(new Error('Database error'));
      
      const result = await service.createAgent(validCommand);
      
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });

    it('should generate API key for new agent', async () => {
      const mockAgent = MockEntityFactory.createAgent();
      mockAgentRepository.save.mockResolvedValue(mockAgent);
      // Mock role exists to pass validation
      mockRoleRepository.findById.mockResolvedValue({ id: validCommand.roleId });
      
      const result = await service.createAgent(validCommand);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.apiKey.value).toMatch(/^key_[a-f0-9]{32}$/);
      }
    });
  });

  describe('updateAgent', () => {
    const existingAgent = MockEntityFactory.createAgent({ 
      id: AgentId.fromNumber(1),
      name: 'Existing Agent' 
    });

    const validUpdateCommand: UpdateAgentCommand = {
      agentId: AgentId.fromNumber(1),
      name: 'Updated Agent',
      description: 'Updated description'
    };

    const updateTestCases: TestCase<UpdateAgentCommand, AgentApplicationResult<Agent>>[] = [
      {
        name: 'should update agent with new data',
        input: validUpdateCommand,
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Updated Agent',
            description: 'Updated description'
          })
        }
      },
      {
        name: 'should fail when agent not found',
        input: { agentId: AgentId.fromNumber(999), name: 'New Name' },
        expected: {
          success: false,
          error: 'Agent with ID 999 not found'
        }
      },
      {
        name: 'should update only provided fields',
        input: { agentId: AgentId.fromNumber(1), name: 'Only Name Updated' },
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Only Name Updated'
          })
        }
      }
    ];

    test.each(updateTestCases)('$name', async ({ input, expected }) => {
      if (input.agentId.value === 1) {
        mockAgentRepository.findById.mockResolvedValue(existingAgent);
        mockAgentRepository.save.mockResolvedValue({
          ...existingAgent,
          ...input,
          updatedAt: expect.any(Date)
        });
      } else {
        mockAgentRepository.findById.mockResolvedValue(null);
      }

      const result = await service.updateAgent(input);

      expect(result).toEqual(expected);
    });

    it('should handle role validation during update', async () => {
      mockAgentRepository.findById.mockResolvedValue(existingAgent);
      mockRoleRepository.findById.mockResolvedValue(null);
      
      const result = await service.updateAgent({
        agentId: AgentId.fromNumber(1),
        roleId: 999
      });
      
      expect(result).toEqual({
        success: false,
        error: 'Role with ID 999 not found'
      });
    });
  });

  describe('deleteAgent', () => {
    const deleteTestCases: TestCase<AgentId, AgentApplicationResult<void>>[] = [
      {
        name: 'should delete existing agent',
        input: AgentId.fromNumber(1),
        expected: {
          success: true,
          data: undefined
        }
      },
      {
        name: 'should fail when agent not found',
        input: AgentId.fromNumber(999),
        expected: {
          success: false,
          error: 'Agent with ID 999 not found'
        }
      }
    ];

    test.each(deleteTestCases)('$name', async ({ input, expected }) => {
      if (input.value === 1) {
        const mockAgent = MockEntityFactory.createAgent({ id: input });
        mockAgentRepository.findById.mockResolvedValue(mockAgent);
        mockAgentRepository.delete.mockResolvedValue(undefined);
      } else {
        mockAgentRepository.findById.mockResolvedValue(null);
      }

      const result = await service.deleteAgent(input);

      expect(result).toEqual(expected);
      
      if (expected.success) {
        expect(mockAgentRepository.delete).toHaveBeenCalledWith(input);
      }
    });
  });

  describe('getAgents', () => {
    const mockAgents = [
      MockEntityFactory.createAgent({ 
        id: AgentId.fromNumber(1), 
        name: 'Agent 1',
        agentType: 'data-collector',
        createdAt: new Date('2024-01-01')
      }),
      MockEntityFactory.createAgent({ 
        id: AgentId.fromNumber(2), 
        name: 'Agent 2',
        agentType: 'process-analyst',
        description: 'Process analysis agent',
        createdAt: new Date('2024-01-02')
      })
    ];

    const mockTeam = MockEntityFactory.createTeam({
      agentIds: [AgentId.fromNumber(1)]
    });

    const filterTestCases: TestCase<AgentFilters, Agent[]>[] = [
      {
        name: 'should return all agents for organization',
        input: { organizationId: OrganizationId.fromNumber(1) },
        expected: mockAgents
      },
      {
        name: 'should filter by search query',
        input: { 
          organizationId: OrganizationId.fromNumber(1),
          searchQuery: 'process'
        },
        expected: [mockAgents[1]]
      },
      {
        name: 'should filter by agent type',
        input: {
          organizationId: OrganizationId.fromNumber(1),
          agentTypes: ['data-collector']
        },
        expected: [mockAgents[0]]
      },
      {
        name: 'should filter by status',
        input: {
          organizationId: OrganizationId.fromNumber(1),
          status: 'active'
        },
        expected: mockAgents
      }
    ];

    test.each(filterTestCases)('$name', async ({ input, expected }) => {
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      if (input.teamId) {
        mockTeamRepository.findById.mockResolvedValue(mockTeam);
      }

      const result = await service.getAgents(input);

      expect(result).toEqual(expected);
    });

    it('should sort agents by creation date (newest first)', async () => {
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      const result = await service.getAgents({ organizationId: OrganizationId.fromNumber(1) });
      
      expect(result[0].createdAt?.getTime()).toBeGreaterThan(result[1].createdAt?.getTime() || 0);
    });

    it('should filter by team membership', async () => {
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      // Create a team that contains agent ID 1 (mockAgents[0])  
      const teamWithAgent1 = MockEntityFactory.createTeam({
        agentIds: [AgentId.fromNumber(1)] // Contains the first agent
      });
      mockTeamRepository.findById.mockResolvedValue(teamWithAgent1);
      
      const result = await service.getAgents({
        organizationId: OrganizationId.fromNumber(1),
        teamId: TeamId.fromNumber(1)
      });
      
      // Should return the agent that's in the team (mockAgents[0])
      expect(result).toHaveLength(1);
      expect(result[0].id.value).toBe(1);
      expect(result[0].name).toBe('Agent 1');
    });
  });

  describe('addCapabilityToAgent', () => {
    const existingAgent = MockEntityFactory.createAgent({ capabilities: [] });
    const newCapability = {
      name: 'data-analysis',
      description: 'Analyze data',
      steps: []
    };

    it('should add capability to agent', async () => {
      mockAgentRepository.findById.mockResolvedValue(existingAgent);
      const updatedAgent = { ...existingAgent, capabilities: [newCapability] };
      mockAgentRepository.save.mockResolvedValue(updatedAgent);
      
      const result = await service.addCapabilityToAgent(existingAgent.id, newCapability);
      
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          capabilities: [newCapability]
        })
      });
    });
  });

  describe('regenerateApiKey', () => {
    const existingAgent = MockEntityFactory.createAgent();

    it('should generate new API key for existing agent', async () => {
      mockAgentRepository.findById.mockResolvedValue(existingAgent);
      const updatedAgent = { ...existingAgent, apiKey: { value: 'ag_newkey123' } };
      mockAgentRepository.save.mockResolvedValue(updatedAgent);
      
      const result = await service.regenerateApiKey(1);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.apiKey).toMatch(/^key_[a-f0-9]{32}$/);
      }
    });
  });

  describe('toggleAgentStatus', () => {
    it('should toggle active agent to inactive', async () => {
      const activeAgent = MockEntityFactory.createAgent({ 
        status: AgentStatus.active()
      });
      mockAgentRepository.findById.mockResolvedValue(activeAgent);
      mockAgentRepository.save.mockResolvedValue({
        ...activeAgent,
        status: AgentStatus.inactive()
      });
      
      const result = await service.toggleAgentStatus(1);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status.value).toBe('inactive');
      }
    });
  });
});