import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { MessagePart } from '@/lib/grpc/generated/agent_worker';

/**
 * Skill Execution Types
 * - 'agent' (default): LLM orchestration with tools via smolagents
 * - 'operation': Direct model invocation for single-task models (image gen, speech, etc.)
 */
export type SkillExecutionType = 'agent' | 'operation';

/**
 * Task Model Configuration
 * Used when executionType is 'operation' to bypass LLM orchestration
 * taskType is stored as string for flexibility - validated at execution time
 */
export interface TaskModelConfig {
  modelId: string;           // e.g., 'black-forest-labs/FLUX.1-schnell'
  taskType: string;          // e.g., 'text-to-image', 'speech-to-text' - validated at execution
  parameters?: Record<string, any>;  // Model-specific params (steps, guidance_scale, etc.)
}

/**
 * Skill Input/Output Types
 *
 * Expanded to align with database field types for better LLM guidance.
 * - Basic types: text, number, boolean, date, json
 * - Format-specific: email, phone
 * - Select types: single-select, multi-select (for constrained options)
 * - Media types: image, file, audio, video, document
 */
export type SkillParameterType =
  | 'text' | 'number' | 'boolean' | 'date' | 'json'
  | 'email' | 'phone'
  | 'single-select' | 'multi-select'
  | 'image' | 'file' | 'audio' | 'video' | 'document';

/**
 * File Configuration for file-type inputs
 */
export interface SkillInputFileConfig {
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  multiple?: boolean;
}

/**
 * Skill Input Definition
 */
export interface SkillInput {
  name: string;
  required: boolean;
  type?: SkillParameterType;
  fileConfig?: SkillInputFileConfig;
  default?: any; // Default value for @-mention insertion
}

// =============================================================================
// Multi-Table Output Mapping Types (typed references, no string parsing)
// =============================================================================

/**
 * Reference to a field from a previous table mapping result
 */
export interface TableReference {
  order: number;            // Which table mapping (1, 2, 3...)
  field: string;            // 'row_id' or field name from that table
}

/**
 * Typed field source - either a skill output or a reference to previous table
 * Discriminated union for type-safe source selection
 */
export type FieldSource =
  | { type: 'skill_output'; name: string }
  | { type: 'table_ref'; order: number; field: string };

/**
 * Field Mapping - maps a typed source to a target table field
 */
export interface FieldMapping {
  source: FieldSource;                  // Where to get the value (typed)
  targetFieldId: number;                // Destination field/column
}

/**
 * Table Mapping - ordered operation for a single table
 */
export interface TableMapping {
  order: number;                        // Execution order (1, 2, 3...)
  targetTableId: number;                // Which table to write to
  rowAction: 'create' | 'update';       // Create or update row
  rowId?: string;                       // For update mode - specific row ID
  mappings: FieldMapping[];             // Field mappings for this table
  displayFieldId?: number;              // Field to use for relation display value
}

/**
 * Output Mapping Configuration
 * Multi-table support with typed references
 */
export interface OutputMappingConfig {
  mode: 'single_row' | 'multi_row';
  tableMappings: TableMapping[];        // Ordered table operations
}

/**
 * Skill Output Definition
 */
export interface SkillOutput {
  name: string;
  type?: SkillParameterType;
  description?: string;  // Description of what this output contains (shown in LLM instructions)
  outputMapping?: OutputMappingConfig;  // Optional: path-based field mapping
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
 * Added: content field for definition-level attachments (images, files)
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
  readonly content?: MessagePart[]; // Skill-level attachments (images, files, text)
  readonly model?: string | null; // Optional: Override model for this skill
  readonly agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  readonly executionType?: SkillExecutionType; // 'agent' (default) or 'operation'
  readonly taskModelConfig?: TaskModelConfig; // Config for operation execution
  readonly isSystem: boolean; // System skills cannot be deleted by users
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
  content?: MessagePart[];
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agent' (default) or 'operation'
  taskModelConfig?: TaskModelConfig; // Config for operation execution
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
  content?: MessagePart[];
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agent' (default) or 'operation'
  taskModelConfig?: TaskModelConfig | null; // Config for operation execution (null to clear)
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

    const executionType = props.executionType || 'agent';

    // Instructions are required for agent execution, optional for operation mode
    if (executionType === 'agent' && !props.instructions?.trim()) {
      throw new Error('Instructions are required and cannot be empty');
    }

    // Task model config is required for operation execution
    if (executionType === 'operation' && !props.taskModelConfig) {
      throw new Error('Task model configuration is required for operation execution');
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
      instructions: props.instructions?.trim() || '',
      tools: props.tools || [],
      content: props.content,
      executionType: executionType,
      taskModelConfig: props.taskModelConfig,
      isSystem: false // User-created skills are never system skills
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

    // Determine final execution type
    const finalExecutionType = updates.executionType !== undefined
      ? updates.executionType
      : skill.executionType || 'agent';

    // Instructions validation depends on execution type
    if (updates.instructions !== undefined && finalExecutionType === 'agent' && !updates.instructions.trim()) {
      throw new Error('Instructions cannot be empty for agent execution');
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
      content: updates.content !== undefined ? updates.content : skill.content,
      executionType: updates.executionType !== undefined ? updates.executionType : skill.executionType,
      taskModelConfig: updates.taskModelConfig !== undefined
        ? (updates.taskModelConfig === null ? undefined : updates.taskModelConfig)
        : skill.taskModelConfig,
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
   * Check if skill uses operation execution (bypasses LLM orchestration)
   */
  static isOperation(skill: Skill): boolean {
    return skill.executionType === 'operation';
  }

  /**
   * Check if skill uses agent execution (LLM orchestration)
   */
  static isAgentExecution(skill: Skill): boolean {
    return !skill.executionType || skill.executionType === 'agent';
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
