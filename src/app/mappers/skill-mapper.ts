import type { Skill } from '@/ddd/domain/skills/entities/skill';
import type { Step } from '@/ddd/domain/skills/entities/step';

/**
 * DTO for Tool Configuration
 * Matches existing ToolConfigDTO from agent-mapper
 */
export interface ToolConfigDTO {
  name: string;
  config: Record<string, any>;
}

/**
 * DTO for Step
 * Serializable representation of Step entity for API responses
 */
export interface StepDTO {
  id: number;
  skillId: number;
  stepOrder: number;
  type: 'TOOL_STEP' | 'CODE_STEP';
  instructions: string;
  model?: string;
  tools: ToolConfigDTO[];
  servers: any[];
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for Skill
 * Serializable representation of Skill aggregate for API responses
 */
export interface SkillDTO {
  id: number;
  agentId: number;
  name: string;
  description: string;
  steps: StepDTO[];
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
      steps: skill.steps.map(s => this.stepToDTO(s)),
      createdAt: skill.createdAt.toISOString(),
      updatedAt: skill.updatedAt.toISOString()
    };
  }

  /**
   * Convert Step domain entity to DTO
   */
  static stepToDTO(step: Step): StepDTO {
    return {
      id: step.id.value,
      skillId: step.skillId.value,
      stepOrder: step.stepOrder,
      type: step.type.value,
      instructions: step.instructions,
      model: step.model,
      tools: step.tools.map(t => t.toPlain()),
      servers: step.servers,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString()
    };
  }

  /**
   * Convert list of Skills to DTOs
   */
  static toDTOList(skills: Skill[]): SkillDTO[] {
    return skills.map(c => this.toDTO(c));
  }

  /**
   * Convert list of Steps to DTOs
   */
  static stepsToDTOList(steps: Step[]): StepDTO[] {
    return steps.map(s => this.stepToDTO(s));
  }
}
