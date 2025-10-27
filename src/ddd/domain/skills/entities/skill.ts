import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';

/**
 * Skill Input Definition
 */
export interface SkillInput {
  name: string;
  required: boolean;
}

/**
 * Skill Output Definition
 */
export interface SkillOutput {
  name: string;
}

/**
 * Tool Configuration
 */
export interface ToolConfig {
  name: string;
  config?: Record<string, any>;
}

/**
 * Skill Entity
 *
 * AIDEV-NOTE: Simplified single-instruction model
 * Removed: multi-step workflow (steps array)
 * Added: inputs, outputs, instructions (single text block), tools
 * Added: Global skills support (organizationId + optional agentId)
 *
 * Represents a reusable skill with natural language instructions.
 * Skills have explicit inputs/outputs and can reference tools via @ mentions.
 *
 * Skills can be:
 * - Agent-scoped: agentId is set, owned by specific agent
 * - Organization-scoped: agentId is null, reusable across all agents in organization
 */
export interface Skill {
  readonly id: SkillId;
  readonly organizationId: OrganizationId;
  readonly agentId: AgentId | null; // null for organization skills
  readonly name: string;
  readonly description: string;
  readonly inputs: SkillInput[];
  readonly outputs: SkillOutput[];
  readonly instructions: string;
  readonly tools: ToolConfig[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Properties required to create a new Skill
 */
export interface CreateSkillProps {
  organizationId: OrganizationId;
  agentId?: AgentId | null; // Optional: null or undefined for organization skills
  name: string;
  description?: string;
  inputs?: SkillInput[];
  outputs?: SkillOutput[];
  instructions: string;
  tools?: ToolConfig[];
}

/**
 * Properties that can be updated on a Skill
 */
export interface UpdateSkillProps {
  name?: string;
  description?: string;
  inputs?: SkillInput[];
  outputs?: SkillOutput[];
  instructions?: string;
  tools?: ToolConfig[];
}

/**
 * Skill Entity Business Logic
 *
 * Provides factory methods and validation for Skill entities.
 * AIDEV-NOTE: Removed all step-related methods
 */
export class SkillEntity {
  /**
   * Create a new Skill (without ID and timestamps)
   * Used before persisting to database
   */
  static create(props: CreateSkillProps): Omit<Skill, 'id' | 'createdAt' | 'updatedAt'> {
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
    if (!props.instructions?.trim()) {
      throw new Error('Instructions are required and cannot be empty');
    }

    // Validate input names
    const inputs = props.inputs || [];
    for (const input of inputs) {
      if (!input.name?.trim()) {
        throw new Error('All inputs must have non-empty names');
      }
    }

    // Validate output names
    const outputs = props.outputs || [];
    for (const output of outputs) {
      if (!output.name?.trim()) {
        throw new Error('All outputs must have non-empty names');
      }
    }

    return {
      organizationId: props.organizationId,
      agentId: props.agentId || null,
      name: props.name.trim(),
      description: props.description?.trim() || '',
      inputs: inputs,
      outputs: outputs,
      instructions: props.instructions.trim(),
      tools: props.tools || []
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

    if (updates.instructions !== undefined && !updates.instructions.trim()) {
      throw new Error('Instructions cannot be empty');
    }

    // Validate input names if provided
    if (updates.inputs) {
      for (const input of updates.inputs) {
        if (!input.name?.trim()) {
          throw new Error('All inputs must have non-empty names');
        }
      }
    }

    // Validate output names if provided
    if (updates.outputs) {
      for (const output of updates.outputs) {
        if (!output.name?.trim()) {
          throw new Error('All outputs must have non-empty names');
        }
      }
    }

    return {
      ...skill,
      name: updates.name !== undefined ? updates.name.trim() : skill.name,
      description: updates.description !== undefined ? updates.description.trim() : skill.description,
      inputs: updates.inputs !== undefined ? updates.inputs : skill.inputs,
      outputs: updates.outputs !== undefined ? updates.outputs : skill.outputs,
      instructions: updates.instructions !== undefined ? updates.instructions.trim() : skill.instructions,
      tools: updates.tools !== undefined ? updates.tools : skill.tools,
      updatedAt: new Date()
    };
  }

  /**
   * Check if skill is organization-scoped
   */
  static isOrganizationScoped(skill: Skill): boolean {
    return skill.agentId === null;
  }

  /**
   * Check if skill is agent-scoped
   */
  static isAgentScoped(skill: Skill): boolean {
    return skill.agentId !== null;
  }

  /**
   * Get skill scope label for display
   */
  static getScopeLabel(skill: Skill): string {
    return this.isOrganizationScoped(skill) ? 'Organization' : 'Agent';
  }

  /**
   * Get skill summary for display
   */
  static getSummary(skill: Skill): string {
    const parts: string[] = [];

    if (skill.inputs.length > 0) {
      parts.push(`${skill.inputs.length} input${skill.inputs.length !== 1 ? 's' : ''}`);
    }

    if (skill.outputs.length > 0) {
      parts.push(`${skill.outputs.length} output${skill.outputs.length !== 1 ? 's' : ''}`);
    }

    if (skill.tools.length > 0) {
      parts.push(`${skill.tools.length} tool${skill.tools.length !== 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No configuration';
  }
}
