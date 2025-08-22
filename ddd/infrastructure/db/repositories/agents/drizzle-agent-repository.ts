// AIDEV-NOTE: Drizzle implementation of Agent repository
// Handles data persistence for Agent domain entities

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { Agent } from '@/ddd/domain/agents/entities/agent';
import type { DbClient } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export class DrizzleAgentRepository implements IAgentRepository {
  constructor(private readonly db: DbClient) {}

  async findByOrganization(organizationId: number): Promise<Agent[]> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, organizationId));

    return results.map(result => Agent.fromPersistence({
      id: result.id,
      name: result.name,
      role: result.role,
      description: result.description,
      persona: result.persona,
      tools: result.tools as Record<string, any> | null,
      servers: result.servers as Record<string, any> | null,
      trigger: result.trigger as Record<string, any> | null,
      capabilities: result.capabilities as Record<string, any> | null,
      databaseId: result.databaseId,
      status: result.status,
      organizationId: result.organizationId,
      ownerId: result.ownerId,
      roleId: result.roleId,
      apiKey: result.apiKey,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }));
  }

  async findById(id: number): Promise<Agent | null> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return Agent.fromPersistence({
      id: result.id,
      name: result.name,
      role: result.role,
      description: result.description,
      persona: result.persona,
      tools: result.tools as Record<string, any> | null,
      servers: result.servers as Record<string, any> | null,
      trigger: result.trigger as Record<string, any> | null,
      capabilities: result.capabilities as Record<string, any> | null,
      databaseId: result.databaseId,
      status: result.status,
      organizationId: result.organizationId,
      ownerId: result.ownerId,
      roleId: result.roleId,
      apiKey: result.apiKey,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    });
  }

  async findByOwner(ownerId: string): Promise<Agent[]> {
    const results = await this.db
      .select()
      .from(agents)
      .where(eq(agents.ownerId, ownerId));

    return results.map(result => Agent.fromPersistence({
      id: result.id,
      name: result.name,
      role: result.role,
      description: result.description,
      persona: result.persona,
      tools: result.tools as Record<string, any> | null,
      servers: result.servers as Record<string, any> | null,
      trigger: result.trigger as Record<string, any> | null,
      capabilities: result.capabilities as Record<string, any> | null,
      databaseId: result.databaseId,
      status: result.status,
      organizationId: result.organizationId,
      ownerId: result.ownerId,
      roleId: result.roleId,
      apiKey: result.apiKey,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }));
  }

  async findActiveByOrganization(organizationId: number): Promise<Agent[]> {
    const results = await this.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, organizationId),
          eq(agents.status, 'active')
        )
      );

    return results.map(result => Agent.fromPersistence({
      id: result.id,
      name: result.name,
      role: result.role,
      description: result.description,
      persona: result.persona,
      tools: result.tools as Record<string, any> | null,
      servers: result.servers as Record<string, any> | null,
      trigger: result.trigger as Record<string, any> | null,
      capabilities: result.capabilities as Record<string, any> | null,
      databaseId: result.databaseId,
      status: result.status,
      organizationId: result.organizationId,
      ownerId: result.ownerId,
      roleId: result.roleId,
      apiKey: result.apiKey,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }));
  }

  async save(agent: Agent): Promise<void> {
    if (agent.id === 0) {
      // Insert new agent
      await this.db.insert(agents).values({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        persona: agent.persona,
        tools: agent.tools,
        servers: agent.servers,
        trigger: agent.trigger,
        capabilities: agent.capabilities,
        databaseId: agent.databaseId,
        status: agent.status,
        organizationId: agent.organizationId,
        ownerId: agent.ownerId,
        roleId: agent.roleId,
        apiKey: agent.apiKey
      });
    } else {
      // Update existing agent
      await this.db
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
          status: agent.status,
          organizationId: agent.organizationId,
          ownerId: agent.ownerId,
          roleId: agent.roleId,
          apiKey: agent.apiKey,
          updatedAt: new Date()
        })
        .where(eq(agents.id, agent.id));
    }
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(agents).where(eq(agents.id, id));
  }

  async countByOrganization(organizationId: number): Promise<number> {
    const result = await this.db
      .select({ count: agents.id })
      .from(agents)
      .where(eq(agents.organizationId, organizationId));

    return result.length;
  }
}