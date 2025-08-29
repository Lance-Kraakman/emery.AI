// AIDEV-NOTE: Database domain entity
// Represents a logical database containing tables and data

import { DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export interface DatabaseConfig {
  name: string;
  slug: string;
  metadata?: Record<string, any> | null;
  organizationId: OrganizationId;
  createdBy: UserId;
}

export interface DatabasePersistenceData {
  id: number;
  name: string;
  slug: string;
  metadata?: Record<string, any> | null;
  organizationId: number;
  createdBy: string;
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
    public readonly createdBy: UserId,
    public readonly createdAt?: Date | null,
    public readonly updatedAt?: Date | null
  ) {}

  static create(config: DatabaseConfig): Database {
    return new Database(
      DatabaseId.temporary(), // Will be set by repository when saved
      config.name,
      config.slug,
      config.metadata || null,
      config.organizationId,
      config.createdBy
    );
  }

  static fromPersistence(data: DatabasePersistenceData): Database {
    return new Database(
      DatabaseId.fromNumber(data.id),
      data.name,
      data.slug,
      data.metadata || null,
      OrganizationId.fromNumber(data.organizationId),
      UserId.fromString(data.createdBy),
      data.createdAt || null,
      data.updatedAt || null
    );
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