/**
 * View Mapper
 *
 * AIDEV-NOTE: Maps View domain entities to DTOs for client use.
 * DTOs use plain serializable types that can pass through Next.js Server Actions.
 */

import { View } from "@/ddd/domain/views/entities/data-source";

export interface ViewDTO {
  id: number;
  organizationId: number;
  tableId: number;
  name: string;
  description?: string;
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
      filters: persistence.filters,
      sorting: persistence.sorting,
      pagination: persistence.pagination,
      createdBy: persistence.createdBy,
      createdAt: persistence.createdAt,
      updatedAt: persistence.updatedAt,
    };
  }
}
