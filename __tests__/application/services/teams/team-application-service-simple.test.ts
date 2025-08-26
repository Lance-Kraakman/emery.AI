// AIDEV-NOTE: Simplified unit tests for TeamApplicationService core functionality
// Tests the main business logic without complex domain entity validation

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamApplicationService } from '@/ddd/application/services/teams/team-application-service';
import { MockRepositoryFactory } from '../shared/mock-factories';
import { TestHelpers } from '../shared/test-helpers';

describe('TeamApplicationService (Core)', () => {
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

  describe('getTeamCount', () => {
    it('should return team count for organization', async () => {
      mockTeamRepository.countByOrganization.mockResolvedValue(5);
      
      const result = await service.getTeamCount(1);
      
      expect(result).toBe(5);
    });
  });

  describe('getTeam', () => {
    it('should return team by ID', async () => {
      const mockTeam = { id: { value: 1 }, name: 'Test Team' };
      mockTeamRepository.findById.mockResolvedValue(mockTeam as any);
      
      const result = await service.getTeam(1);
      
      expect(result).toBe(mockTeam);
    });
  });
});