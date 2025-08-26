// AIDEV-NOTE: Mock factory functions for DDD application service testing
// Provides consistent mock implementations for repository interfaces

import { vi } from 'vitest';
import { Agent } from '@/ddd/domain/agents/entities/agent';
import { Team } from '@/ddd/domain/teams/entities/team';
import { RagIndex } from '@/ddd/domain/rag/entities/rag-index';
import { AgentId, OrganizationId, UserId, TeamId } from '@/ddd/domain/shared/value-objects';

export class MockRepositoryFactory {
  static createAgentRepository() {
    return {
      save: vi.fn(),
      findById: vi.fn(),
      findByOrganization: vi.fn(),
      findByOwner: vi.fn(),
      delete: vi.fn(),
      findByIds: vi.fn(),
      existsById: vi.fn()
    };
  }

  static createTeamRepository() {
    return {
      save: vi.fn(),
      findById: vi.fn(),
      findByOrganization: vi.fn(),
      findByAgentId: vi.fn(),
      delete: vi.fn(),
      countByOrganization: vi.fn()
    };
  }

  static createRoleRepository() {
    return {
      findById: vi.fn(),
      findByOrganization: vi.fn(),
      save: vi.fn(),
      delete: vi.fn()
    };
  }

  static createRagIndexRepository() {
    return {
      save: vi.fn(),
      findById: vi.fn(),
      findByOrganization: vi.fn(),
      delete: vi.fn(),
      isNameUnique: vi.fn()
    };
  }

  static createRagDocumentRepository() {
    return {
      save: vi.fn(),
      findByIndexId: vi.fn(),
      countByIndexId: vi.fn(),
      synchronizeDocuments: vi.fn(),
      delete: vi.fn()
    };
  }

  static createOrganizationRepository() {
    return {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByMemberId: vi.fn()
    };
  }

  static createDatabaseRepository() {
    return {
      findByOrganization: vi.fn(),
      save: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn()
    };
  }
}

export class MockEntityFactory {
  static createAgent(overrides: Partial<Agent> = {}): Agent {
    return {
      id: AgentId.fromNumber(1),
      name: 'Test Agent',
      role: 'assistant',
      description: 'Test description',
      persona: 'Test persona',
      ownerId: UserId.fromString('550e8400-e29b-41d4-a716-446655440001'),
      organizationId: OrganizationId.fromNumber(1),
      roleId: null,
      databaseId: null,
      agentType: null,
      specialization: null,
      tools: [],
      servers: [],
      trigger: null,
      capabilities: [],
      status: { value: 'active', equals: vi.fn(), toString: vi.fn() } as any,
      apiKey: { value: 'key_0123456789abcdef0123456789abcdef', equals: vi.fn(), toString: vi.fn() } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  static createTeam(overrides: any = {}): Team {
    const teamData = {
      name: 'Test Team',
      purpose: 'Testing',
      description: 'Test team description',
      responsibilities: ['Testing'],
      goals: ['Test goals'],
      organizationId: OrganizationId.fromNumber(1),
      agentIds: [],
      ...overrides
    };
    
    const team = Team.create(teamData);
    return {
      ...team,
      id: TeamId.fromNumber(overrides.id?.value || 1), // Use provided ID or default to 1
      agentCount: overrides.agentCount || 0,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      toPersistence: vi.fn(),
      ...overrides
    } as Team;
  }

  static createRagIndex(overrides: any = {}) {
    return RagIndex.create({
      name: 'Test Index',
      description: 'Test RAG index',
      organizationId: OrganizationId.fromNumber(1),
      domainTypes: ['table', 'file'],
      createdBy: '550e8400-e29b-41d4-a716-446655440001',
      ...overrides
    });
  }
}