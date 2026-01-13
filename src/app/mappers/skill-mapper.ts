import type {
  Skill,
  SkillParameterType,
  SkillExecutionType,
  TaskModelConfig,
  SkillStep,
  ToolExecutionConfig,
  WriteConfig,
  InputMappingConfig,
  InputDefinition,
  OutputDefinition,
  CanvasMetadata,
  // Multi-table mapping types
  TableReference,
  FieldSource,
  RowIdSource,
} from '@/ddd/domain/skills/entities/skill';
import type { MessagePart } from '@/ddd/infrastructure/grpc/generated/agent_worker';
import { s3SkillAttachmentService } from '@/ddd/infrastructure/multimodal/s3-skill-attachment-service';

// Re-export unified types from domain
export type { InputDefinition, OutputDefinition, TableReference, FieldSource, RowIdSource };

/**
 * DTO for Tool Configuration
 * Matches existing ToolConfigDTO from agent-mapper
 */
export interface ToolConfigDTO {
  name: string;
  config?: Record<string, any>;
}

/**
 * Target field metadata for LLM guidance
 * Provides type info and constraints from the database field
 */
export interface TargetFieldMetadata {
  fieldType: string;         // Database field type: "single-select", "multi-select", "number", etc.
  options?: string[];        // For select fields: valid option values
  maxSelections?: number;    // For multi-select: maximum allowed selections
  fieldName?: string;        // Target field name (for display)
}

// =============================================================================
// Multi-Table Output Mapping Types (re-exported from domain for convenience)
// =============================================================================

/**
 * DTO for Field Mapping
 * Maps a typed source to a target table field
 */
export interface FieldMapping {
  source: FieldSource;                         // Where to get the value (typed)
  targetFieldId: number;                       // Destination field/column
  targetFieldMetadata?: TargetFieldMetadata;   // Optional: target field info for LLM guidance
  appendMode?: boolean;                        // When true, append to existing relation values instead of replacing
}

/**
 * DTO for Table Mapping
 * Ordered operation for a single table
 */
export interface TableMapping {
  order: number;                               // Execution order (1, 2, 3...)
  targetTableId: number;                       // Which table to write to
  rowAction: 'create' | 'update';              // Create or update row
  rowIdSource?: RowIdSource;                   // For update mode - typed source for row ID
  mappings: FieldMapping[];                    // Field mappings for this table
  displayFieldId?: number;                     // Field to use for relation display value
  mode?: 'single_row' | 'multi_row';           // Per-table mode (overrides config default)
}

/**
 * DTO for Output Mapping Configuration
 * Multi-table support with typed references
 */
export interface OutputMappingConfig {
  mode: 'single_row' | 'multi_row';
  tableMappings: TableMapping[];               // Ordered table operations
}

/**
 * DTO for Skill
 * Simplified single-instruction model with global skills support
 * AIDEV-NOTE: Removed steps array, replaced with single instructions field + inputs/outputs
 * Added: organizationId, agentId nullable for global skills
 * Added: content for skill-level attachments (images, files, text)
 */
/**
 * DTO for Task Model Configuration
 */
export interface TaskModelConfigDTO {
  modelId: string;
  taskType: string;
  parameters?: Record<string, any>;
}

export interface SkillDTO {
  id: number;
  organizationId: number;
  agentId: number | null; // null for global skills
  name: string;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  instructions: string;
  tools: ToolConfigDTO[];
  content?: MessagePart[]; // Skill-level attachments with pre-signed URLs
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agentic' (default), 'agent', 'operation', 'tool', or 'write'
  taskModelConfig?: TaskModelConfigDTO; // Config for 'operation' execution
  toolExecutionConfig?: ToolExecutionConfig; // Config for 'tool' execution
  writeConfig?: WriteConfig; // Config for 'write' execution
  steps?: SkillStep[]; // Steps for 'agent' (step-based) execution
  canvasMetadata?: CanvasMetadata; // Canvas annotations (sticky notes)
  isSystem: boolean; // System skills cannot be deleted by users
  createdAt: string;
  updatedAt: string;
}

/**
 * Skill Mapper
 *
 * Maps between domain entities and DTOs for API layer.
 * Provides type-safe conversions between domain and presentation layers.
 */
export class SkillMapper {
  /**
   * Convert Skill domain entity to DTO
   *
   * NOTE: Pre-signed URLs in content MessageParts may expire.
   * Consider refreshing URLs via generateSkillAttachmentUrl() action if needed.
   */
  static toDTO(skill: Skill): SkillDTO {
    return {
      id: skill.id.value,
      organizationId: skill.organizationId.value,
      agentId: skill.agentId?.value || null,
      name: skill.name,
      description: skill.description,
      inputs: skill.inputs,
      outputs: skill.outputs,
      instructions: skill.instructions,
      tools: skill.tools,
      content: skill.content,
      model: skill.model ?? null,
      agentType: skill.agentType ?? null,
      executionType: skill.executionType,
      taskModelConfig: skill.taskModelConfig,
      toolExecutionConfig: skill.toolExecutionConfig,
      writeConfig: skill.writeConfig,
      steps: skill.steps,
      canvasMetadata: skill.canvasMetadata,
      isSystem: skill.isSystem,
      createdAt: skill.createdAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString()
    };
  }

  /**
   * Convert list of Skills to DTOs
   */
  static toDTOList(skills: Skill[]): SkillDTO[] {
    return skills.map(c => this.toDTO(c));
  }
}
