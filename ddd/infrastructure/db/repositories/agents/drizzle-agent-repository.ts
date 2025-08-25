// AIDEV-NOTE: Drizzle implementation of Agent repository
// Handles data persistence for Agent domain entities

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { createAgentDefaults } from '@/ddd/domain/agents/entities/agent';
import type { DbClient } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export class DrizzleAgentRepository implements IAgentRepository {
  constructor(private readonly db: DbClient) {}

  async findByOrganization(organizationId: OrganizationId): Promise<Agent[]> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, organizationId.value));

    return results.map(result => this.mapToEntity(result));
  }

  async findById(id: AgentId): Promise<Agent | null> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id.value))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return this.mapToEntity(result);
  }

  async findByOwner(ownerId: UserId): Promise<Agent[]> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.ownerId, ownerId.value));

    return results.map(result => this.mapToEntity(result));
  }

  async findActiveByOrganization(organizationId: OrganizationId): Promise<Agent[]> {
    const results = await this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, organizationId.value),
          eq(agents.status, 'active')
        )
      );

    return results.map(result => this.mapToEntity(result));
  }

  async save(agent: Agent): Promise<Agent> {
    if (agent.id.value === 0) {
      // Insert new agent
      const results = await this.db.insert(agents).values({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        persona: agent.persona,
        tools: agent.tools,
        servers: agent.servers,
        trigger: agent.trigger,
        capabilities: agent.capabilities,
        databaseId: agent.databaseId,
        status: agent.status.value,
        organizationId: agent.organizationId.value,
        ownerId: agent.ownerId.value,
        roleId: agent.roleId,
        apiKey: agent.apiKey?.value
      }).returning();
      
      return this.mapToEntity(results[0]);
    } else {
      // Update existing agent
      const results = await this.db
        .update(agents)
        .set({
          name: agent.name,
          role: agent.role,
          description: agent.description,
          persona: agent.persona,
          tools: agent.tools,
          servers: agent.servers,
          trigger: agent.trigger,
          capabilities: agent.capabilities,
          databaseId: agent.databaseId,
          status: agent.status.value.value,
          organizationId: agent.organizationId.value,
          ownerId: agent.ownerId.value,
          roleId: agent.roleId,
          apiKey: agent.apiKey?.value?.value
        })
        .where(eq(agents.id, agent.id.value))
        .returning();
        
      return this.mapToEntity(results[0]);
    }
  }

  async delete(id: AgentId): Promise<void> {
    await this.db.delete(agents).where(eq(agents.id, id.value));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .select({ count: agents.id })
      .from(agents)
      .where(eq(agents.organizationId, organizationId.value));

    return result.length;
  }

  // Helper method to map database result to domain entity with defaults
  private mapToEntity(data: any): Agent {
    return {
      id: AgentId.fromNumber(data.id),
      name: data.name,
      role: data.role || 'assistant',
      description: data.description || '',
      persona: data.persona || '',
      tools: data.tools || {},
      servers: data.servers || {},
      trigger: data.trigger || {},
      capabilities: data.capabilities || {},
      databaseId: data.databaseId,
      status: data.status || 'active',
      organizationId: OrganizationId.fromNumber(data.organizationId),
      ownerId: UserId.fromString(data.ownerId),
      roleId: data.roleId,
      apiKey: data.apiKey,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}