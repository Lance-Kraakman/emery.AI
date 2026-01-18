import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';

export interface TableDTO {
  id: number;
  databaseId: number;
  organizationId: number;
  name: string;
  storageLocation: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  fieldCount: number;
  createdBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export class TableMapper {
  static toDTO(table: DynamicTable): TableDTO {
    return {
      id: table.id.value,
      databaseId: table.databaseId.value,
      organizationId: table.organizationId.value,
      name: table.name,
      storageLocation: table.storageLocation,
      description: table.description,
      metadata: table.metadata?.toDatabaseJson() || null,
      fieldCount: table.fields.length,
      createdBy: table.createdBy.value,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt
    };
  }
}