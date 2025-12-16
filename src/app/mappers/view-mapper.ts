/**
 * View Mapper
 *
 * AIDEV-NOTE: Maps View domain entities to DTOs for client use.
 * DTOs use plain serializable types that can pass through Next.js Server Actions.
 */

import { View } from "@/ddd/domain/views/entities/view";

export interface ViewDTO {
  id: number;
  organizationId: number;
  tableId: number;
  tableName?: string;  // Optional table name for display purposes
  name: string;
  description?: string;
  viewType: 'grid' | 'metric' | 'chart' | 'form';
  viewConfig: {
    type: 'grid' | 'metric' | 'chart' | 'form';
    [key: string]: any;
  };
  requiresAuth: boolean; // Whether this view requires authentication (default: true)
  filters: Array<{
    fieldId: number;
    operator: string;
    value?: string | number | boolean | null;
  }>;
  sorting: Array<{
    fieldId: number;
    direction: "asc" | "desc";
    priority: number;
  }>;
  pagination: {
    pageSize: number;
    offset: number;
  };
  fieldMappings?: Array<{
    sourceFieldId: number;
    displayName: string;
    visible: boolean;
    order: number;
  }>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ViewMapper {
  static toDTO(dataSource: View): ViewDTO {
    const persistence = dataSource.toPersistence();

    return {
      id: persistence.id,
      organizationId: persistence.organizationId,
      tableId: persistence.tableId,
      name: persistence.name,
      description: persistence.description,
      viewType: persistence.viewType as 'grid' | 'metric' | 'chart' | 'form',
      viewConfig: persistence.viewConfig as {
        type: 'grid' | 'metric' | 'chart' | 'form';
        [key: string]: any;
      },
      requiresAuth: persistence.requiresAuth,
      filters: persistence.filters,
      sorting: persistence.sorting,
      pagination: persistence.pagination,
      fieldMappings: persistence.fieldMappings,
      createdBy: persistence.createdBy,
      createdAt: persistence.createdAt,
      updatedAt: persistence.updatedAt,
    };
  }
}
