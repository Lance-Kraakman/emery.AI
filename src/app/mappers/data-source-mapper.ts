/**
 * DataSource Mapper
 *
 * AIDEV-NOTE: Maps DataSource domain entities to DTOs for client use.
 * DTOs use plain serializable types that can pass through Next.js Server Actions.
 */

import { DataSource } from "@/ddd/domain/data-sources/entities/data-source";

export interface DataSourceDTO {
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

export class DataSourceMapper {
  static toDTO(dataSource: DataSource): DataSourceDTO {
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
