import { Skill, CreateSkillProps, UpdateSkillProps } from '../entities/skill';
import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';

/**
 * Skill Repository Interface
 *
 * AIDEV-NOTE: Simplified single-instruction model
 * Removed: findByIdWithSteps (no steps anymore)
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
   * Find all skills for a specific agent
   */
  findByAgentId(agentId: AgentId): Promise<Skill[]>;

  /**
   * Create a new skill with inputs, outputs, instructions, and tools
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
}
