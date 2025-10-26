import { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { IStepRepository } from '@/ddd/domain/skills/repositories/step-repository';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { StepId } from '@/ddd/domain/skills/value-objects/step-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { SkillEntity, type Skill } from '@/ddd/domain/skills/entities/skill';
import { StepEntity } from '@/ddd/domain/skills/entities/step';
import { StepTypeVO } from '@/ddd/domain/skills/value-objects/step-type';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('SkillService');

/**
 * Command to create a new skill
 */
export interface CreateSkillCommand {
  agentId: number;
  name: string;
  description: string;
  steps?: Array<{
    type: 'TOOL_STEP' | 'CODE_STEP';
    instructions: string;
    model?: string;
    tools?: Array<{ name: string; config: any }>;
    servers?: any[];
  }>;
}

/**
 * Command to update an existing skill
 */
export interface UpdateSkillCommand {
  name?: string;
  description?: string;
}

/**
 * Command to update a step
 */
export interface UpdateStepCommand {
  instructions?: string;
  model?: string;
  tools?: Array<{ name: string; config: any }>;
  servers?: any[];
}

/**
 * Skill Application Service
 *
 * Orchestrates skill-related use cases.
 * Manages transactions and coordinates between domain and infrastructure.
 */
export class SkillApplicationService {
  constructor(
    private skillRepository: ISkillRepository,
    private stepRepository: IStepRepository
  ) {
    logger.debug('[SkillApplicationService] initialized');
  }

  /**
   * Create a new skillwith optional steps
   */
  async createSkill(command: CreateSkillCommand): Promise<Result<SkillId>> {
    try {
      logger.debug('[SkillApplicationService] createSkill', {
        agentId: command.agentId,
        name: command.name,
        stepCount: command.steps?.length || 0
      });

      const agentId = AgentId.fromNumber(command.agentId);

      // Create skill
      const skill= await this.skillRepository.create({
        agentId,
        name: command.name,
        description: command.description
      });

      logger.debug('[SkillApplicationService] skillcreated', {
        skillId: skill.id.value
      });

      // Create steps if provided
      if (command.steps && command.steps.length > 0) {
        const stepProps = command.steps.map((step, index) => ({
          skillId: skill.id,
          stepOrder: index,
          type: StepTypeVO.fromString(step.type),
          instructions: step.instructions,
          model: step.model,
          tools: step.tools?.map(t => ToolConfig.create(t.name, t.config)) || [],
          servers: step.servers || []
        }));

        await this.stepRepository.createMany(stepProps);

        logger.debug('[SkillApplicationService] steps created', {
          count: stepProps.length
        });
      }

      return { success: true, data: skill.id };
    } catch (error) {
      logger.error('[SkillApplicationService] createSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create skill' };
    }
  }

  /**
   * Update an existing skill's metadata (name, description)
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

      logger.debug('[SkillApplicationService] skillupdated', { skillId });

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] updateSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update skill' };
    }
  }

  /**
   * Delete a skill(cascade deletes all steps)
   */
  async deleteSkill(skillId: number): Promise<Result<void>> {
    try {
      logger.debug('[SkillApplicationService] deleteSkill', { skillId });

      const id = SkillId.fromNumber(skillId);
      await this.skillRepository.delete(id);

      logger.debug('[SkillApplicationService] skilldeleted', { skillId });

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] deleteSkill error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete skill' };
    }
  }

  /**
   * Get a skillby ID with all steps
   */
  async getSkill(skillId: number): Promise<Result<Skill | null>> {
    try {
      logger.debug('[SkillApplicationService] getSkill', { skillId });

      const id = SkillId.fromNumber(skillId);
      const skill= await this.skillRepository.findByIdWithSteps(id);

      return { success: true, data: skill};
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

  // ===== STEP MANAGEMENT =====

  /**
   * Add a new step to a skill
   */
  async addStep(
    skillId: number,
    stepData: {
      type: 'TOOL_STEP' | 'CODE_STEP';
      instructions: string;
      model?: string;
      tools?: Array<{ name: string; config: any }>;
      servers?: any[];
    }
  ): Promise<Result<StepId>> {
    try {
      logger.debug('[SkillApplicationService] addStep', {
        skillId,
        type: stepData.type
      });

      const id = SkillId.fromNumber(skillId);

      // Get next step order
      const stepOrder = await this.stepRepository.getNextStepOrder(id);

      const step = await this.stepRepository.create({
        skillId: id,
        stepOrder,
        type: StepTypeVO.fromString(stepData.type),
        instructions: stepData.instructions,
        model: stepData.model,
        tools: stepData.tools?.map(t => ToolConfig.create(t.name, t.config)) || [],
        servers: stepData.servers || []
      });

      logger.debug('[SkillApplicationService] step added', {
        stepId: step.id.value,
        stepOrder
      });

      return { success: true, data: step.id };
    } catch (error) {
      logger.error('[SkillApplicationService] addStep error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add step' };
    }
  }

  /**
   * Update an existing step
   */
  async updateStep(stepId: number, command: UpdateStepCommand): Promise<Result<void>> {
    try {
      logger.debug('[SkillApplicationService] updateStep', {
        stepId,
        updates: command
      });

      const id = StepId.fromNumber(stepId);
      await this.stepRepository.update(id, {
        instructions: command.instructions,
        model: command.model,
        tools: command.tools?.map(t => ToolConfig.create(t.name, t.config)),
        servers: command.servers
      });

      logger.debug('[SkillApplicationService] step updated', { stepId });

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] updateStep error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update step' };
    }
  }

  /**
   * Delete a step
   */
  async deleteStep(stepId: number): Promise<Result<void>> {
    try {
      logger.debug('[SkillApplicationService] deleteStep', { stepId });

      const id = StepId.fromNumber(stepId);
      const step = await this.stepRepository.findById(id);

      if (!step) {
        return { success: false, error: 'Step not found' };
      }

      // Delete the step
      await this.stepRepository.delete(id);

      // Reindex remaining steps
      const remainingSteps = await this.stepRepository.findBySkillId(step.skillId);
      if (remainingSteps.length > 0) {
        const reindexUpdates = remainingSteps.map((s, index) => ({
          id: s.id,
          stepOrder: index
        }));
        await this.stepRepository.updateStepOrders(reindexUpdates);
      }

      logger.debug('[SkillApplicationService] step deleted and remaining steps reindexed');

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] deleteStep error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete step' };
    }
  }

  /**
   * Reorder steps within a skill
   */
  async reorderSteps(
    skillId: number,
    stepIds: number[]
  ): Promise<Result<void>> {
    try {
      logger.debug('[SkillApplicationService] reorderSteps', {
        skillId,
        stepIds
      });

      // Verify all steps belong to the skill
      const id = SkillId.fromNumber(skillId);
      const existingSteps = await this.stepRepository.findBySkillId(id);

      if (existingSteps.length !== stepIds.length) {
        return { success: false, error: 'Step count mismatch - all steps must be included in reorder' };
      }

      const existingIds = new Set(existingSteps.map(s => s.id.value));
      for (const stepId of stepIds) {
        if (!existingIds.has(stepId)) {
          return { success: false, error: `Step ${stepId} not found in skill${skillId}` };
        }
      }

      // Update step orders
      const updates = stepIds.map((id, index) => ({
        id: StepId.fromNumber(id),
        stepOrder: index
      }));

      await this.stepRepository.updateStepOrders(updates);

      logger.debug('[SkillApplicationService] steps reordered successfully');

      return { success: true };
    } catch (error) {
      logger.error('[SkillApplicationService] reorderSteps error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reorder steps' };
    }
  }
}
