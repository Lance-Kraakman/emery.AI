import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IStepRepository } from '@/ddd/domain/skills/repositories/step-repository';
import { Step, CreateStepProps, UpdateStepProps } from '@/ddd/domain/skills/entities/step';
import { StepId } from '@/ddd/domain/skills/value-objects/step-id';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { StepTypeVO } from '@/ddd/domain/skills/value-objects/step-type';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { skillSteps } from '@/lib/db/schema';

/**
 * Drizzle ORM implementation of Step Repository
 *
 * Handles persistence of Step entities using PostgreSQL via Drizzle.
 */
export class DrizzleStepRepository implements IStepRepository {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: StepId): Promise<Step | null> {
    const result = await this.db
      .select()
      .from(skillSteps)
      .where(eq(skillSteps.id, id.value))
      .limit(1);

    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  async findBySkillId(skillId: SkillId): Promise<Step[]> {
    const results = await this.db
      .select()
      .from(skillSteps)
      .where(eq(skillSteps.skillId, skillId.value))
      .orderBy(skillSteps.stepOrder);

    return results.map(r => this.toDomain(r));
  }

  async create(props: CreateStepProps): Promise<Step> {
    const now = new Date();
    const result = await this.db
      .insert(skillSteps)
      .values({
        skillId: props.skillId.value,
        stepOrder: props.stepOrder,
        type: props.type.toString(),
        instructions: props.instructions,
        model: props.model || null,
        tools: JSON.stringify(props.tools?.map(t => t.toPlain()) || []),
        servers: JSON.stringify(props.servers || []),
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return this.toDomain(result[0]);
  }

  async update(id: StepId, updates: UpdateStepProps): Promise<Step> {
    const updateData: any = { updatedAt: new Date() };

    if (updates.instructions !== undefined) {
      updateData.instructions = updates.instructions;
    }
    if (updates.model !== undefined) {
      updateData.model = updates.model || null;
    }
    if (updates.tools !== undefined) {
      updateData.tools = JSON.stringify(updates.tools.map(t => t.toPlain()));
    }
    if (updates.servers !== undefined) {
      updateData.servers = JSON.stringify(updates.servers);
    }
    if (updates.stepOrder !== undefined) {
      updateData.stepOrder = updates.stepOrder;
    }

    const result = await this.db
      .update(skillSteps)
      .set(updateData)
      .where(eq(skillSteps.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Step ${id.value} not found`);
    }

    return this.toDomain(result[0]);
  }

  async delete(id: StepId): Promise<void> {
    await this.db
      .delete(skillSteps)
      .where(eq(skillSteps.id, id.value));
  }

  async deleteBySkillId(skillId: SkillId): Promise<void> {
    await this.db
      .delete(skillSteps)
      .where(eq(skillSteps.skillId, skillId.value));
  }

  async createMany(steps: CreateStepProps[]): Promise<Step[]> {
    if (steps.length === 0) return [];

    const now = new Date();
    const values = steps.map(s => ({
      skillId: s.skillId.value,
      stepOrder: s.stepOrder,
      type: s.type.toString(),
      instructions: s.instructions,
      model: s.model || null,
      tools: JSON.stringify(s.tools?.map(t => t.toPlain()) || []),
      servers: JSON.stringify(s.servers || []),
      createdAt: now,
      updatedAt: now
    }));

    const results = await this.db
      .insert(skillSteps)
      .values(values)
      .returning();

    return results.map(r => this.toDomain(r));
  }

  async updateStepOrders(updates: Array<{ id: StepId; stepOrder: number }>): Promise<void> {
    // Batch update step orders
    await Promise.all(
      updates.map(({ id, stepOrder }) =>
        this.db
          .update(skillSteps)
          .set({ stepOrder, updatedAt: new Date() })
          .where(eq(skillSteps.id, id.value))
      )
    );
  }

  async getNextStepOrder(skillId: SkillId): Promise<number> {
    const steps = await this.findBySkillId(skillId);
    return steps.length;
  }

  async countBySkillId(skillId: SkillId): Promise<number> {
    const steps = await this.findBySkillId(skillId);
    return steps.length;
  }

  /**
   * Convert database record to domain Step entity
   */
  private toDomain(record: any): Step {
    // Parse tools from JSONB
    const toolsData = typeof record.tools === 'string' ? JSON.parse(record.tools) : record.tools;
    const tools = Array.isArray(toolsData)
      ? toolsData.map((t: any) => ToolConfig.fromPlain(t))
      : [];

    // Parse servers from JSONB
    const serversData = typeof record.servers === 'string' ? JSON.parse(record.servers) : record.servers;
    const servers = Array.isArray(serversData) ? serversData : [];

    return {
      id: StepId.fromNumber(record.id),
      skillId: SkillId.fromNumber(record.skillId),
      stepOrder: record.stepOrder,
      type: StepTypeVO.fromString(record.type),
      instructions: record.instructions,
      model: record.model || undefined,
      tools,
      servers,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}
