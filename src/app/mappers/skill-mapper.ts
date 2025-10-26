import type { Skill } from '@/ddd/domain/skills/entities/skill';

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
}

/**
 * DTO for Skill Output
 * Defines an output value from a skill
 */
export interface SkillOutput {
  name: string;
}

/**
 * DTO for Skill
 * Simplified single-instruction model
 * AIDEV-NOTE: Removed steps array, replaced with single instructions field + inputs/outputs
 */
export interface SkillDTO {
  id: number;
  agentId: number;
  name: string;
  description: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfigDTO[];
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
   */
  static toDTO(skill: Skill): SkillDTO {
    return {
      id: skill.id.value,
      agentId: skill.agentId.value,
      name: skill.name,
      description: skill.description,
      inputs: skill.inputs,
      outputs: skill.outputs,
      instructions: skill.instructions,
      tools: skill.tools,
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
