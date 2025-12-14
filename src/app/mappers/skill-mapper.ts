import type { Skill, SkillParameterType, SkillInputFileConfig, SkillExecutionType, TaskModelConfig } from '@/ddd/domain/skills/entities/skill';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';
import { s3SkillAttachmentService } from '@/ddd/infrastructure/multimodal/s3-skill-attachment-service';

/**
 * DTO for Tool Configuration
 * Matches existing ToolConfigDTO from agent-mapper
 */
export interface ToolConfigDTO {
  name: string;
  config?: Record<string, any>;
}

/**
 * DTO for Skill Input
 * Defines an input parameter for a skill
 */
export interface SkillInput {
  name: string;
  required: boolean;
  type?: SkillParameterType;
  fileConfig?: SkillInputFileConfig;
  default?: any;
}

/**
 * DTO for Output Mapping
 * Configures how a skill output is saved to a table
 */
export interface OutputMapping {
  tableId: number;
  fieldId: number;
  mode: 'create' | 'update';
  rowId?: string;  // For update mode - specific row to update
}

/**
 * DTO for Skill Output
 * Defines an output value from a skill
 */
export interface SkillOutput {
  name: string;
  type?: SkillParameterType;
  mapping?: OutputMapping;  // Optional: save output to table
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
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfigDTO[];
  content?: MessagePart[]; // Skill-level attachments with pre-signed URLs
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agent' (default) or 'operation'
  taskModelConfig?: TaskModelConfigDTO; // Config for operation execution
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
