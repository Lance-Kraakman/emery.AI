import { StepId } from '../value-objects/step-id';
import { SkillId } from '../value-objects/skill-id';
import { StepTypeVO } from '../value-objects/step-type';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { ServerConfig } from '@/ddd/domain/agents/entities/agent';

/**
 * Step Entity
 *
 * Represents a single step within a skill workflow.
 * Steps are ordered and can be either tool-based or code-based.
 */
export interface Step {
  readonly id: StepId;
  readonly skillId: SkillId;
  readonly stepOrder: number;
  readonly type: StepTypeVO;
  readonly instructions: string;
  readonly model?: string;
  readonly tools: ToolConfig[];
  readonly servers: ServerConfig[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Properties required to create a new Step
 */
export interface CreateStepProps {
  skillId: SkillId;
  stepOrder: number;
  type: StepTypeVO;
  instructions: string;
  model?: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
}

/**
 * Properties that can be updated on a Step
 */
export interface UpdateStepProps {
  instructions?: string;
  model?: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  stepOrder?: number;
}

/**
 * Step Entity Business Logic
 *
 * Provides factory methods and validation for Step entities.
 */
export class StepEntity {
  /**
   * Create a new Step (without ID and timestamps)
   * Used before persisting to database
   */
  static create(props: CreateStepProps): Omit<Step, 'id' | 'createdAt' | 'updatedAt'> {
    // Validation
    if (!props.instructions?.trim()) {
      throw new Error('Step instructions are required and cannot be empty');
    }
    if (props.stepOrder < 0) {
      throw new Error('Step order must be non-negative');
    }
    if (props.instructions.length > 5000) {
      throw new Error('Step instructions must be 5000 characters or less');
    }

    // Validate tools if provided
    if (props.tools && props.tools.length > 0) {
      this.validateToolsConfig(props.tools);
    }

    return {
      skillId: props.skillId,
      stepOrder: props.stepOrder,
      type: props.type,
      instructions: props.instructions.trim(),
      model: props.model,
      tools: props.tools || [],
      servers: props.servers || []
    };
  }

  /**
   * Update an existing Step
   * Returns a new Step with updated values
   */
  static update(step: Step, updates: UpdateStepProps): Step {
    // Validate updates
    if (updates.instructions !== undefined) {
      const trimmed = updates.instructions.trim();
      if (!trimmed) {
        throw new Error('Step instructions cannot be empty');
      }
      if (trimmed.length > 5000) {
        throw new Error('Step instructions must be 5000 characters or less');
      }
    }

    if (updates.stepOrder !== undefined && updates.stepOrder < 0) {
      throw new Error('Step order must be non-negative');
    }

    if (updates.tools) {
      this.validateToolsConfig(updates.tools);
    }

    return {
      ...step,
      instructions: updates.instructions !== undefined
        ? updates.instructions.trim()
        : step.instructions,
      model: updates.model !== undefined ? updates.model : step.model,
      tools: updates.tools !== undefined ? updates.tools : step.tools,
      servers: updates.servers !== undefined ? updates.servers : step.servers,
      stepOrder: updates.stepOrder !== undefined ? updates.stepOrder : step.stepOrder,
      updatedAt: new Date()
    };
  }

  /**
   * Validate tools configuration
   */
  static validateToolsConfig(tools: ToolConfig[]): void {
    for (const tool of tools) {
      if (!tool.name?.trim()) {
        throw new Error('Tool name is required and cannot be empty');
      }
      // Tool names should follow reference patterns: @doc:, @file:, @agent:, @table:, @database:, or @tool:
      if (!tool.name.startsWith('@')) {
        throw new Error(`Invalid tool name format: ${tool.name}. Must start with @ (e.g., @doc:, @tool:)`);
      }
    }
  }

  /**
   * Check if step has any tools configured
   */
  static hasTools(step: Step): boolean {
    return step.tools.length > 0;
  }

  /**
   * Check if step has any servers configured
   */
  static hasServers(step: Step): boolean {
    return step.servers.length > 0;
  }

  /**
   * Get summary of step for display
   */
  static getSummary(step: Step): string {
    const parts: string[] = [step.type.toString()];

    if (step.tools.length > 0) {
      parts.push(`${step.tools.length} tool${step.tools.length !== 1 ? 's' : ''}`);
    }

    if (step.servers.length > 0) {
      parts.push(`${step.servers.length} server${step.servers.length !== 1 ? 's' : ''}`);
    }

    return parts.join(' • ');
  }
}
