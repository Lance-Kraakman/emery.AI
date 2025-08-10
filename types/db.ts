export interface Table {
  id: number;
  organizationId: number;
  name: string;
  dbName: string;
  createdBy: string;
  createdAt: Date | null;
}

export interface FieldData {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: "text" | "number" | "boolean" | "email" | "url" | "date" | "relation" | "file";
  orderIndex: number | null;
  relatedTableId?: number | null;
  required: boolean | null;
  createdAt: Date | null;
}

export interface RowData {
  id: string;
  [key: string]: any;
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

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  s3Key: string;
  uploadedAt: string;
}
