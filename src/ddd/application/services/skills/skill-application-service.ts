import { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { SkillEntity, type Skill, type InputDefinition, type OutputDefinition, type ToolConfig, type SkillExecutionType, type TaskModelConfig, type SkillStep, type ToolExecutionConfig, type WriteConfig } from '@/ddd/domain/skills/entities/skill';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';

const logger = createDebugLogger('SkillService');

/**
 * Command to create a new skill
 * AIDEV-NOTE: Simplified to single-instruction model
 * agentId is optional - null/undefined for global skills
 */
export interface CreateSkillCommand {
  agentId?: number | null; // Optional: null/undefined for global skills
  organizationId: number; // Required for all skills
  name: string;
  description?: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  instructions: string;
  tools: ToolConfig[];
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agentic' (default), 'agent', 'operation', 'tool', or 'write'
  taskModelConfig?: TaskModelConfig; // Config for 'operation' execution
  toolExecutionConfig?: ToolExecutionConfig; // Config for 'tool' execution
  writeConfig?: WriteConfig; // Config for 'write' execution
  steps?: SkillStep[]; // Steps for 'agent' (step-based) execution
}

/**
 * Command to update an existing skill
 */
export interface UpdateSkillCommand {
  name?: string;
  description?: string;
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  instructions?: string;
  tools?: ToolConfig[];
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  content?: MessagePart[]; // Skill-level attachments
  executionType?: SkillExecutionType; // 'agentic' (default), 'agent', 'operation', 'tool', or 'write'
  taskModelConfig?: TaskModelConfig | null; // Config for 'operation' execution
  toolExecutionConfig?: ToolExecutionConfig | null; // Config for 'tool' execution
  writeConfig?: WriteConfig | null; // Config for 'write' execution
  steps?: SkillStep[] | null; // Steps for 'agent' (step-based) execution
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
        organizationId: command.organizationId,
        name: command.name,
        inputCount: command.inputs.length,
        outputCount: command.outputs.length,
        isGlobal: !command.agentId
      });

      const organizationId = OrganizationId.fromNumber(command.organizationId);
      const agentId = command.agentId ? AgentId.fromNumber(command.agentId) : null;

      // Create skill with all fields
      const skill = await this.skillRepository.create({
        organizationId,
        agentId,
        name: command.name,
        description: command.description,
        inputs: command.inputs,
        outputs: command.outputs,
        instructions: command.instructions,
        tools: command.tools,
        model: command.model,
        agentType: command.agentType,
        executionType: command.executionType,
        taskModelConfig: command.taskModelConfig,
        toolExecutionConfig: command.toolExecutionConfig,
        writeConfig: command.writeConfig,
        steps: command.steps
      });

      logger.debug('[SkillApplicationService] skill created', {
        skillId: skill.id.value,
        isGlobal: !agentId
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

  /**
   * Get all organization skills for an organization
   */
  async getOrganizationSkills(organizationId: number): Promise<Result<Skill[]>> {
    try {
      logger.debug('[SkillApplicationService] getOrganizationSkills', { organizationId });

      const id = OrganizationId.fromNumber(organizationId);
      const skills = await this.skillRepository.findOrganizationSkills(id);

      logger.debug('[SkillApplicationService] organization skills retrieved', {
        count: skills.length
      });

      return { success: true, data: skills };
    } catch (error) {
      logger.error('[SkillApplicationService] getOrganizationSkills error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get organization skills' };
    }
  }

  /**
   * Get all skills for an organization (both global and agent-scoped)
   */
  async getSkillsByOrganization(organizationId: number): Promise<Result<Skill[]>> {
    try {
      logger.debug('[SkillApplicationService] getSkillsByOrganization', { organizationId });

      const id = OrganizationId.fromNumber(organizationId);
      const skills = await this.skillRepository.findByOrganizationId(id);

      logger.debug('[SkillApplicationService] organization skills retrieved', {
        count: skills.length
      });

      return { success: true, data: skills };
    } catch (error) {
      logger.error('[SkillApplicationService] getSkillsByOrganization error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get organization skills' };
    }
  }
}
