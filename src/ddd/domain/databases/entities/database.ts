// AIDEV-NOTE: Database domain entity
// Represents a logical database containing tables and data
// Databases can be organization-scoped (agentId = null) or agent-scoped (agentId set)

import { DatabaseId, OrganizationId, UserId, AgentId } from '@/ddd/domain/shared/value-objects';

export interface DatabaseConfig {
  name: string;
  slug: string;
  metadata?: Record<string, any> | null;
  organizationId: OrganizationId;
  ownerId: UserId;
  agentId?: AgentId | null; // null = org-scoped, set = agent-scoped
}

export interface DatabasePersistenceData {
  id: number;
  name: string;
  slug: string;
  metadata?: Record<string, any> | null;
  organizationId: number;
  ownerId: string;
  agentId?: number | null; // null = org-scoped, set = agent-scoped
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class Database {
  private constructor(
    public readonly id: DatabaseId,
    public readonly name: string,
    public readonly slug: string,
    public readonly metadata: Record<string, any> | null,
    public readonly organizationId: OrganizationId,
    public readonly ownerId: UserId,
    public readonly agentId: AgentId | null, // null = org-scoped, set = agent-scoped
    public readonly createdAt?: Date | null,
    public readonly updatedAt?: Date | null
  ) {}

  // Backward compatibility alias
  get createdBy(): UserId {
    return this.ownerId;
  }

  /**
   * Check if this database is agent-scoped
   */
  get isAgentScoped(): boolean {
    return this.agentId !== null;
  }

  /**
   * Check if this database is organization-scoped
   */
  get isOrgScoped(): boolean {
    return this.agentId === null;
  }

  static create(config: DatabaseConfig): Database {
    return new Database(
      DatabaseId.temporary(), // Will be set by repository when saved
      config.name,
      config.slug,
      config.metadata || null,
      config.organizationId,
      config.ownerId,
      config.agentId || null
    );
  }

  static fromPersistence(data: DatabasePersistenceData): Database {
    return new Database(
      DatabaseId.fromNumber(data.id),
      data.name,
      data.slug,
      data.metadata || null,
      OrganizationId.fromNumber(data.organizationId),
      UserId.fromString(data.ownerId),
      data.agentId ? AgentId.fromNumber(data.agentId) : null,
      data.createdAt || null,
      data.updatedAt || null
    );
  }

  toPersistence(): DatabasePersistenceData {
    return {
      id: this.id.value,
      name: this.name,
      slug: this.slug,
      metadata: this.metadata,
      organizationId: this.organizationId.value,
      ownerId: this.ownerId.value,
      agentId: this.agentId?.value || null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Get database description from metadata
   */
  get description(): string | null {
    if (!this.metadata || typeof this.metadata !== 'object') {
      return null;
    }
    return this.metadata.description || null;
  }

  /**
   * Get metadata as searchable text
   */
  get metadataText(): string {
    if (!this.metadata || typeof this.metadata !== 'object') {
      return '';
    }
    return Object.entries(this.metadata)
      .filter(([key, value]) => typeof value === 'string')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' ');
  }
}