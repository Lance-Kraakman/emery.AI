import { InferSelectModel } from 'drizzle-orm';
import { agents, teams, tables, fields, users, invitations } from '@/lib/db/schema';

export type Agent = InferSelectModel<typeof agents>;
export type Team = InferSelectModel<typeof teams>;
export type Table = InferSelectModel<typeof tables>;
export type FieldData = InferSelectModel<typeof fields>;
export type User = InferSelectModel<typeof users>;
export type InvitationRow = InferSelectModel<typeof invitations>;


export interface RowData {
  id: string;
  [key: string]: any;
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
