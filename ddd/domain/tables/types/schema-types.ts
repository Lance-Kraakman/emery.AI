/**
 * Schema Types
 * 
 * Minimal schema types to replace the bloated Zod-based table-schema system.
 * Contains only what's actually used in the codebase.
 */

import type { FieldType } from '@/ddd/domain/fields/entities/field';

/**
 * Field schema for Arrow conversion
 */
export interface FieldSchema {
  id: number;
  name: string;
  slug: string;
  type: FieldType;
  required: boolean;
  orderIndex: number;
}

/**
 * Table schema for Arrow conversion
 */
export interface TableSchema {
  id: number;
  databaseId: number;
  organizationId: number;
  name: string;
  fields: FieldSchema[];
  s3Path: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}