// AIDEV-NOTE: App DTO mapper - converts domain entities to DTOs for API responses
// Follows the pattern used in table-mapper.ts

import type { App } from '@/ddd/domain/puck/entities/app';

export interface AppDTO {
  id: number;
  organizationId: number;
  name: string;
  slug: string;
  description?: string;
  themeConfig?: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export class AppMapper {
  /**
   * Convert domain entity to DTO
   */
  static toDTO(app: App): AppDTO {
    return {
      id: app.id.value,
      organizationId: app.organizationId.value,
      name: app.name,
      slug: app.slug.value,
      description: app.description,
      themeConfig: app.themeConfig ? app.themeConfig.toJSON() : undefined,
      createdBy: app.createdBy.value,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString()
    };
  }

  /**
   * Convert multiple domain entities to DTOs
   */
  static toDTOs(apps: App[]): AppDTO[] {
    return apps.map(app => this.toDTO(app));
  }
}
