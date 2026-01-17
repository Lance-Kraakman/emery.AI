import { eq, and, or, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { Skill, CreateSkillProps, UpdateSkillProps } from '@/ddd/domain/skills/entities/skill';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { skills } from '@/ddd/infrastructure/db/schema';

/**
 * Drizzle ORM implementation of SkillRepository
 *
 * AIDEV-NOTE: Simplified to handle single-instruction skills with organization skills support
 * Removed: IStepRepository dependency and all step-related methods
 * Added: inputs, outputs, instructions, tools fields
 * Added: Organization skills support (organizationId, nullable agentId)
 *
 * Handles persistence of Skill aggregates using PostgreSQL via Drizzle.
 * Supports both agent-scoped skills (agentId set) and organization skills (agentId null).
 */
export class DrizzleSkillRepository implements ISkillRepository {
  constructor(
    private db: NodePgDatabase<any>
  ) {}

  async findById(id: SkillId): Promise<Skill | null> {
    const result = await this.db
      .select()
      .from(skills)
      .where(eq(skills.id, id.value))
      .limit(1);

    if (result.length === 0) return null;

    return this.toDomain(result[0]);
  }

  async findByAgentId(agentId: AgentId): Promise<Skill[]> {
    const results = await this.db
      .select()
      .from(skills)
      .where(
        or(
          eq(skills.agentId, agentId.value),
          eq(skills.isSystem, true)
        )
      );

    return results.map(record => this.toDomain(record));
  }

  async findOrganizationSkills(organizationId: OrganizationId): Promise<Skill[]> {
    const results = await this.db
      .select()
      .from(skills)
      .where(
        or(
          and(
            eq(skills.organizationId, organizationId.value),
            isNull(skills.agentId)
          ),
          eq(skills.isSystem, true)
        )
      );

    return results.map(record => this.toDomain(record));
  }

  async findByOrganizationId(organizationId: OrganizationId): Promise<Skill[]> {
    const results = await this.db
      .select()
      .from(skills)
      .where(
        or(
          eq(skills.organizationId, organizationId.value),
          eq(skills.isSystem, true)
        )
      );

    return results.map(record => this.toDomain(record));
  }

  async create(props: CreateSkillProps): Promise<Skill> {
    const now = new Date();
    const result = await this.db
      .insert(skills)
      .values({
        organizationId: props.organizationId.value,
        agentId: props.agentId?.value || null, // null for organization skills
        name: props.name,
        description: props.description || '',
        inputs: props.inputs || [],
        outputs: props.outputs || [],
        instructions: props.instructions || '',
        tools: props.tools || [],
        content: props.content || null,
        model: props.model ?? null,
        agentType: props.agentType ?? null,
        executionType: props.executionType || 'agentic',
        taskModelConfig: props.taskModelConfig || null,
        toolExecutionConfig: props.toolExecutionConfig || null,
        writeConfig: props.writeConfig || null,
        readConfig: props.readConfig || null,
        steps: props.steps || null,
        canvasMetadata: props.canvasMetadata || null,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return this.toDomain(result[0]);
  }

  async update(id: SkillId, updates: UpdateSkillProps): Promise<Skill> {
    console.log('[DrizzleSkillRepository] update called with:', {
      skillId: id.value,
      stepsProvided: updates.steps !== undefined,
      steps: updates.steps,
      stepsLength: updates.steps?.length
    });
    const updateData: any = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.inputs !== undefined) {
      updateData.inputs = updates.inputs;
    }
    if (updates.outputs !== undefined) {
      updateData.outputs = updates.outputs;
    }
    if (updates.instructions !== undefined) {
      updateData.instructions = updates.instructions;
    }
    if (updates.tools !== undefined) {
      updateData.tools = updates.tools;
    }
    if (updates.content !== undefined) {
      updateData.content = updates.content;
    }
    if (updates.model !== undefined) {
      updateData.model = updates.model;
    }
    if (updates.agentType !== undefined) {
      updateData.agentType = updates.agentType;
    }
    if (updates.executionType !== undefined) {
      updateData.executionType = updates.executionType;
    }
    if (updates.taskModelConfig !== undefined) {
      updateData.taskModelConfig = updates.taskModelConfig;
    }
    if (updates.toolExecutionConfig !== undefined) {
      updateData.toolExecutionConfig = updates.toolExecutionConfig;
    }
    if (updates.writeConfig !== undefined) {
      updateData.writeConfig = updates.writeConfig;
    }
    if (updates.readConfig !== undefined) {
      updateData.readConfig = updates.readConfig;
    }
    if (updates.steps !== undefined) {
      updateData.steps = updates.steps;
      console.log('[DrizzleSkillRepository] Setting updateData.steps:', updateData.steps);
    }
    if (updates.canvasMetadata !== undefined) {
      updateData.canvasMetadata = updates.canvasMetadata;
    }

    console.log('[DrizzleSkillRepository] Final updateData keys:', Object.keys(updateData));

    const result = await this.db
      .update(skills)
      .set(updateData)
      .where(eq(skills.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Skill ${id.value} not found`);
    }

    return this.toDomain(result[0]);
  }

  async updateAgent(id: SkillId, agentId: AgentId | null): Promise<Skill> {
    const result = await this.db
      .update(skills)
      .set({
        agentId: agentId?.value || null,
        ownerId: agentId ? null : undefined, // Clear ownerId when moving to agent (inherits from agent)
        updatedAt: new Date(),
      })
      .where(eq(skills.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Skill ${id.value} not found`);
    }

    return this.toDomain(result[0]);
  }

  async delete(id: SkillId): Promise<void> {
    await this.db
      .delete(skills)
      .where(eq(skills.id, id.value));
  }

  async deleteByAgentId(agentId: AgentId): Promise<void> {
    await this.db
      .delete(skills)
      .where(eq(skills.agentId, agentId.value));
  }

  async exists(id: SkillId): Promise<boolean> {
    const result = await this.db
      .select({ id: skills.id })
      .from(skills)
      .where(eq(skills.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async countByAgentId(agentId: AgentId): Promise<number> {
    const results = await this.db
      .select()
      .from(skills)
      .where(eq(skills.agentId, agentId.value));

    return results.length;
  }

  async countOrganizationSkills(organizationId: OrganizationId): Promise<number> {
    const results = await this.db
      .select()
      .from(skills)
      .where(
        or(
          and(
                eq(skills.organizationId, organizationId.value),
                isNull(skills.agentId)
              ),
          eq(skills.isSystem, true)
        )
      )
      ;

    return results.length;
  }

  /**
   * Convert database record to domain Skill entity
   */
  private toDomain(record: any): Skill {
    return {
      id: SkillId.fromNumber(record.id),
      organizationId: OrganizationId.fromNumber(record.organizationId),
      agentId: record.agentId ? AgentId.fromNumber(record.agentId) : null,
      name: record.name,
      description: record.description || '',
      inputs: record.inputs || [],
      outputs: record.outputs || [],
      instructions: record.instructions || '',
      tools: record.tools || [],
      content: record.content || undefined,
      model: record.model ?? null,
      agentType: record.agentType ?? null,
      executionType: record.executionType || 'agentic',
      taskModelConfig: record.taskModelConfig || undefined,
      toolExecutionConfig: record.toolExecutionConfig || undefined,
      writeConfig: record.writeConfig || undefined,
      readConfig: record.readConfig || undefined,
      steps: record.steps || undefined,
      canvasMetadata: record.canvasMetadata || undefined,
      isSystem: record.isSystem ?? false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}
