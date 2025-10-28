// AIDEV-NOTE: PuckApp DTO mapper - converts domain entities to DTOs for API responses
// Follows the pattern used in table-mapper.ts

import type { PuckApp } from '@/ddd/domain/puck/entities/puck-app';

export interface AppDTO {
  id: number;
  organizationId: number;
  name: string;
  slug: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export class PuckAppMapper {
  /**
   * Convert domain entity to DTO
   */
  static toDTO(app: PuckApp): AppDTO {
    return {
      id: app.id.value,
      organizationId: app.organizationId.value,
      name: app.name,
      slug: app.slug.value,
      description: app.description,
      createdBy: app.createdBy.value,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString()
    };
  }

  /**
   * Convert multiple domain entities to DTOs
   */
  static toDTOs(apps: PuckApp[]): AppDTO[] {
    return apps.map(app => this.toDTO(app));
  }
}
