// AIDEV-NOTE: Drizzle implementation of Agent repository
// Handles data persistence for Agent domain entities

import type { IAgentRepository, CreateAgentData, UpdateAgentData } from '@/ddd/domain/agents/repositories/agent-repository';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { AgentFactory } from '@/ddd/domain/agents/entities/agent';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import { agents } from '@/lib/db/schema';
import { eq, and, isNotNull, sql, ne } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { AgentId, OrganizationId, UserId, AgentStatus, ApiKey } from '@/ddd/domain/shared/value-objects';
import type { DbClient } from '@/lib/db/client';

type AgentRow = InferSelectModel<typeof agents>;

export class DrizzleAgentRepository
  extends DrizzleBaseRepository<Agent, AgentId, CreateAgentData, UpdateAgentData, AgentRow>
  implements IAgentRepository {
  
  protected readonly table = agents;
  protected readonly idColumn = agents.id;
  protected readonly organizationColumn = agents.organizationId;

  async create(data: CreateAgentData): Promise<Agent> {
    const [record] = await this.db
      .insert(agents)
      .values(data)
      .returning();
    
    return this.fromPersistence(record);
  }
  
  async update(id: AgentId, data: UpdateAgentData): Promise<Agent> {
    const [record] = await this.db
      .update(agents)
      .set(data)
      .where(eq(agents.id, id.value))
      .returning();
    
    if (!record) {
      throw new Error(`Agent with id ${id.value} not found`);
    }
    
    return this.fromPersistence(record);
  }

  // Inherits findById from base class
  // Inherits findByOrganization from base class
  // Inherits delete from base class

  async findByOwner(ownerId: UserId): Promise<Agent[]> {
    const results: AgentRow[] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.ownerId, ownerId.value));

    return results.map(result => this.fromPersistence(result));
  }

  async findActiveByOrganization(organizationId: OrganizationId): Promise<Agent[]> {
    const results: AgentRow[] = await this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, organizationId.value),
          eq(agents.status, 'active')
        )
      );

    return results.map(result => this.fromPersistence(result));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .select({ count: agents.id })
      .from(agents)
      .where(eq(agents.organizationId, organizationId.value));

    return result.length;
  }

  async findActiveAgentsWithTriggers(organizationId?: OrganizationId): Promise<Agent[]> {
    const conditions = [
      eq(agents.status, 'active'),
      isNotNull(agents.trigger),
      // Ensure trigger is not empty JSON object
      sql`jsonb_typeof(${agents.trigger}) = 'object' AND jsonb_array_length(jsonb_object_keys(${agents.trigger})) > 0`
    ];

    if (organizationId) {
      conditions.push(eq(agents.organizationId, organizationId.value));
    }

    const results: AgentRow[] = await this.db
      .select()
      .from(agents)
      .where(and(...conditions));

    return results.map(result => this.fromPersistence(result));
  }

  async findAgentsWithTriggers(organizationId?: OrganizationId): Promise<Agent[]> {
    const conditions = [
      isNotNull(agents.trigger),
      // Ensure trigger is not empty JSON object
      sql`jsonb_typeof(${agents.trigger}) = 'object' AND jsonb_array_length(jsonb_object_keys(${agents.trigger})) > 0`
    ];

    if (organizationId) {
      conditions.push(eq(agents.organizationId, organizationId.value));
    }

    const results: AgentRow[] = await this.db
      .select()
      .from(agents)
      .where(and(...conditions));

    return results.map(result => this.fromPersistence(result));
  }

  protected fromPersistence(record: any): Agent {
    return AgentFactory.fromPersistence(record);
  }
  
  protected toPersistence(agent: Agent): any {
    return AgentFactory.toPersistence(agent);
  }

  async isNameUnique(organizationId: OrganizationId, name: string, excludeId?: AgentId): Promise<boolean> {
    const conditions = [
      eq(agents.organizationId, organizationId.value),
      eq(agents.name, name)
    ];

    if (excludeId) {
      conditions.push(ne(agents.id, excludeId.value));
    }

    const [record] = await this.db
      .select({ id: agents.id })
      .from(agents)
      .where(and(...conditions))
      .limit(1);

    return !record;
  }

  async findByApiKey(apiKey: ApiKey): Promise<Agent | null> {
    try {
      const [record] = await this.db
        .select()
        .from(agents)
        .where(eq(agents.apiKey, apiKey.value))
        .limit(1);

      if (!record) {
        return null;
      }

      return this.fromPersistence(record);
    } catch (error) {
      console.error('Error finding agent by API key:', error);
      return null;
    }
  }

  async updateLastUsed(id: AgentId): Promise<void> {
    try {
      await this.db
        .update(agents)
        .set({ lastUsedAt: new Date() })
        .where(eq(agents.id, id.value));
    } catch (error) {
      console.error('Error updating agent last used:', error);
    }
  }
}