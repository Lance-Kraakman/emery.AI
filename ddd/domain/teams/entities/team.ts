// AIDEV-NOTE: Team domain entity with DDD Value Objects
// Represents a team of agents with shared purpose and goals

import { TeamId, OrganizationId, AgentId } from '@/ddd/domain/shared/value-objects';

export interface TeamConfig {
  name: string;
  purpose?: string | null;
  description?: string | null;
  responsibilities?: string[] | null;
  goals?: string[] | null;
  agentIds?: AgentId[] | null;
  databaseId?: string | null;
  organizationId: OrganizationId;
}

export class Team {
  private constructor(
    public readonly id: TeamId,
    public readonly name: string,
    public readonly purpose: string | null,
    public readonly description: string | null,
    public readonly responsibilities: string[] | null,
    public readonly goals: string[] | null,
    public readonly agentIds: AgentId[] | null,
    public readonly databaseId: string | null,
    public readonly organizationId: OrganizationId,
    public readonly createdAt?: Date | null
  ) {}

  static create(config: TeamConfig): Team {
    return new Team(
      TeamId.placeholder(), // Will be set by repository after persistence
      config.name,
      config.purpose || null,
      config.description || null,
      config.responsibilities || null,
      config.goals || null,
      config.agentIds || null,
      config.databaseId || null,
      config.organizationId
    );
  }

  static fromPersistence(data: {
    id: number;
    name: string;
    purpose?: string | null;
    description?: string | null;
    responsibilities?: string[] | null;
    goals?: string[] | null;
    agentIds?: string[] | null; // Will convert from string[] to AgentId[]
    databaseId?: string | null;
    organizationId: number;
    createdAt?: Date | null;
  }): Team {
    return new Team(
      TeamId.fromNumber(data.id),
      data.name,
      data.purpose || null,
      data.description || null,
      data.responsibilities || null,
      data.goals || null,
      data.agentIds ? data.agentIds.map(id => AgentId.fromNumber(parseInt(id))) : null,
      data.databaseId || null,
      OrganizationId.fromNumber(data.organizationId),
      data.createdAt || null
    );
  }

  /**
   * Get agent count
   */
  get agentCount(): number {
    return this.agentIds?.length || 0;
  }

  /**
   * Get responsibilities count
   */
  get responsibilityCount(): number {
    return this.responsibilities?.length || 0;
  }

  /**
   * Get goals count
   */
  get goalsCount(): number {
    return this.goals?.length || 0;
  }

  /**
   * Get team summary text for RAG indexing
   */
  get summaryText(): string {
    const parts = [this.name];
    
    if (this.purpose) parts.push(`Purpose: ${this.purpose}`);
    if (this.description) parts.push(`Description: ${this.description}`);
    if (this.responsibilities?.length) {
      parts.push(`Responsibilities: ${this.responsibilities.join(', ')}`);
    }
    if (this.goals?.length) {
      parts.push(`Goals: ${this.goals.join(', ')}`);
    }
    
    return parts.join(' | ');
  }
}