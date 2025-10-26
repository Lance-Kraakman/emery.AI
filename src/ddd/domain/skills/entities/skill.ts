import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { Step } from './step';
import { StepId } from '../value-objects/step-id';

/**
 * Skill Entity
 *
 * Represents a multi-step workflow that an agent can perform.
 * Skills define structured tasks with ordered steps.
 */
export interface Skill {
  readonly id: SkillId;
  readonly agentId: AgentId;
  readonly name: string;
  readonly description: string;
  readonly steps: Step[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Properties required to create a new Skill
 */
export interface CreateSkillProps {
  agentId: AgentId;
  name: string;
  description: string;
}

/**
 * Properties that can be updated on a Skill
 */
export interface UpdateSkillProps {
  name?: string;
  description?: string;
}

/**
 * Skill Entity Business Logic
 *
 * Provides factory methods and validation for Skill entities.
 */
export class SkillEntity {
  /**
   * Create a new Skill (without ID, steps, and timestamps)
   * Used before persisting to database
   */
  static create(props: CreateSkillProps): Omit<Skill, 'id' | 'steps' | 'createdAt' | 'updatedAt'> {
    // Validation
    if (!props.name?.trim()) {
      throw new Error('Skill name is required and cannot be empty');
    }
    if (props.name.length > 255) {
      throw new Error('Skill name must be 255 characters or less');
    }
    if (props.description && props.description.length > 1000) {
      throw new Error('Skill description must be 1000 characters or less');
    }

    return {
      agentId: props.agentId,
      name: props.name.trim(),
      description: props.description?.trim() || ''
    };
  }

  /**
   * Update an existing Skill
   * Returns a new Skill with updated values
   */
  static update(skill: Skill, updates: UpdateSkillProps): Skill {
    // Validation
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Skill name cannot be empty');
      }
      if (trimmed.length > 255) {
        throw new Error('Skill name must be 255 characters or less');
      }
    }

    if (updates.description !== undefined && updates.description.length > 1000) {
      throw new Error('Skill description must be 1000 characters or less');
    }

    return {
      ...skill,
      name: updates.name !== undefined ? updates.name.trim() : skill.name,
      description: updates.description !== undefined ? updates.description.trim() : skill.description,
      updatedAt: new Date()
    };
  }

  /**
   * Reorder steps within a skill
   * Validates that all step IDs are present and returns updated skill
   */
  static reorderSteps(skill: Skill, newOrder: StepId[]): Skill {
    // Validate all step IDs are present
    const stepIds = new Set(skill.steps.map(s => s.id.value));
    for (const id of newOrder) {
      if (!stepIds.has(id.value)) {
        throw new Error(`Step ${id.value} not found in skill`);
      }
    }
    if (newOrder.length !== skill.steps.length) {
      throw new Error('All steps must be included in reorder operation');
    }

    // Create new steps array in specified order with updated stepOrder
    const stepsById = new Map(skill.steps.map(s => [s.id.value, s]));
    const reorderedSteps = newOrder.map((id, index) => ({
      ...stepsById.get(id.value)!,
      stepOrder: index,
      updatedAt: new Date()
    }));

    return {
      ...skill,
      steps: reorderedSteps,
      updatedAt: new Date()
    };
  }

  /**
   * Add a step to a skill
   * Step will be added at the end
   */
  static addStep(skill: Skill, step: Step): Skill {
    // Verify step belongs to this skill
    if (step.skillId.value !== skill.id.value) {
      throw new Error('Step does not belong to this skill');
    }

    return {
      ...skill,
      steps: [...skill.steps, step],
      updatedAt: new Date()
    };
  }

  /**
   * Remove a step from a skill
   */
  static removeStep(skill: Skill, stepId: StepId): Skill {
    const filteredSteps = skill.steps.filter(s => s.id.value !== stepId.value);

    if (filteredSteps.length === skill.steps.length) {
      throw new Error(`Step ${stepId.value} not found in skill`);
    }

    // Reindex remaining steps
    const reindexedSteps = filteredSteps.map((step, index) => ({
      ...step,
      stepOrder: index,
      updatedAt: new Date()
    }));

    return {
      ...skill,
      steps: reindexedSteps,
      updatedAt: new Date()
    };
  }

  /**
   * Check if skill has any steps
   */
  static hasSteps(skill: Skill): boolean {
    return skill.steps.length > 0;
  }

  /**
   * Get total number of tools across all steps
   */
  static getTotalToolCount(skill: Skill): number {
    return skill.steps.reduce((total, step) => total + step.tools.length, 0);
  }

  /**
   * Get skill summary for display
   */
  static getSummary(skill: Skill): string {
    const stepCount = skill.steps.length;
    const toolCount = this.getTotalToolCount(skill);

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
