/**
 * AIDEV-NOTE: Promptfoo custom provider for Emery CRUD operations
 *
 * Tests table, row, and field operations against the Emery API.
 * Uses types from the main application for type safety.
 *
 * Environment variables:
 *   EMERY_BASE_URL - API base URL (e.g., http://localhost:3002)
 *   EMERY_API_KEY  - User API key (user_xxx format)
 *   TEST_TABLE_ID  - Default table ID for tests
 */

import type { ApiSuccessResponse, ApiErrorResponse } from '@app/lib/api/base';
import type { FieldDTO } from '@app/app/mappers/field-mapper';
import type { TableDTO } from '@app/app/mappers/table-mapper';
import type { RowDTO } from '@app/app/mappers/row-mapper';
import type { FieldType } from '@app/ddd/domain/tables/value-objects/table-field';

// API response types
type TableListResponse = ApiSuccessResponse<TableDTO[]>;
type TableResponse = ApiSuccessResponse<TableDTO>;
type FieldListResponse = ApiSuccessResponse<FieldDTO[]>;
type FieldResponse = ApiSuccessResponse<FieldDTO>;
type RowListResponse = ApiSuccessResponse<{ rows: RowDTO[]; hasMore: boolean; total: number }>;
type RowResponse = ApiSuccessResponse<RowDTO>;

const BASE_URL = process.env.EMERY_BASE_URL || 'http://localhost:3002';
const API_KEY = process.env.EMERY_API_KEY || '';
const DEFAULT_TABLE_ID = process.env.TEST_TABLE_ID || '1';

async function makeRequest<T>(
  endpoint: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response.json() as Promise<T>;
}

// Table operations
async function createTable(data: {
  name: string;
  databaseId: number;
  description?: string;
}): Promise<TableResponse | ApiErrorResponse> {
  return makeRequest<TableResponse | ApiErrorResponse>('/api/tables', 'POST', data);
}

async function listTables(): Promise<TableListResponse | ApiErrorResponse> {
  return makeRequest<TableListResponse | ApiErrorResponse>('/api/tables', 'GET');
}

async function getTable(tableId: string): Promise<TableResponse | ApiErrorResponse> {
  return makeRequest<TableResponse | ApiErrorResponse>(`/api/tables/${tableId}`, 'GET');
}

async function updateTable(
  tableId: string,
  data: { name?: string; description?: string }
): Promise<TableResponse | ApiErrorResponse> {
  return makeRequest<TableResponse | ApiErrorResponse>(`/api/tables/${tableId}`, 'PUT', data);
}

async function deleteTable(tableId: string): Promise<ApiSuccessResponse<{ id: number }> | ApiErrorResponse> {
  return makeRequest<ApiSuccessResponse<{ id: number }> | ApiErrorResponse>(`/api/tables/${tableId}`, 'DELETE');
}

// Field operations
async function createField(
  tableId: string,
  data: {
    name: string;
    type: FieldType;
    required?: boolean;
    relatedTableId?: number;
    config?: Record<string, unknown>;
  }
): Promise<FieldResponse | ApiErrorResponse> {
  return makeRequest<FieldResponse | ApiErrorResponse>('/api/fields', 'POST', {
    tableId: parseInt(tableId),
    name: data.name,
    type: data.type,
    required: data.required || false,
    relatedTableId: data.relatedTableId,
    ...data.config,
  });
}

async function listFields(tableId: string): Promise<FieldListResponse | ApiErrorResponse> {
  return makeRequest<FieldListResponse | ApiErrorResponse>(`/api/fields?tableId=${tableId}`, 'GET');
}

async function deleteField(
  tableId: string,
  fieldName: string
): Promise<ApiSuccessResponse<{ name: string }> | ApiErrorResponse> {
  return makeRequest<ApiSuccessResponse<{ name: string }> | ApiErrorResponse>(
    `/api/fields?tableId=${tableId}&fieldName=${encodeURIComponent(fieldName)}`,
    'DELETE'
  );
}

// Row operations
async function createRow(
  tableId: string,
  data: Record<string, unknown>
): Promise<RowResponse | ApiErrorResponse> {
  return makeRequest<RowResponse | ApiErrorResponse>('/api/rows', 'POST', {
    tableId: parseInt(tableId),
    data,
  });
}

async function getRows(
  tableId: string,
  limit = 100,
  offset = 0
): Promise<RowListResponse | ApiErrorResponse> {
  return makeRequest<RowListResponse | ApiErrorResponse>(
    `/api/rows?tableId=${tableId}&limit=${limit}&offset=${offset}`,
    'GET'
  );
}

async function updateRow(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<RowResponse | ApiErrorResponse> {
  return makeRequest<RowResponse | ApiErrorResponse>('/api/rows', 'PUT', {
    tableId: parseInt(tableId),
    rowId,
    data,
  });
}

async function deleteRow(
  tableId: string,
  rowId: string
): Promise<ApiSuccessResponse<{ id: string }> | ApiErrorResponse> {
  return makeRequest<ApiSuccessResponse<{ id: string }> | ApiErrorResponse>(
    `/api/rows?tableId=${tableId}&rowId=${rowId}`,
    'DELETE'
  );
}

/**
 * Promptfoo ApiProvider class for CRUD operations
 */
class EmeryCrudProvider {
  id(): string {
    return 'emery-crud';
  }

  async callApi(prompt: string, context?: { vars?: Record<string, unknown> }): Promise<{ output: string; error?: string }> {
    const vars = context?.vars || {};
    const operation = vars.operation as string;
    const tableId = (vars.tableId as string) || DEFAULT_TABLE_ID;

    try {
      let result: unknown;

      switch (operation) {
        // Table operations
        case 'create_table': {
          const data = vars.data as Record<string, unknown> | undefined;
          result = await createTable({
            name: (data?.name as string) || 'Unnamed Table',
            databaseId: (vars.databaseId as number) || (data?.databaseId as number) || 1,
            description: data?.description as string | undefined,
          });
          break;
        }
        case 'list_tables':
          result = await listTables();
          break;
        case 'get_table':
          result = await getTable(tableId);
          break;
        case 'update_table': {
          const data = vars.data as { name?: string; description?: string } | undefined;
          result = await updateTable(tableId, data || {});
          break;
        }
        case 'delete_table':
          result = await deleteTable(tableId);
          break;

        // Field operations
        case 'create_field': {
          const fieldName = vars.field_name as string | undefined;
          const data = vars.data as Record<string, unknown> | undefined;
          if (!fieldName && !data?.name) {
            return { output: JSON.stringify({ success: false, error: 'field_name is required' }) };
          }
          const fieldType = vars.field_type as FieldType | undefined;
          if (!fieldType && !data?.type) {
            return { output: JSON.stringify({ success: false, error: 'field_type is required' }) };
          }
          result = await createField(tableId, {
            name: fieldName || (data?.name as string),
            type: fieldType || (data?.type as FieldType),
            required: (vars.field_required as boolean) || (data?.required as boolean),
            relatedTableId: (vars.related_table_id as number) || (data?.relatedTableId as number),
            config: (vars.field_config as Record<string, unknown>) || (data?.config as Record<string, unknown>),
          });
          break;
        }
        case 'list_fields':
          result = await listFields(tableId);
          break;
        case 'delete_field': {
          const fieldName = vars.field_name as string | undefined;
          if (!fieldName) {
            return { output: JSON.stringify({ success: false, error: 'field_name is required' }) };
          }
          result = await deleteField(tableId, fieldName);
          break;
        }

        // Row operations
        case 'create_row': {
          const data = vars.data as Record<string, unknown> | undefined;
          result = await createRow(tableId, data || {});
          break;
        }
        case 'get_rows':
          result = await getRows(tableId, vars.limit as number, vars.offset as number);
          break;
        case 'update_row': {
          const rowId = vars.rowId as string | undefined;
          if (!rowId) {
            return { output: JSON.stringify({ success: false, error: 'rowId is required' }) };
          }
          const data = vars.data as Record<string, unknown> | undefined;
          result = await updateRow(tableId, rowId, data || {});
          break;
        }
        case 'delete_row': {
          const rowId = vars.rowId as string | undefined;
          if (!rowId) {
            return { output: JSON.stringify({ success: false, error: 'rowId is required' }) };
          }
          result = await deleteRow(tableId, rowId);
          break;
        }

        default:
          return {
            output: JSON.stringify({ success: false, error: `Unknown operation: ${operation}` }),
            error: `Unknown operation: ${operation}`,
          };
      }

      return { output: JSON.stringify(result) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: JSON.stringify({ success: false, error: errorMessage }),
        error: errorMessage,
      };
    }
  }
}

export default EmeryCrudProvider;
