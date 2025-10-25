import { CapabilityId } from '../value-objects/capability-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { Step } from './step';
import { StepId } from '../value-objects/step-id';

/**
 * Capability Entity
 *
 * Represents a multi-step workflow that an agent can perform.
 * Capabilities define structured tasks with ordered steps.
 */
export interface Capability {
  readonly id: CapabilityId;
  readonly agentId: AgentId;
  readonly name: string;
  readonly description: string;
  readonly steps: Step[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Properties required to create a new Capability
 */
export interface CreateCapabilityProps {
  agentId: AgentId;
  name: string;
  description: string;
}

/**
 * Properties that can be updated on a Capability
 */
export interface UpdateCapabilityProps {
  name?: string;
  description?: string;
}

/**
 * Capability Entity Business Logic
 *
 * Provides factory methods and validation for Capability entities.
 */
export class CapabilityEntity {
  /**
   * Create a new Capability (without ID, steps, and timestamps)
   * Used before persisting to database
   */
  static create(props: CreateCapabilityProps): Omit<Capability, 'id' | 'steps' | 'createdAt' | 'updatedAt'> {
    // Validation
    if (!props.name?.trim()) {
      throw new Error('Capability name is required and cannot be empty');
    }
    if (props.name.length > 255) {
      throw new Error('Capability name must be 255 characters or less');
    }
    if (props.description && props.description.length > 1000) {
      throw new Error('Capability description must be 1000 characters or less');
    }

    return {
      agentId: props.agentId,
      name: props.name.trim(),
      description: props.description?.trim() || ''
    };
  }

  /**
   * Update an existing Capability
   * Returns a new Capability with updated values
   */
  static update(capability: Capability, updates: UpdateCapabilityProps): Capability {
    // Validation
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Capability name cannot be empty');
      }
      if (trimmed.length > 255) {
        throw new Error('Capability name must be 255 characters or less');
      }
    }

    if (updates.description !== undefined && updates.description.length > 1000) {
      throw new Error('Capability description must be 1000 characters or less');
    }

    return {
      ...capability,
      name: updates.name !== undefined ? updates.name.trim() : capability.name,
      description: updates.description !== undefined ? updates.description.trim() : capability.description,
      updatedAt: new Date()
    };
  }

  /**
   * Reorder steps within a capability
   * Validates that all step IDs are present and returns updated capability
   */
  static reorderSteps(capability: Capability, newOrder: StepId[]): Capability {
    // Validate all step IDs are present
    const stepIds = new Set(capability.steps.map(s => s.id.value));
    for (const id of newOrder) {
      if (!stepIds.has(id.value)) {
        throw new Error(`Step ${id.value} not found in capability`);
      }
    }
    if (newOrder.length !== capability.steps.length) {
      throw new Error('All steps must be included in reorder operation');
    }

    // Create new steps array in specified order with updated stepOrder
    const stepsById = new Map(capability.steps.map(s => [s.id.value, s]));
    const reorderedSteps = newOrder.map((id, index) => ({
      ...stepsById.get(id.value)!,
      stepOrder: index,
      updatedAt: new Date()
    }));

    return {
      ...capability,
      steps: reorderedSteps,
      updatedAt: new Date()
    };
  }

  /**
   * Add a step to a capability
   * Step will be added at the end
   */
  static addStep(capability: Capability, step: Step): Capability {
    // Verify step belongs to this capability
    if (step.capabilityId.value !== capability.id.value) {
      throw new Error('Step does not belong to this capability');
    }

    return {
      ...capability,
      steps: [...capability.steps, step],
      updatedAt: new Date()
    };
  }

  /**
   * Remove a step from a capability
   */
  static removeStep(capability: Capability, stepId: StepId): Capability {
    const filteredSteps = capability.steps.filter(s => s.id.value !== stepId.value);

    if (filteredSteps.length === capability.steps.length) {
      throw new Error(`Step ${stepId.value} not found in capability`);
    }

    // Reindex remaining steps
    const reindexedSteps = filteredSteps.map((step, index) => ({
      ...step,
      stepOrder: index,
      updatedAt: new Date()
    }));

    return {
      ...capability,
      steps: reindexedSteps,
      updatedAt: new Date()
    };
  }

  /**
   * Check if capability has any steps
   */
  static hasSteps(capability: Capability): boolean {
    return capability.steps.length > 0;
  }

  /**
   * Get total number of tools across all steps
   */
  static getTotalToolCount(capability: Capability): number {
    return capability.steps.reduce((total, step) => total + step.tools.length, 0);
  }

  /**
   * Get capability summary for display
   */
  static getSummary(capability: Capability): string {
    const stepCount = capability.steps.length;
    const toolCount = this.getTotalToolCount(capability);

    const parts: string[] = [];

    if (stepCount > 0) {
      parts.push(`${stepCount} step${stepCount !== 1 ? 's' : ''}`);
    }

    if (toolCount > 0) {
      parts.push(`${toolCount} total tool${toolCount !== 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No steps configured';
  }
}
