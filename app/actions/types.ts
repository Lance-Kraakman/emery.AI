// AIDEV-NOTE: Shared types for Server Actions - ensures type safety across actions
export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Field {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: string; // Using string instead of union for flexibility
  orderIndex: number | null;
  relatedTableId: number | null;
  required: boolean | null;
  createdAt: Date | null;
}

export interface Row {
  id: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
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