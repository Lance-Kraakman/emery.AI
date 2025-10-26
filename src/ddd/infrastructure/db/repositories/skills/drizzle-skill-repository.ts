import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ICapabilityRepository } from '@/ddd/domain/capabilities/repositories/capability-repository';
import { Capability, CreateCapabilityProps, UpdateCapabilityProps } from '@/ddd/domain/capabilities/entities/capability';
import { CapabilityId } from '@/ddd/domain/capabilities/value-objects/capability-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { capabilities } from '@/lib/db/schema';
import { IStepRepository } from '@/ddd/domain/capabilities/repositories/step-repository';
import type { Step } from '@/ddd/domain/capabilities/entities/step';

/**
 * Drizzle ORM implementation of Capability Repository
 *
 * Handles persistence of Capability aggregates using PostgreSQL via Drizzle.
 * Delegates step management to IStepRepository.
 */
export class DrizzleCapabilityRepository implements ICapabilityRepository {
  constructor(
    private db: NodePgDatabase<any>,
    private stepRepository: IStepRepository
  ) {}

  async findById(id: CapabilityId): Promise<Capability | null> {
    const result = await this.db
      .select()
      .from(capabilities)
      .where(eq(capabilities.id, id.value))
      .limit(1);

    if (result.length === 0) return null;

    return this.toDomain(result[0], []);
  }

  async findByIdWithSteps(id: CapabilityId): Promise<Capability | null> {
    const capability = await this.findById(id);
    if (!capability) return null;

    const steps = await this.stepRepository.findByCapabilityId(id);

    return {
      ...capability,
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder)
    };
  }

  async findByAgentId(agentId: AgentId): Promise<Capability[]> {
    const results = await this.db
      .select()
      .from(capabilities)
      .where(eq(capabilities.agentId, agentId.value));

    // Load steps for each capability
    const capsWithSteps = await Promise.all(
      results.map(async (cap) => {
        const steps = await this.stepRepository.findByCapabilityId(
          CapabilityId.fromNumber(cap.id)
        );
        return this.toDomain(cap, steps);
      })
    );

    return capsWithSteps;
  }

  async create(props: CreateCapabilityProps): Promise<Capability> {
    const now = new Date();
    const result = await this.db
      .insert(capabilities)
      .values({
        agentId: props.agentId.value,
        name: props.name,
        description: props.description || '',
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return this.toDomain(result[0], []);
  }

  async update(id: CapabilityId, updates: UpdateCapabilityProps): Promise<Capability> {
    const updateData: any = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    const result = await this.db
      .update(capabilities)
      .set(updateData)
      .where(eq(capabilities.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Capability ${id.value} not found`);
    }

    // Load current steps
    const steps = await this.stepRepository.findByCapabilityId(id);

    return this.toDomain(result[0], steps);
  }

  async delete(id: CapabilityId): Promise<void> {
    // Cascade delete will handle steps automatically via foreign key
    await this.db
      .delete(capabilities)
      .where(eq(capabilities.id, id.value));
  }

  async deleteByAgentId(agentId: AgentId): Promise<void> {
    // Cascade delete will handle steps automatically
    await this.db
      .delete(capabilities)
      .where(eq(capabilities.agentId, agentId.value));
  }

  async exists(id: CapabilityId): Promise<boolean> {
    const result = await this.db
      .select({ id: capabilities.id })
      .from(capabilities)
      .where(eq(capabilities.id, id.value))
      .limit(1);

    return result.length > 0;
  }

  async countByAgentId(agentId: AgentId): Promise<number> {
    const results = await this.db
      .select()
      .from(capabilities)
      .where(eq(capabilities.agentId, agentId.value));

    return results.length;
  }

  /**
   * Convert database record to domain Capability entity
   */
  private toDomain(record: any, steps: Step[]): Capability {
    return {
      id: CapabilityId.fromNumber(record.id),
      agentId: AgentId.fromNumber(record.agentId),
      name: record.name,
      description: record.description || '',
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}
