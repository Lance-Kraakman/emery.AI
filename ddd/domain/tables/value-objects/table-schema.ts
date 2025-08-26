/**
 * Table Schema Value Object
 * 
 * Defines the structure and validation for table schemas using Zod.
 * Handles complex field types including files and relations for S3 storage.
 * 
 * AIDEV-NOTE: Core domain value object for table schema validation with Zod
 */

import { z } from 'zod';

// Field type definitions with validation
export const FieldTypeSchema = z.enum([
  'text',
  'number', 
  'boolean',
  'date',
  'email',
  'url',
  'file',
  'relation'
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

// File field configuration
export const FileFieldConfigSchema = z.object({
  allowedTypes: z.array(z.string()).optional(), // ['image/*', '.pdf', etc.]
  maxSize: z.number().optional(), // in bytes
  multiple: z.boolean().optional() // Allow multiple file uploads
});

// Relation field configuration  
export const RelationFieldConfigSchema = z.object({
  targetTableId: z.number(),
  relationshipType: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
  displayField: z.string().optional() // which field to show in the relation
});

// Base field schema
export const FieldSchemaSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  slug: z.string().min(1),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  orderIndex: z.number().default(0),
  
  // Type-specific configurations
  fileConfig: FileFieldConfigSchema.optional(),
  relationConfig: RelationFieldConfigSchema.optional(),
  
  // Generic metadata for extensions
  metadata: z.record(z.any()).optional()
});

export type FieldSchema = z.infer<typeof FieldSchemaSchema>;

// Full table schema
export const TableSchemaSchema = z.object({
  id: z.number(),
  databaseId: z.number(),
  organizationId: z.number(),
  name: z.string().min(1),
  fields: z.array(FieldSchemaSchema),
  s3Path: z.string(), // S3 path for the table's parquet files
  createdAt: z.date(),
  updatedAt: z.date(),
  
  // Optional metadata
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type TableSchema = z.infer<typeof TableSchemaSchema>;

// Table manifest schema (stored in S3 alongside data)
export const TableManifestSchema = z.object({
  tableId: z.number(),
  schema: TableSchemaSchema,
  version: z.number(),
  lastModified: z.date(),
  rowCount: z.number(),
  partitions: z.array(z.object({
    path: z.string(),
    rowCount: z.number(),
    createdAt: z.date()
  }))
});

export type TableManifest = z.infer<typeof TableManifestSchema>;

// Row data validation schema generator
export class TableSchemaValidator {
  static createRowSchema(tableSchema: TableSchema): z.ZodSchema {
    const shape: Record<string, z.ZodSchema> = {};
    
    for (const field of tableSchema.fields) {
      let fieldSchema: z.ZodSchema;
      
      switch (field.type) {
        case 'text':
        case 'email':
        case 'url':
          fieldSchema = z.string();
          break;
          
        case 'number':
          fieldSchema = z.number();
          break;
          
        case 'boolean':
          fieldSchema = z.boolean();
          break;
          
        case 'date':
          fieldSchema = z.date().or(z.string().datetime());
          break;
          
        case 'file':
          fieldSchema = z.object({
            key: z.string(),
            name: z.string(),
            size: z.number(),
            type: z.string(),
            url: z.string().optional()
          }).or(z.array(z.object({
            key: z.string(),
            name: z.string(),
            size: z.number(),
            type: z.string(),
            url: z.string().optional()
          })));
          break;
          
        case 'relation':
          fieldSchema = z.object({
            id: z.union([z.string(), z.number()]),
            displayValue: z.string().optional()
          }).or(z.array(z.object({
            id: z.union([z.string(), z.number()]),
            displayValue: z.string().optional()
          })));
          break;
          
        default:
          fieldSchema = z.any();
      }
      
      // Make optional if not required
      if (!field.required) {
        fieldSchema = fieldSchema.optional();
      }
      
      shape[field.slug] = fieldSchema;
    }
    
    return z.object(shape);
  }
  
  static validateRow(tableSchema: TableSchema, rowData: any): { success: boolean; data?: any; errors?: string[] } {
    try {
      const rowSchema = this.createRowSchema(tableSchema);
      const result = rowSchema.safeParse(rowData);
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        return { 
          success: false, 
          errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
    } catch (error) {
      return { 
        success: false, 
        errors: [error instanceof Error ? error.message : 'Validation failed'] 
      };
    }
  }
}