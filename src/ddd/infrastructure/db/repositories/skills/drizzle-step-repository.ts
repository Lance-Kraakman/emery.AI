import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IStepRepository } from '@/ddd/domain/capabilities/repositories/step-repository';
import { Step, CreateStepProps, UpdateStepProps } from '@/ddd/domain/capabilities/entities/step';
import { StepId } from '@/ddd/domain/capabilities/value-objects/step-id';
import { CapabilityId } from '@/ddd/domain/capabilities/value-objects/capability-id';
import { StepTypeVO } from '@/ddd/domain/capabilities/value-objects/step-type';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { capabilitySteps } from '@/lib/db/schema';

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
      .from(capabilitySteps)
      .where(eq(capabilitySteps.id, id.value))
      .limit(1);

    return result.length > 0 ? this.toDomain(result[0]) : null;
  }

  async findByCapabilityId(capabilityId: CapabilityId): Promise<Step[]> {
    const results = await this.db
      .select()
      .from(capabilitySteps)
      .where(eq(capabilitySteps.capabilityId, capabilityId.value))
      .orderBy(capabilitySteps.stepOrder);

    return results.map(r => this.toDomain(r));
  }

  async create(props: CreateStepProps): Promise<Step> {
    const now = new Date();
    const result = await this.db
      .insert(capabilitySteps)
      .values({
        capabilityId: props.capabilityId.value,
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
      .update(capabilitySteps)
      .set(updateData)
      .where(eq(capabilitySteps.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Step ${id.value} not found`);
    }

    return this.toDomain(result[0]);
  }

  async delete(id: StepId): Promise<void> {
    await this.db
      .delete(capabilitySteps)
      .where(eq(capabilitySteps.id, id.value));
  }

  async deleteByCapabilityId(capabilityId: CapabilityId): Promise<void> {
    await this.db
      .delete(capabilitySteps)
      .where(eq(capabilitySteps.capabilityId, capabilityId.value));
  }

  async createMany(steps: CreateStepProps[]): Promise<Step[]> {
    if (steps.length === 0) return [];

    const now = new Date();
    const values = steps.map(s => ({
      capabilityId: s.capabilityId.value,
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
      .insert(capabilitySteps)
      .values(values)
      .returning();

    return results.map(r => this.toDomain(r));
  }

  async updateStepOrders(updates: Array<{ id: StepId; stepOrder: number }>): Promise<void> {
    // Batch update step orders
    await Promise.all(
      updates.map(({ id, stepOrder }) =>
        this.db
          .update(capabilitySteps)
          .set({ stepOrder, updatedAt: new Date() })
          .where(eq(capabilitySteps.id, id.value))
      )
    );
  }

  async getNextStepOrder(capabilityId: CapabilityId): Promise<number> {
    const steps = await this.findByCapabilityId(capabilityId);
    return steps.length;
  }

  async countByCapabilityId(capabilityId: CapabilityId): Promise<number> {
    const steps = await this.findByCapabilityId(capabilityId);
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
      capabilityId: CapabilityId.fromNumber(record.capabilityId),
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
