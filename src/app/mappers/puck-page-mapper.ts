// AIDEV-NOTE: PuckPage DTO mapper - converts domain entities to DTOs for API responses
// Includes template data for rendering

import type { PuckPage } from '@/ddd/domain/puck/entities/puck-page';
import type { PuckDataStructure } from '@/ddd/domain/puck/value-objects/puck-data';

export interface PageDTO {
  id: number;
  appId: number;
  name: string;
  slug: string;
  description?: string;
  order: number;
  templateData: PuckDataStructure;
  themeConfig?: any;
  isPublished: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export class PuckPageMapper {
  /**
   * Convert domain entity to DTO
   */
  static toDTO(page: PuckPage): PageDTO {
    return {
      id: page.id.value,
      appId: page.appId.value,
      name: page.name,
      slug: page.slug.value,
      description: page.description,
      order: page.order.value,
      templateData: page.templateData.data,
      themeConfig: page.themeConfig ? page.themeConfig.toJSON() : undefined,
      isPublished: page.isPublished,
      createdBy: page.createdBy.value,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString()
    };
  }

  /**
   * Convert multiple domain entities to DTOs
   */
  static toDTOs(pages: PuckPage[]): PageDTO[] {
    return pages.map(page => this.toDTO(page));
  }
}
