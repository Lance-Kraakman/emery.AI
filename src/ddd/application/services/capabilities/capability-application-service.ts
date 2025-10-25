import { ICapabilityRepository } from '@/ddd/domain/capabilities/repositories/capability-repository';
import { IStepRepository } from '@/ddd/domain/capabilities/repositories/step-repository';
import { CapabilityId } from '@/ddd/domain/capabilities/value-objects/capability-id';
import { StepId } from '@/ddd/domain/capabilities/value-objects/step-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { CapabilityEntity, type Capability } from '@/ddd/domain/capabilities/entities/capability';
import { StepEntity } from '@/ddd/domain/capabilities/entities/step';
import { StepTypeVO } from '@/ddd/domain/capabilities/value-objects/step-type';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('CapabilityService');

/**
 * Command to create a new capability
 */
export interface CreateCapabilityCommand {
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
 * Command to update an existing capability
 */
export interface UpdateCapabilityCommand {
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
 * Capability Application Service
 *
 * Orchestrates capability-related use cases.
 * Manages transactions and coordinates between domain and infrastructure.
 */
export class CapabilityApplicationService {
  constructor(
    private capabilityRepository: ICapabilityRepository,
    private stepRepository: IStepRepository
  ) {
    logger.debug('[CapabilityApplicationService] initialized');
  }

  /**
   * Create a new capability with optional steps
   */
  async createCapability(command: CreateCapabilityCommand): Promise<Result<CapabilityId>> {
    try {
      logger.debug('[CapabilityApplicationService] createCapability', {
        agentId: command.agentId,
        name: command.name,
        stepCount: command.steps?.length || 0
      });

      const agentId = AgentId.fromNumber(command.agentId);

      // Create capability
      const capability = await this.capabilityRepository.create({
        agentId,
        name: command.name,
        description: command.description
      });

      logger.debug('[CapabilityApplicationService] capability created', {
        capabilityId: capability.id.value
      });

      // Create steps if provided
      if (command.steps && command.steps.length > 0) {
        const stepProps = command.steps.map((step, index) => ({
          capabilityId: capability.id,
          stepOrder: index,
          type: StepTypeVO.fromString(step.type),
          instructions: step.instructions,
          model: step.model,
          tools: step.tools?.map(t => ToolConfig.create(t.name, t.config)) || [],
          servers: step.servers || []
        }));

        await this.stepRepository.createMany(stepProps);

        logger.debug('[CapabilityApplicationService] steps created', {
          count: stepProps.length
        });
      }

      return { success: true, data: capability.id };
    } catch (error) {
      logger.error('[CapabilityApplicationService] createCapability error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create capability' };
    }
  }

  /**
   * Update an existing capability's metadata (name, description)
   */
  async updateCapability(
    capabilityId: number,
    command: UpdateCapabilityCommand
  ): Promise<Result<void>> {
    try {
      logger.debug('[CapabilityApplicationService] updateCapability', {
        capabilityId,
        updates: command
      });

      const id = CapabilityId.fromNumber(capabilityId);
      await this.capabilityRepository.update(id, command);

      logger.debug('[CapabilityApplicationService] capability updated', { capabilityId });

      return { success: true };
    } catch (error) {
      logger.error('[CapabilityApplicationService] updateCapability error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update capability' };
    }
  }

  /**
   * Delete a capability (cascade deletes all steps)
   */
  async deleteCapability(capabilityId: number): Promise<Result<void>> {
    try {
      logger.debug('[CapabilityApplicationService] deleteCapability', { capabilityId });

      const id = CapabilityId.fromNumber(capabilityId);
      await this.capabilityRepository.delete(id);

      logger.debug('[CapabilityApplicationService] capability deleted', { capabilityId });

      return { success: true };
    } catch (error) {
      logger.error('[CapabilityApplicationService] deleteCapability error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete capability' };
    }
  }

  /**
   * Get a capability by ID with all steps
   */
  async getCapability(capabilityId: number): Promise<Result<Capability | null>> {
    try {
      logger.debug('[CapabilityApplicationService] getCapability', { capabilityId });

      const id = CapabilityId.fromNumber(capabilityId);
      const capability = await this.capabilityRepository.findByIdWithSteps(id);

      return { success: true, data: capability };
    } catch (error) {
      logger.error('[CapabilityApplicationService] getCapability error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get capability' };
    }
  }

  /**
   * Get all capabilities for an agent
   */
  async getCapabilitiesByAgent(agentId: number): Promise<Result<Capability[]>> {
    try {
      logger.debug('[CapabilityApplicationService] getCapabilitiesByAgent', { agentId });

      const id = AgentId.fromNumber(agentId);
      const capabilities = await this.capabilityRepository.findByAgentId(id);

      logger.debug('[CapabilityApplicationService] capabilities retrieved', {
        count: capabilities.length
      });

      return { success: true, data: capabilities };
    } catch (error) {
      logger.error('[CapabilityApplicationService] getCapabilitiesByAgent error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get capabilities' };
    }
  }

  // ===== STEP MANAGEMENT =====

  /**
   * Add a new step to a capability
   */
  async addStep(
    capabilityId: number,
    stepData: {
      type: 'TOOL_STEP' | 'CODE_STEP';
      instructions: string;
      model?: string;
      tools?: Array<{ name: string; config: any }>;
      servers?: any[];
    }
  ): Promise<Result<StepId>> {
    try {
      logger.debug('[CapabilityApplicationService] addStep', {
        capabilityId,
        type: stepData.type
      });

      const id = CapabilityId.fromNumber(capabilityId);

      // Get next step order
      const stepOrder = await this.stepRepository.getNextStepOrder(id);

      const step = await this.stepRepository.create({
        capabilityId: id,
        stepOrder,
        type: StepTypeVO.fromString(stepData.type),
        instructions: stepData.instructions,
        model: stepData.model,
        tools: stepData.tools?.map(t => ToolConfig.create(t.name, t.config)) || [],
        servers: stepData.servers || []
      });

      logger.debug('[CapabilityApplicationService] step added', {
        stepId: step.id.value,
        stepOrder
      });

      return { success: true, data: step.id };
    } catch (error) {
      logger.error('[CapabilityApplicationService] addStep error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add step' };
    }
  }

  /**
   * Update an existing step
   */
  async updateStep(stepId: number, command: UpdateStepCommand): Promise<Result<void>> {
    try {
      logger.debug('[CapabilityApplicationService] updateStep', {
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

      logger.debug('[CapabilityApplicationService] step updated', { stepId });

      return { success: true };
    } catch (error) {
      logger.error('[CapabilityApplicationService] updateStep error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update step' };
    }
  }

  /**
   * Delete a step
   */
  async deleteStep(stepId: number): Promise<Result<void>> {
    try {
      logger.debug('[CapabilityApplicationService] deleteStep', { stepId });

      const id = StepId.fromNumber(stepId);
      const step = await this.stepRepository.findById(id);

      if (!step) {
        return { success: false, error: 'Step not found' };
      }

      // Delete the step
      await this.stepRepository.delete(id);

      // Reindex remaining steps
      const remainingSteps = await this.stepRepository.findByCapabilityId(step.capabilityId);
      if (remainingSteps.length > 0) {
        const reindexUpdates = remainingSteps.map((s, index) => ({
          id: s.id,
          stepOrder: index
        }));
        await this.stepRepository.updateStepOrders(reindexUpdates);
      }

      logger.debug('[CapabilityApplicationService] step deleted and remaining steps reindexed');

      return { success: true };
    } catch (error) {
      logger.error('[CapabilityApplicationService] deleteStep error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete step' };
    }
  }

  /**
   * Reorder steps within a capability
   */
  async reorderSteps(
    capabilityId: number,
    stepIds: number[]
  ): Promise<Result<void>> {
    try {
      logger.debug('[CapabilityApplicationService] reorderSteps', {
        capabilityId,
        stepIds
      });

      // Verify all steps belong to the capability
      const id = CapabilityId.fromNumber(capabilityId);
      const existingSteps = await this.stepRepository.findByCapabilityId(id);

      if (existingSteps.length !== stepIds.length) {
        return { success: false, error: 'Step count mismatch - all steps must be included in reorder' };
      }

      const existingIds = new Set(existingSteps.map(s => s.id.value));
      for (const stepId of stepIds) {
        if (!existingIds.has(stepId)) {
          return { success: false, error: `Step ${stepId} not found in capability ${capabilityId}` };
        }
      }

      // Update step orders
      const updates = stepIds.map((id, index) => ({
        id: StepId.fromNumber(id),
        stepOrder: index
      }));

      await this.stepRepository.updateStepOrders(updates);

      logger.debug('[CapabilityApplicationService] steps reordered successfully');

      return { success: true };
    } catch (error) {
      logger.error('[CapabilityApplicationService] reorderSteps error', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reorder steps' };
    }
  }
}
