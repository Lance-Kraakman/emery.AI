import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { Skill, CreateSkillProps, UpdateSkillProps } from '@/ddd/domain/skills/entities/skill';
import { SkillId } from '@/ddd/domain/skills/value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { skills } from '@/lib/db/schema';
import { IStepRepository } from '@/ddd/domain/skills/repositories/step-repository';
import type { Step } from '@/ddd/domain/skills/entities/step';

/**
 * Drizzle ORM implementation of SkillRepository
 *
 * Handles persistence of Skillaggregates using PostgreSQL via Drizzle.
 * Delegates step management to IStepRepository.
 */
export class DrizzleSkillRepository implements ISkillRepository {
  constructor(
    private db: NodePgDatabase<any>,
    private stepRepository: IStepRepository
  ) {}

  async findById(id: SkillId): Promise<Skill | null> {
    const result = await this.db
      .select()
      .from(skills)
      .where(eq(skills.id, id.value))
      .limit(1);

    if (result.length === 0) return null;

    return this.toDomain(result[0], []);
  }

  async findByIdWithSteps(id: SkillId): Promise<Skill | null> {
    const skill = await this.findById(id);
    if (!skill) return null;

    const steps = await this.stepRepository.findBySkillId(id);

    return {
      ...skill,
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder)
    };
  }

  async findByAgentId(agentId: AgentId): Promise<Skill[]> {
    const results = await this.db
      .select()
      .from(skills)
      .where(eq(skills.agentId, agentId.value));

    // Load steps for each skill
    const skillsWithSteps = await Promise.all(
      results.map(async (skillRecord) => {
        const steps = await this.stepRepository.findBySkillId(
          SkillId.fromNumber(skillRecord.id)
        );
        return this.toDomain(skillRecord, steps);
      })
    );

    return skillsWithSteps;
  }

  async create(props: CreateSkillProps): Promise<Skill> {
    const now = new Date();
    const result = await this.db
      .insert(skills)
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

  async update(id: SkillId, updates: UpdateSkillProps): Promise<Skill> {
    const updateData: any = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    const result = await this.db
      .update(skills)
      .set(updateData)
      .where(eq(skills.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Skill ${id.value} not found`);
    }

    // Load current steps
    const steps = await this.stepRepository.findBySkillId(id);

    return this.toDomain(result[0], steps);
  }

  async delete(id: SkillId): Promise<void> {
    // Cascade delete will handle steps automatically via foreign key
    await this.db
      .delete(skills)
      .where(eq(skills.id, id.value));
  }

  async deleteByAgentId(agentId: AgentId): Promise<void> {
    // Cascade delete will handle steps automatically
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

  /**
   * Convert database record to domain Skillentity
   */
  private toDomain(record: any, steps: Step[]): Skill{
    return {
      id: SkillId.fromNumber(record.id),
      agentId: AgentId.fromNumber(record.agentId),
      name: record.name,
      description: record.description || '',
      steps: steps.sort((a, b) => a.stepOrder - b.stepOrder),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}
