// AIDEV-NOTE: Shared types for Server Actions - ensures type safety across actions
export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateWorkspaceData {
  userId: string;
  name: string;
}

export interface CreateTableData {
  workspaceId: number;
  name: string;
}

export interface CreateFieldData {
  tableId: number;
  name: string;
  type: string;
  required?: boolean;
  relatedTableId?: number;
}

export interface CreateRowData {
  tableId: number;
  data: Record<string, any>;
}

export interface UpdateRowData {
  rowId: string;
  tableId: number;
  data: Record<string, any>;
}