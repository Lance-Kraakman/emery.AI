// AIDEV-NOTE: PuckPage DTO mapper - converts domain entities to DTOs for API responses
// Includes template data for rendering

import type { PuckPage } from '@/ddd/domain/puck/entities/puck-page';
import type { PuckDataStructure } from '@/ddd/domain/puck/value-objects/puck-data';
import type { ThemeConfigProps } from '@/ddd/domain/puck/value-objects/theme-config';
import type { PageVariable } from '@/components/puck/types';

export interface PageDTO {
  id: number;
  appId: number;
  name: string;
  slug: string;
  description?: string;
  order: number;
  templateData: PuckDataStructure;
  themeConfig?: ThemeConfigProps | null;
  isPublic: boolean;
  requiresAuth: boolean;
  allowedRoles?: string[];
  pageVariables?: PageVariable[];
  ownerId: string;
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
      isPublic: page.isPublic,
      requiresAuth: page.requiresAuth,
      allowedRoles: page.allowedRoles,
      pageVariables: page.pageVariables,
      ownerId: page.ownerId.value,
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
