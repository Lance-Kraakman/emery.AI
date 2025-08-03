export interface Workspace {
  id: number;
  userId: string;
  name: string;
  createdAt: Date;
}

export interface Table {
  id: number;
  workspaceId: number;
  name: string;
  dbName: string;
  createdAt: Date;
}

export interface Field {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: "text" | "number" | "boolean" | "relation";
  orderIndex: number;
  relatedTableId?: number;
  required: boolean;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
}

export interface DynamicRow {
  id: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: any;
}