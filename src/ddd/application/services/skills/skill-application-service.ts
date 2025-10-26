import { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { SkillEntity, type Skill, type SkillInput, type SkillOutput, type ToolConfig } from '@/ddd/domain/skills/entities/skill';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('SkillService');

/**
 * Command to create a new skill
 * AIDEV-NOTE: Simplified to single-instruction model
 */
export interface CreateSkillCommand {
  agentId: number;
  name: string;
  description?: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfig[];
}

/**
 * Command to update an existing skill
 */
export interface UpdateSkillCommand {
  name?: string;
  description?: string;
  inputs?: SkillInput[];
  outputs?: SkillOutput[];
  instructions?: string;
  tools?: ToolConfig[];
}

/**
 * Skill Application Service
 *
 * AIDEV-NOTE: Simplified - removed stepRepository and all step-related methods
 *
 * Orchestrates skill-related use cases.
 * Manages transactions and coordinates between domain and infrastructure.
 */
export class SkillApplicationService {
  constructor(
    private skillRepository: ISkillRepository
  ) {
    logger.debug('[SkillApplicationService] initialized');
  }

  /**
   * Create a new skill with single-instruction model
   */
  async createSkill(command: CreateSkillCommand): Promise<Result<SkillId>> {
    try {
      logger.debug('[SkillApplicationService] createSkill', {
        agentId: command.agentId,
        name: command.name,
        inputCount: command.inputs.length,
        outputCount: command.outputs.length
      });

      const agentId = AgentId.fromNumber(command.agentId);

      // Create skill with all fields
      const skill = await this.skillRepository.create({
        agentId,
        name: command.name,
        description: command.description,
        inputs: command.inputs,
        outputs: command.outputs,
        instructions: command.instructions,
        tools: command.tools
      });

      logger.debug('[SkillApplicationService] skill created', {
        skillId: skill.id.value
      });

      return { success: true, data: skill.id };
    } catch (error) {
      logger.error('[SkillApplicationService] createSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create skill' };
    }
  }

  /**
   * Update an existing skill
   */
  async updateSkill(
    skillId: number,
    command: UpdateSkillCommand
  ): Promise<Result<void>> {
    try {
      logger.debug('[SkillApplicationService] updateSkill', {
        skillId,
        updates: command
      });

      const id = SkillId.fromNumber(skillId);
      await this.skillRepository.update(id, command);

      logger.debug('[SkillApplicationService] skill updated', { skillId });

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] updateSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update skill' };
    }
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: number): Promise<Result<void>> {
    try {
      logger.debug('[SkillApplicationService] deleteSkill', { skillId });

      const id = SkillId.fromNumber(skillId);
      await this.skillRepository.delete(id);

      logger.debug('[SkillApplicationService] skill deleted', { skillId });

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] deleteSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete skill' };
    }
  }

  /**
   * Get a skill by ID
   */
  async getSkill(skillId: number): Promise<Result<Skill | null>> {
    try {
      logger.debug('[SkillApplicationService] getSkill', { skillId });

      const id = SkillId.fromNumber(skillId);
      const skill = await this.skillRepository.findById(id);

      return { success: true, data: skill };
    } catch (error) {
      logger.error('[SkillApplicationService] getSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get skill' };
    }
  }

  /**
   * Get all skills for an agent
   */
  async getSkillsByAgent(agentId: number): Promise<Result<Skill[]>> {
    try {
      logger.debug('[SkillApplicationService] getSkillsByAgent', { agentId });

      const id = AgentId.fromNumber(agentId);
      const skills = await this.skillRepository.findByAgentId(id);

      logger.debug('[SkillApplicationService] skills retrieved', {
        count: skills.length
      });

      return { success: true, data: skills };
    } catch (error) {
      logger.error('[SkillApplicationService] getSkillsByAgent error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get skills' };
    }
  }
}
