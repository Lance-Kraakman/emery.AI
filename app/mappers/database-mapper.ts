import { Database } from '@/ddd/domain/databases/entities/database';

export interface DatabaseDTO {
  id: number;
  name: string;
  slug: string;
  metadata?: Record<string, any> | null;
  organizationId: number;
  createdBy: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  description?: string | null; // Computed property from metadata
}

export class DatabaseMapper {
  static toDTO(database: Database): DatabaseDTO {
    return {
      id: database.id.value,
      name: database.name,
      slug: database.slug,
      metadata: database.metadata,
      organizationId: database.organizationId.value,
      createdBy: database.createdBy.value,
      createdAt: database.createdAt,
      updatedAt: database.updatedAt,
      description: database.description // Uses the getter from Domain entity
    };
  }
}