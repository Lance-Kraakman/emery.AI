// AIDEV-NOTE: Unit tests for TeamApplicationService
// Tests team management, agent assignment, and organization scoping

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamApplicationService } from '@/ddd/application/services/teams/team-application-service';
import type { 
  CreateTeamCommand, 
  UpdateTeamCommand, 
  TeamFilters,
  TeamApplicationResult 
} from '@/ddd/application/services/teams/team-application-service';
import { Team } from '@/ddd/domain/teams/entities/team';
import { AgentId, OrganizationId, TeamId } from '@/ddd/domain/shared/value-objects';
import { MockRepositoryFactory, MockEntityFactory } from '../shared/mock-factories';
import { TestHelpers } from '../shared/test-helpers';
import type { TestCase } from '../shared/test-case';

describe('TeamApplicationService', () => {
  let service: TeamApplicationService;
  let mockTeamRepository: ReturnType<typeof MockRepositoryFactory.createTeamRepository>;
  let mockAgentRepository: ReturnType<typeof MockRepositoryFactory.createAgentRepository>;

  beforeEach(() => {
    TestHelpers.setupConsoleMocks();
    
    mockTeamRepository = MockRepositoryFactory.createTeamRepository();
    mockAgentRepository = MockRepositoryFactory.createAgentRepository();
    
    service = new TeamApplicationService(
      mockTeamRepository,
      mockAgentRepository
    );
    
    vi.clearAllMocks();
  });

  describe('createTeam', () => {
    const validCommand: CreateTeamCommand = {
      name: 'Data Analytics Team',
      purpose: 'Analyze business data',
      description: 'Team focused on data analysis and insights',
      responsibilities: ['Data collection', 'Analysis', 'Reporting'],
      goals: ['Improve data quality', 'Generate insights'],
      agentIds: ['1', '2'],
      organizationId: 1
    };

    const testCases: TestCase<CreateTeamCommand, TeamApplicationResult<Team>>[] = [
      {
        name: 'should create team with valid data',
        input: validCommand,
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Data Analytics Team',
            purpose: 'Analyze business data',
            responsibilities: ['Data collection', 'Analysis', 'Reporting']
          })
        }
      },
      {
        name: 'should fail with empty name',
        input: { ...validCommand, name: '' },
        expected: {
          success: false,
          error: 'Team name is required'
        }
      },
      {
        name: 'should fail with whitespace-only name',
        input: { ...validCommand, name: '   ' },
        expected: {
          success: false,
          error: 'Team name is required'
        }
      },
      {
        name: 'should create team with minimal data',
        input: {
          name: 'Minimal Team',
          organizationId: 1
        },
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Minimal Team'
          })
        }
      },
      {
        name: 'should create team without agent IDs',
        input: {
          name: 'No Agents Team',
          organizationId: 1,
          agentIds: []
        },
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'No Agents Team'
          })
        }
      }
    ];

    test.each(testCases)('$name', async ({ input, expected }) => {
      // Setup organization agents if agentIds provided
      if (input.agentIds && input.agentIds.length > 0) {
        const mockAgents = input.agentIds.map((id, index) => 
          MockEntityFactory.createAgent({ 
            id: AgentId.fromNumber(parseInt(id)),
            name: `Agent ${index + 1}`
          })
        );
        mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      } else {
        mockAgentRepository.findByOrganization.mockResolvedValue([]);
      }

      const result = await service.createTeam(input);

      expect(result).toEqual(expected);
      
      if (expected.success) {
        expect(mockTeamRepository.save).toHaveBeenCalledTimes(1);
      }
    });

    it('should handle invalid agent IDs with warnings', async () => {
      const mockAgents = [
        MockEntityFactory.createAgent({ id: AgentId.fromNumber(1) })
      ];
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      const commandWithInvalidAgents = {
        ...validCommand,
        agentIds: ['1', '999'] // 999 doesn't exist
      };
      
      const result = await service.createTeam(commandWithInvalidAgents);
      
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(['Invalid agent IDs: 999']);
    });

    it('should handle repository errors', async () => {
      mockAgentRepository.findByOrganization.mockResolvedValue([]);
      mockTeamRepository.save.mockRejectedValue(new Error('Database error'));
      
      const result = await service.createTeam(validCommand);
      
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('updateTeam', () => {
    const existingTeam = MockEntityFactory.createTeam({ 
      name: 'Existing Team',
      purpose: 'Original purpose'
    });

    const validUpdateCommand: UpdateTeamCommand = {
      teamId: 1,
      name: 'Updated Team',
      description: 'Updated description',
      goals: ['New goal']
    };

    const updateTestCases: TestCase<UpdateTeamCommand, TeamApplicationResult<Team>>[] = [
      {
        name: 'should update team with new data',
        input: validUpdateCommand,
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Updated Team',
            description: 'Updated description',
            goals: ['New goal']
          })
        }
      },
      {
        name: 'should fail when team not found',
        input: { teamId: 999, name: 'Not Found Team' },
        expected: {
          success: false,
          error: 'Team with ID 999 not found'
        }
      },
      {
        name: 'should update only provided fields',
        input: { teamId: 1, name: 'Only Name Updated' },
        expected: {
          success: true,
          data: expect.objectContaining({
            name: 'Only Name Updated',
            purpose: 'Original purpose' // Should remain unchanged
          })
        }
      }
    ];

    test.each(updateTestCases)('$name', async ({ input, expected }) => {
      if (input.teamId === 1) {
        mockTeamRepository.findById.mockResolvedValue(existingTeam);
        mockTeamRepository.save.mockResolvedValue(expected.success ? expected.data as Team : existingTeam);
        mockAgentRepository.findByOrganization.mockResolvedValue([]);
      } else {
        mockTeamRepository.findById.mockResolvedValue(null);
      }

      const result = await service.updateTeam(input);

      TestHelpers.expectPartialMatch(result, expected);
    });

    it('should validate agent IDs during update', async () => {
      const mockAgents = [
        MockEntityFactory.createAgent({ id: AgentId.fromNumber(1) })
      ];
      
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      const result = await service.updateTeam({
        teamId: 1,
        agentIds: ['1', '999'] // Invalid agent ID
      });
      
      expect(result.success).toBe(true);
      expect(result.warnings).toEqual(['Invalid agent IDs: 999']);
    });
  });

  describe('deleteTeam', () => {
    const deleteTestCases: TestCase<number, TeamApplicationResult<void>>[] = [
      {
        name: 'should delete existing team',
        input: 1,
        expected: {
          success: true,
          data: undefined
        }
      },
      {
        name: 'should fail when team not found',
        input: 999,
        expected: {
          success: false,
          error: 'Team with ID 999 not found'
        }
      }
    ];

    test.each(deleteTestCases)('$name', async ({ input, expected }) => {
      if (input === 1) {
        const mockTeam = MockEntityFactory.createTeam();
        mockTeamRepository.findById.mockResolvedValue(mockTeam);
        mockTeamRepository.delete.mockResolvedValue(undefined);
      } else {
        mockTeamRepository.findById.mockResolvedValue(null);
      }

      const result = await service.deleteTeam(input);

      expect(result).toEqual(expected);
      
      if (expected.success) {
        expect(mockTeamRepository.delete).toHaveBeenCalledWith(TeamId.fromNumber(input));
      }
    });
  });

  describe('getTeams', () => {
    const mockTeams = [
      MockEntityFactory.createTeam({ 
        name: 'Analytics Team',
        description: 'Data analytics and reporting',
        purpose: 'Analyze business data',
        agentIds: [AgentId.fromNumber(1), AgentId.fromNumber(2)],
        createdAt: new Date('2024-01-02')
      }),
      MockEntityFactory.createTeam({ 
        name: 'Operations Team',
        description: 'Handle operational tasks',
        purpose: 'Manage operations',
        agentIds: [],
        createdAt: new Date('2024-01-01')
      })
    ];

    const filterTestCases: TestCase<TeamFilters, Team[]>[] = [
      {
        name: 'should return all teams for organization',
        input: { organizationId: 1 },
        expected: mockTeams
      },
      {
        name: 'should filter by search query (name)',
        input: { 
          organizationId: 1,
          searchQuery: 'analytics'
        },
        expected: [mockTeams[0]]
      },
      {
        name: 'should filter by search query (description)',
        input: { 
          organizationId: 1,
          searchQuery: 'operational'
        },
        expected: [mockTeams[1]]
      },
      {
        name: 'should filter teams with agents',
        input: {
          organizationId: 1,
          hasAgents: true
        },
        expected: [mockTeams[0]]
      },
      {
        name: 'should filter teams without agents',
        input: {
          organizationId: 1,
          hasAgents: false
        },
        expected: [mockTeams[1]]
      }
    ];

    test.each(filterTestCases)('$name', async ({ input, expected }) => {
      // Mock agentCount getter on teams
      mockTeams[0].agentCount = 2;
      mockTeams[1].agentCount = 0;
      
      mockTeamRepository.findByOrganization.mockResolvedValue(mockTeams);

      const result = await service.getTeams(input);

      expect(result).toEqual(expected);
    });

    it('should sort teams by creation date (newest first)', async () => {
      mockTeamRepository.findByOrganization.mockResolvedValue(mockTeams);
      
      const result = await service.getTeams({ organizationId: 1 });
      
      // mockTeams[0] has newer date (2024-01-02) than mockTeams[1] (2024-01-01)
      expect(result[0].createdAt?.getTime()).toBeGreaterThan(result[1].createdAt?.getTime() || 0);
    });
  });

  describe('addAgentToTeam', () => {
    const existingTeam = MockEntityFactory.createTeam({ 
      agentIds: [AgentId.fromNumber(1)]
    });

    const mockAgents = [
      MockEntityFactory.createAgent({ id: AgentId.fromNumber(1) }),
      MockEntityFactory.createAgent({ id: AgentId.fromNumber(2) })
    ];

    it('should add new agent to team', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      mockTeamRepository.save.mockResolvedValue(existingTeam);
      
      const result = await service.addAgentToTeam(1, '2');
      
      expect(result.success).toBe(true);
      expect(mockTeamRepository.save).toHaveBeenCalled();
    });

    it('should fail when agent already in team', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      const result = await service.addAgentToTeam(1, '1'); // Agent 1 already in team
      
      expect(result).toEqual({
        success: false,
        error: 'Agent 1 is already in the team'
      });
    });

    it('should fail when agent does not exist', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      const result = await service.addAgentToTeam(1, '999');
      
      expect(result).toEqual({
        success: false,
        error: 'Agent with ID 999 not found in organization'
      });
    });
  });

  describe('removeAgentFromTeam', () => {
    const existingTeam = MockEntityFactory.createTeam({ 
      agentIds: [AgentId.fromNumber(1), AgentId.fromNumber(2)]
    });

    it('should remove agent from team', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockTeamRepository.save.mockResolvedValue(existingTeam);
      
      const result = await service.removeAgentFromTeam(1, '1');
      
      expect(result.success).toBe(true);
      expect(mockTeamRepository.save).toHaveBeenCalled();
    });

    it('should fail when agent not in team', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      
      const result = await service.removeAgentFromTeam(1, '999');
      
      expect(result).toEqual({
        success: false,
        error: 'Agent 999 is not in the team'
      });
    });
  });

  describe('bulkAssignAgents', () => {
    const existingTeam = MockEntityFactory.createTeam();
    const mockAgents = [
      MockEntityFactory.createAgent({ id: AgentId.fromNumber(1) }),
      MockEntityFactory.createAgent({ id: AgentId.fromNumber(2) }),
      MockEntityFactory.createAgent({ id: AgentId.fromNumber(3) })
    ];

    it('should assign multiple agents to team', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      mockTeamRepository.save.mockResolvedValue(existingTeam);
      
      const result = await service.bulkAssignAgents(1, ['1', '2', '3']);
      
      expect(result.success).toBe(true);
      expect(mockTeamRepository.save).toHaveBeenCalled();
    });

    it('should fail with invalid agent IDs', async () => {
      mockTeamRepository.findById.mockResolvedValue(existingTeam);
      mockAgentRepository.findByOrganization.mockResolvedValue(mockAgents);
      
      const result = await service.bulkAssignAgents(1, ['1', '999']);
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid agent IDs: 999'
      });
    });
  });

  describe('getTeamCount', () => {
    it('should return team count for organization', async () => {
      mockTeamRepository.countByOrganization.mockResolvedValue(5);
      
      const result = await service.getTeamCount(1);
      
      expect(result).toBe(5);
      expect(mockTeamRepository.countByOrganization).toHaveBeenCalledWith(OrganizationId.fromNumber(1));
    });
  });

  describe('getTeamsForAgent', () => {
    it('should return teams containing specific agent', async () => {
      const mockTeams = [MockEntityFactory.createTeam()];
      mockTeamRepository.findByAgentId.mockResolvedValue(mockTeams);
      
      const result = await service.getTeamsForAgent('1');
      
      expect(result).toEqual(mockTeams);
      expect(mockTeamRepository.findByAgentId).toHaveBeenCalledWith(AgentId.fromNumber(1));
    });
  });
});