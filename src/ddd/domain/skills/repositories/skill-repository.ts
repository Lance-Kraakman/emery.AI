import { Skill, CreateSkillProps, UpdateSkillProps } from '../entities/skill';
import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';

/**
 * Skill Repository Interface
 *
 * AIDEV-NOTE: Simplified single-instruction model
 * Removed: findByIdWithSteps (no steps anymore)
 * Added: Global skills support (findByOrganizationId, findGlobalSkills)
 *
 * Defines the contract for persisting and retrieving Skill aggregates.
 * Implementations are provided in the infrastructure layer.
 */
export interface ISkillRepository {
  /**
   * Find a skill by its ID
   */
  findById(id: SkillId): Promise<Skill | null>;

  /**
   * Find all skills for a specific agent (agent-scoped)
   */
  findByAgentId(agentId: AgentId): Promise<Skill[]>;

  /**
   * Find all global skills for an organization (agentId is null)
   */
  findGlobalSkillsByOrganization(organizationId: OrganizationId): Promise<Skill[]>;

  /**
   * Find all skills for an organization (both global and agent-scoped)
   */
  findByOrganizationId(organizationId: OrganizationId): Promise<Skill[]>;

  /**
   * Create a new skill with inputs, outputs, instructions, and tools
   * Can be agent-scoped (agentId set) or global (agentId null)
   */
  create(props: CreateSkillProps): Promise<Skill>;

  /**
   * Update an existing skill
   * Can update name, description, inputs, outputs, instructions, tools
   */
  update(id: SkillId, updates: UpdateSkillProps): Promise<Skill>;

  /**
   * Delete a skill
   */
  delete(id: SkillId): Promise<void>;

  /**
   * Delete all skills for an agent
   */
  deleteByAgentId(agentId: AgentId): Promise<void>;

  /**
   * Check if a skill exists
   */
  exists(id: SkillId): Promise<boolean>;

  /**
   * Count skills for an agent
   */
  countByAgentId(agentId: AgentId): Promise<number>;

  /**
   * Count global skills for an organization
   */
  countGlobalSkillsByOrganization(organizationId: OrganizationId): Promise<number>;
}
