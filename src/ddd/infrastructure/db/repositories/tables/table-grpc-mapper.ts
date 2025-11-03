/**
 * Table gRPC Mapper
 * 
 * Converts between domain entities and protobuf messages for the gRPC table service.
 * Handles field type mapping and data serialization/deserialization.
 */

import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import { TableId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { RowFilter, FilterOperator } from '@/ddd/infrastructure/db/types/table-persistence';
import {
  FieldType,
  FilterOperator as ProtoFilterOperator,
  Table as ITable,
  TableSchema as ITableSchema,
  TableField as ITableField,
  Row as IRow,
  RowData as IRowData,
  RowDataValue as IRowDataValue,
  RowFilter as IRowFilter,
  CreateTableRequest as ICreateTableRequest,
  CreateRowsRequest as ICreateRowsRequest,
  UpdateRowsRequest as IUpdateRowsRequest,
  DeleteRowsRequest as IDeleteRowsRequest,
  QueryRowsRequest as IQueryRowsRequest,
  GetTableStatsRequest as IGetTableStatsRequest,
} from '@/lib/grpc/generated/table_service';

/**
 * Maps field types between domain and protobuf
 */
export class TableGrpcMapper {
  /**
   * Convert FilterOperator string to protobuf FilterOperator enum
   */
  private static filterOperatorToProto(operator: FilterOperator): ProtoFilterOperator {
    const mapping: Record<FilterOperator, ProtoFilterOperator> = {
      'eq': ProtoFilterOperator.FILTER_OP_EQ,
      'ne': ProtoFilterOperator.FILTER_OP_NE,
      'gt': ProtoFilterOperator.FILTER_OP_GT,
      'gte': ProtoFilterOperator.FILTER_OP_GTE,
      'lt': ProtoFilterOperator.FILTER_OP_LT,
      'lte': ProtoFilterOperator.FILTER_OP_LTE,
      'like': ProtoFilterOperator.FILTER_OP_LIKE,
      'ilike': ProtoFilterOperator.FILTER_OP_ILIKE,
      'in': ProtoFilterOperator.FILTER_OP_IN,
      'not_in': ProtoFilterOperator.FILTER_OP_NOT_IN,
      'is_null': ProtoFilterOperator.FILTER_OP_IS_NULL,
      'is_not_null': ProtoFilterOperator.FILTER_OP_IS_NOT_NULL,
      'contains': ProtoFilterOperator.FILTER_OP_CONTAINS,
      'contained_by': ProtoFilterOperator.FILTER_OP_CONTAINED_BY,
      'has_key': ProtoFilterOperator.FILTER_OP_HAS_KEY,
    };

    return mapping[operator] || ProtoFilterOperator.FILTER_OP_EQ;
  }

  /**
   * Convert RowFilter to protobuf RowFilter
   */
  private static toProtoRowFilter(filter: RowFilter): IRowFilter {
    const protoFilter: IRowFilter = {
      field: filter.field,
      operator: this.filterOperatorToProto(filter.operator),
      value: this.toProtoRowDataValue(filter.value),
      values: [], // For IN/NOT_IN operators - would need to be populated if value is an array
    };

    // Handle IN/NOT_IN operators with array values
    if ((filter.operator === 'in' || filter.operator === 'not_in') && Array.isArray(filter.value)) {
      protoFilter.values = filter.value.map(v => this.toProtoRowDataValue(v));
      protoFilter.value = this.toProtoRowDataValue(null); // Empty value for array operators
    }

    return protoFilter;
  }

  /**
   * Convert DynamicTable domain entity to protobuf Table interface
   */
  static toProtoTable(table: DynamicTable): ITable {
    const protoTable: ITable = {
      tableId: table.id.value.toString(),
      name: table.name,
      description: table.description || '',
      s3Path: table.storageLocation || '',
      createdBy: table.createdBy.value,
      updatedBy: table.createdBy.value, // Use createdBy as updatedBy since DynamicTable doesn't have updatedBy
      organizationId: table.organizationId.value.toString(),
      createdAtMs: table.createdAt?.getTime() || 0,
      updatedAtMs: table.updatedAt?.getTime() || 0,
      metadata: {},
      isDeleted: false,
      schema: this.toProtoTableSchema(table.fields),
    };

    return protoTable;
  }

  /**
   * Convert TableField array to protobuf TableSchema interface
   */
  static toProtoTableSchema(fields: readonly TableField[]): ITableSchema {
    const protoSchema: ITableSchema = {
      schemaId: `schema_${Date.now()}`,
      name: 'default',
      version: '1.0',
      fields: fields.map(field => this.toProtoTableField(field)),
      metadata: {},
    };

    return protoSchema;
  }

  /**
   * Convert TableField domain entity to protobuf TableField interface
   */
  static toProtoTableField(field: TableField): ITableField {
    const protoField: ITableField = {
      name: field.name,
      type: this.mapFieldTypeToProto(field.type),
      required: field.required || false,
      metadata: field.metadata || {},
      fieldId: field.id.value,  // Add numeric field ID for Delta Lake column name
    };

    return protoField;
  }

  /**
   * Convert CreateRows parameters to protobuf CreateRowsRequest interface
   */
  static toCreateRowsRequest(
    tableId: TableId,
    rows: Row[],
    organizationId: OrganizationId,
    fields: readonly TableField[],
    s3Path?: string,
    mode?: 'append' | 'overwrite'
  ): ICreateRowsRequest {
    const request: ICreateRowsRequest = {
      tableId: tableId.value.toString(),
      userId: '', // Will be set by the service layer
      organizationId: organizationId.value.toString(),
      s3Path: s3Path || '', // S3 path for Delta Lake table data
      rowsData: rows.map(row => this.toProtoRowData(row, fields)),
      mode: mode || 'append', // Default to append for backward compatibility
    };

    return request;
  }

  /**
   * Convert serialized row data to protobuf CreateRowsRequest interface
   * Used when data has already been serialized by RowSerializer
   */
  static toCreateRowsRequestFromData(
    tableId: TableId,
    serializedRows: Array<{ id: string; data: Record<string, any> }>,
    organizationId: OrganizationId,
    fields: readonly TableField[],
    s3Path?: string,
    mode?: 'append' | 'overwrite'
  ): ICreateRowsRequest {
    const request: ICreateRowsRequest = {
      tableId: tableId.value.toString(),
      userId: '', // Will be set by the service layer
      organizationId: organizationId.value.toString(),
      s3Path: s3Path || '', // S3 path for Delta Lake table data
      rowsData: serializedRows.map(({ id, data }) => this.toProtoRowDataFromPlain(id, data)),
      mode: mode || 'append', // Default to append for backward compatibility
    };

    return request;
  }

  /**
   * Convert serialized row data to protobuf UpdateRowsRequest interface
   * Used when updating rows with data that has already been serialized by RowSerializer
   * Uses Delta Lake merge operation for efficient row-level updates
   */
  static toUpdateRowsRequestFromData(
    tableId: TableId,
    serializedRows: Array<{ id: string; data: Record<string, any> }>,
    organizationId: OrganizationId,
    fields: readonly TableField[],
    s3Path?: string
  ): IUpdateRowsRequest {
    const request: IUpdateRowsRequest = {
      tableId: tableId.value.toString(),
      userId: '', // Will be set by the service layer
      organizationId: organizationId.value.toString(),
      s3Path: s3Path || '', // S3 path for Delta Lake table data
      rowsData: serializedRows.map(({ id, data }) => this.toProtoRowDataFromPlain(id, data)),
    };

    return request;
  }

  /**
   * Convert delete parameters to protobuf DeleteRowsRequest interface
   * Used for efficient row-level deletes via Delta Lake DELETE operation
   */
  static toDeleteRowsRequest(
    tableId: TableId,
    rowIds: string[],
    organizationId: OrganizationId,
    s3Path: string
  ): IDeleteRowsRequest {
    const request: IDeleteRowsRequest = {
      tableId: tableId.value.toString(),
      rowIds: rowIds,
      userId: '', // Will be set by the service layer
      organizationId: organizationId.value.toString(),
      s3Path: s3Path,
    };

    return request;
  }

  /**
   * Convert QueryRows parameters to protobuf QueryRowsRequest interface
   */
  static toQueryRowsRequest(
    tableId: TableId,
    s3Path: string,
    queryParams: any = {},
    organizationId: OrganizationId
  ): IQueryRowsRequest {
    // Convert RowFilter[] to protobuf RowFilter[]
    const protoFilters: IRowFilter[] = Array.isArray(queryParams.filters)
      ? queryParams.filters.map((filter: RowFilter) => this.toProtoRowFilter(filter))
      : [];

    // AIDEV-NOTE: Add aggregation support for metric/dashboard views
    // Convert aggregation configuration to protobuf format if provided
    const aggregation = (queryParams.aggregations && Array.isArray(queryParams.aggregations) && queryParams.aggregations.length > 0)
      ? {
          groupByFields: [], // Empty for global aggregations (metric views)
          aggregations: queryParams.aggregations.map((agg: any) => ({
            fieldId: agg.fieldId,
            type: this.mapAggregationTypeToProto(agg.type),
            alias: agg.alias,
            formatType: agg.formatType || 'number',
          })),
        }
      : undefined;

    const request: IQueryRowsRequest = {
      tableId: tableId.value.toString(),
      s3Path: s3Path,
      userId: '', // Will be set by the service layer
      organizationId: organizationId.value.toString(),
      orderBy: queryParams.orderBy || '',
      orderDirection: queryParams.orderDirection || 'ASC',
      limit: queryParams.limit || 0,
      offset: queryParams.offset || 0,
      filters: protoFilters,
      aggregation,
    };

    return request;
  }

  /**
   * Map TypeScript aggregation type to protobuf enum
   * AIDEV-NOTE: Maps AggregationType from domain to protobuf enum values
   */
  private static mapAggregationTypeToProto(type: string): number {
    const mapping: Record<string, number> = {
      'sum': 1,           // AGG_TYPE_SUM
      'avg': 2,           // AGG_TYPE_AVG
      'count': 3,         // AGG_TYPE_COUNT
      'min': 4,           // AGG_TYPE_MIN
      'max': 5,           // AGG_TYPE_MAX
      'count_distinct': 6, // AGG_TYPE_COUNT_DISTINCT
      'count_empty': 7,    // AGG_TYPE_COUNT_EMPTY
      'count_not_empty': 8, // AGG_TYPE_COUNT_NOT_EMPTY
    };
    return mapping[type] || 0; // Default to UNSPECIFIED
  }

  /**
   * Convert GetTableStats parameters to protobuf GetTableStatsRequest interface
   *
   * This request will read only Delta Lake transaction log metadata (not data files)
   * to get row count and file sizes efficiently.
   */
  static toGetTableStatsRequest(
    tableId: TableId,
    s3Path: string,
    organizationId: OrganizationId
  ): IGetTableStatsRequest {
    const request: IGetTableStatsRequest = {
      tableId: tableId.value.toString(),
      s3Path: s3Path,
      organizationId: organizationId.value.toString(),
    };

    return request;
  }

  /**
   * Convert Row domain entity to protobuf RowData interface
   * @param row - Row entity to convert
   * @param fields - Table fields for numeric ID mapping
   */
  static toProtoRowData(row: Row, fields: readonly TableField[]): IRowData {
    const plainData = row.toPlainObject(fields);
    return this.toProtoRowDataFromPlain(row.id.value, plainData);
  }

  /**
   * Convert plain data object to protobuf RowData interface
   * Used for already-serialized data from RowSerializer
   */
  static toProtoRowDataFromPlain(id: string, data: Record<string, any>): IRowData {
    const protoRowData: IRowData = {
      id: id,
      data: Object.entries(data)
        .filter(([key]) => key !== 'id') // Exclude 'id' from data map (it's in the RowData.id field)
        .reduce((acc, [key, value]) => {
          acc[key] = this.toProtoRowDataValue(value);
          return acc;
        }, {} as Record<string, IRowDataValue>),
    };

    return protoRowData;
  }

  /**
   * Convert JavaScript value to protobuf RowDataValue interface
   * AIDEV-NOTE: Handles type normalization including numeric strings to prevent type confusion
   */
  static toProtoRowDataValue(value: any): IRowDataValue {
    if (value === null || value === undefined) {
      // AIDEV-NOTE: Empty protobuf oneof represents null value
      // Python/Polars will handle this as None/null for appropriate field types
      // This prevents "Cannot cast string '' to Float64" errors
      return {};
    } else if (typeof value === 'number') {
      // Numbers go to numberValue
      return { numberValue: value };
    } else if (typeof value === 'boolean') {
      return { booleanValue: value };
    } else if (value instanceof Date) {
      return { dateValue: value.getTime() };
    } else if (typeof value === 'string') {
      // AIDEV-NOTE: Check if string is actually a number to prevent type confusion
      // This handles cases where grid sends '234.0' instead of 234.0
      const numericValue = Number(value);
      if (!isNaN(numericValue) && value.trim() !== '' && /^-?\d+\.?\d*$/.test(value.trim())) {
        return { numberValue: numericValue };
      }

      // Check if it looks like a JSON string and use jsonValue for better storage
      if (value.startsWith('{') || value.startsWith('[')) {
        return { jsonValue: value };
      }
      return { textValue: value };
    } else if (typeof value === 'object') {
      // Objects/arrays that weren't serialized by RowSerializer (shouldn't happen normally)
      // Stringify them for storage
      return { jsonValue: JSON.stringify(value) };
    } else {
      // Fallback to string
      return { textValue: String(value) };
    }
  }

  /**
   * Convert protobuf Table message to DynamicTable domain entity
   */
  static fromProtoTable(protoTable: any): DynamicTable {
    const tableId = parseInt(protoTable.getTableId());
    const databaseId = 1; // Will be set by repository
    const organizationId = parseInt(protoTable.getOrganizationId());
    
    // Convert fields from protobuf
    const protoSchema = protoTable.getSchema();
    const protoFields = protoSchema ? this.fromProtoTableSchema(protoSchema) : [];
    
    // Convert fields to domain entities
    const fields = protoFields.map(f => TableField.create({
      name: f.name,
      type: f.type as any, // TODO: Fix type mapping
      required: f.required,
      metadata: f.metadata || {}
    }));
    
    // Convert timestamps
    const createdAt = protoTable.getCreatedAtMs() ? new Date(protoTable.getCreatedAtMs()) : null;
    const updatedAt = protoTable.getUpdatedAtMs() ? new Date(protoTable.getUpdatedAtMs()) : null;

    return DynamicTable.fromPersistence({
      id: tableId,
      databaseId: databaseId,
      organizationId: organizationId,
      name: protoTable.getName(),
      storageLocation: protoTable.getS3Path(),
      description: protoTable.getDescription() || undefined,
      metadata: undefined,
      fields: fields,
      createdBy: protoTable.getCreatedBy(),
      createdAt: createdAt,
      updatedAt: updatedAt,
    });
  }

  /**
   * Convert protobuf TableSchema message to TableField array
   */
  static fromProtoTableSchema(protoSchema: any): any[] {
    const protoFields = protoSchema.getFieldsList() || [];
    
    return protoFields.map((protoField: any) => ({
      name: protoField.getName(),
      type: this.mapFieldTypeFromProto(protoField.getType()),
      required: protoField.getRequired(),
      metadata: this.protoMapToObject(protoField.getMetadataMap()),
    }));
  }

  /**
   * Convert protobuf RowData message to Row domain entity
   */
  static fromProtoRowData(protoRowData: any, fields: readonly TableField[]): Row {
    const rowId = new TableId(protoRowData.getId());
    
    // Convert protobuf data map to plain object
    const dataMap = protoRowData.getDataMap();
    const plainObject: Record<string, any> = {};
    
    dataMap.forEach((protoValue: any, key: string) => {
      plainObject[key] = this.fromProtoRowDataValue(protoValue);
    });

    return Row.fromPlainObject(plainObject, rowId.value, fields as TableField[]);
  }

  /**
   * Convert protobuf RowDataValue message to JavaScript value
   */
  static fromProtoRowDataValue(protoValue: IRowDataValue): any {
    // Check which property is set (oneof pattern)
    if (protoValue.textValue !== undefined) {
      return protoValue.textValue;
    } else if (protoValue.numberValue !== undefined) {
      return protoValue.numberValue;
    } else if (protoValue.booleanValue !== undefined) {
      return protoValue.booleanValue;
    } else if (protoValue.dateValue !== undefined) {
      return new Date(protoValue.dateValue);
    } else if (protoValue.jsonValue !== undefined) {
      return JSON.parse(protoValue.jsonValue);
    } else {
      return null;
    }
  }

  /**
   * Map domain field type to protobuf FieldType enum
   */
  static mapFieldTypeToProto(fieldType: string): number {
    switch (fieldType.toLowerCase()) {
      case 'text':
        return FieldType.FIELD_TYPE_TEXT;
      case 'number':
        return FieldType.FIELD_TYPE_NUMBER;
      case 'boolean':
        return FieldType.FIELD_TYPE_BOOLEAN;
      case 'date':
        return FieldType.FIELD_TYPE_DATE;
      case 'file':
        return FieldType.FIELD_TYPE_FILE;
      case 'relation':
        return FieldType.FIELD_TYPE_RELATION;
      case 'document':
        return FieldType.FIELD_TYPE_DOCUMENT;
      default:
        return FieldType.FIELD_TYPE_UNSPECIFIED;
    }
  }

  /**
   * Map protobuf FieldType enum to domain field type
   */
  static mapFieldTypeFromProto(protoFieldType: number): string {
    switch (protoFieldType) {
      case FieldType.FIELD_TYPE_TEXT:
        return 'text';
      case FieldType.FIELD_TYPE_NUMBER:
        return 'number';
      case FieldType.FIELD_TYPE_BOOLEAN:
        return 'boolean';
      case FieldType.FIELD_TYPE_DATE:
        return 'date';
      case FieldType.FIELD_TYPE_FILE:
        return 'file';
      case FieldType.FIELD_TYPE_RELATION:
        return 'relation';
      case FieldType.FIELD_TYPE_DOCUMENT:
        return 'document';
      default:
        return 'text';
    }
  }

  /**
   * Convert protobuf Map to JavaScript object
   */
  static protoMapToObject(protoMap: any): Record<string, string> {
    const obj: Record<string, string> = {};
    if (protoMap && typeof protoMap.forEach === 'function') {
      protoMap.forEach((value: string, key: string) => {
        obj[key] = value;
      });
    }
    return obj;
  }
}
