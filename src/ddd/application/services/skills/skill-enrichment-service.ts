/**
 * Skill Enrichment Service
 *
 * Centralized service for loading and enriching skills for execution.
 * Used by all execution paths: chat, task execution, scheduler, button actions.
 *
 * AIDEV-NOTE: This service ensures consistent skill enrichment across all paths,
 * including executionType and taskModelConfig for operation mode support.
 */

import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import type {
  Skill,
  SkillInput,
  SkillOutput,
  ToolConfig,
  SkillExecutionType,
  TaskModelConfig
} from '@/ddd/domain/skills/entities/skill';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';

/**
 * Enriched skill format ready for gRPC transport
 */
export interface EnrichedSkill {
  id: number;
  name: string;
  description: string;
  instructions: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  tools: ToolConfig[];
  content: MessagePart[];
  model: string | null;
  agentType: string | null;
  executionType: SkillExecutionType;
  taskModelConfig?: TaskModelConfig;
}

export class SkillEnrichmentService {
  constructor(private readonly skillRepository: ISkillRepository) {}

  /**
   * Load and enrich a single skill by ID
   */
  async enrichSkill(skillId: number): Promise<EnrichedSkill | null> {
    const skill = await this.skillRepository.findById(SkillId.fromNumber(skillId));
    if (!skill) {
      return null;
    }
    return this.toEnrichedSkill(skill);
  }

  /**
   * Load and enrich multiple skills by IDs
   */
  async enrichSkills(skillIds: number[]): Promise<EnrichedSkill[]> {
    const enrichedSkills: EnrichedSkill[] = [];

    for (const skillId of skillIds) {
      const enriched = await this.enrichSkill(skillId);
      if (enriched) {
        enrichedSkills.push(enriched);
      }
    }

    return enrichedSkills;
  }

  /**
   * Convert skill entity to enriched format for gRPC transport
   */
  private toEnrichedSkill(skill: Skill): EnrichedSkill {
    return {
      id: skill.id.value,
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      inputs: skill.inputs,
      outputs: skill.outputs,
      tools: skill.tools,
      content: skill.content || [],
      model: skill.model || null,
      agentType: skill.agentType || null,
      executionType: skill.executionType || 'agent',
      taskModelConfig: skill.taskModelConfig
    };
  }
}
