import { Skill, CreateSkillProps, UpdateSkillProps } from '../entities/skill';
import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';

/**
 * Skill Repository Interface
 *
 * Defines the contract for persisting and retrieving Skill aggregates.
 * Implementations are provided in the infrastructure layer.
 *
 * AIDEV-NOTE: This is a domain interface - implementations go in infrastructure layer.
 */
export interface ISkillRepository {
  /**
   * Find a skill by its ID (without steps loaded)
   */
  findById(id: SkillId): Promise<Skill | null>;

  /**
   * Find all capabilities for a specific agent
   * Steps are loaded for each skill
   */
  findByAgentId(agentId: AgentId): Promise<Skill[]>;

  /**
   * Find a skill by ID with all steps loaded
   * Steps are ordered by stepOrder
   */
  findByIdWithSteps(id: SkillId): Promise<Skill | null>;

  /**
   * Create a new skill
   * Steps should be created separately via step repository
   */
  create(props: CreateSkillProps): Promise<Skill>;

  /**
   * Update an existing skill
   * Only updates skill metadata (name, description)
   * Steps are managed separately
   */
  update(id: SkillId, updates: UpdateSkillProps): Promise<Skill>;

  /**
   * Delete a skill
   * Cascade deletes all associated steps
   */
  delete(id: SkillId): Promise<void>;

  /**
   * Delete all capabilities for an agent
   * Cascade deletes all associated steps
   */
  deleteByAgentId(agentId: AgentId): Promise<void>;

  /**
   * Check if a skill exists
   */
  exists(id: SkillId): Promise<boolean>;

  /**
   * Count capabilities for an agent
   */
  countByAgentId(agentId: AgentId): Promise<number>;
}
