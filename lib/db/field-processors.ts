/**
 * Field processing utilities for handling Baserow-style JSONB fields
 * AIDEV-NOTE: Centralized JSONB processing for relation and file fields similar to Baserow
 */
import { db } from './client';
import { fields } from './schema';
import { eq } from "drizzle-orm";

export interface FieldProcessingOptions {
  validateRequired?: boolean;
  debug?: boolean;
}

/**
 * Processes raw input data against table fields to prepare it for database insertion.
 * - Maps data from slugs/names to `field_ID` keys.
 * - Validates required fields.
 * - Handles JSON parsing for relation/file fields.
 */
export async function processRowData(
  tableId: number,
  data: Record<string, any>,
  options: FieldProcessingOptions = {}
) {
  const { validateRequired = true, debug = false } = options;

  if (debug) {
    console.log(`[PROCESS-ROW] Processing data for table ${tableId}:`, JSON.stringify(data, null, 2));
  }

  const tableFields = await db.select().from(fields).where(eq(fields.tableId, tableId));
  
  if (debug) {
    console.log(`[PROCESS-ROW] Found ${tableFields.length} fields:`, tableFields.map(f => ({ id: f.id, name: f.name, slug: f.slug, type: f.type, required: f.required })));
  }

  const processedData: Record<string, any> = {};

  for (const field of tableFields) {
    const fieldKey = `field_${field.id}`;
    const value = data[field.slug] || data[field.name];

    if (debug) {
      console.log(`[PROCESS-ROW] Field ${field.name} (${fieldKey}): ${field.slug}="${data[field.slug]}" OR ${field.name}="${data[field.name]}" => ${value}`);
    }

    if (validateRequired && field.required && (value === undefined || value === null || value === "")) {
      throw new Error(`Field '${field.name}' is required`);
    }

    if (value !== undefined && value !== null) {
      if (field.type === 'relation') {
        // For relation fields, parse if stringified JSON
        if (typeof value === 'string') {
          try {
            processedData[fieldKey] = JSON.parse(value);
          } catch {
            processedData[fieldKey] = value; // Keep as string if parsing fails
          }
        } else {
          processedData[fieldKey] = value;
        }
      } else if (field.type === 'file') {
        // For file fields, ensure it's an array of objects with a URL
        const files = Array.isArray(value) ? value : [value];
        processedData[fieldKey] = files.map((file: any) => {
          if (typeof file === 'string') {
            return { url: file };
          }
          return file;
        });
      } else {
        processedData[fieldKey] = value;
      }
    }
  }

  if (debug) {
    console.log(`[PROCESS-ROW] Processed data:`, JSON.stringify(processedData, null, 2));
  }

  return processedData;
}

/**
 * Processes partial data for updates.
 * - Does not validate required fields.
 * - Maps data from slugs/names to `field_ID` keys.
 * - Handles JSON parsing for relation/file fields.
 */
export async function processPartialRowData(
  tableId: number,
  data: Record<string, any>,
  options: { debug?: boolean } = {}
) {
  const tableFields = await db.select().from(fields).where(eq(fields.tableId, tableId));
  const processedData: Record<string, any> = {};

  for (const field of tableFields) {
    const fieldKey = `field_${field.id}`;
    // Check if the field exists in the input data by slug or name
    if (data.hasOwnProperty(field.slug) || data.hasOwnProperty(field.name)) {
      const value = data[field.slug] ?? data[field.name];

      if (options.debug) {
        console.log(`[PROCESS-PARTIAL] Field ${field.name} (${fieldKey}): value=${value}`);
      }

      if (value !== undefined && value !== null) {
        if (field.type === 'relation') {
          if (typeof value === 'string') {
            try {
              processedData[fieldKey] = JSON.parse(value);
            } catch {
              processedData[fieldKey] = value;
            }
          } else {
            processedData[fieldKey] = value;
          }
        } else if (field.type === 'file') {
          const files = Array.isArray(value) ? value : [value];
          processedData[fieldKey] = files.map((file: any) => {
            if (typeof file === 'string') {
              return { url: file };
            }
            return file;
          });
        } else {
          processedData[fieldKey] = value;
        }
      } else {
        // Explicitly set null values if provided
        processedData[fieldKey] = null;
      }
    }
  }
  
  if (options.debug) {
    console.log(`[PROCESS-PARTIAL] Processed data:`, JSON.stringify(processedData, null, 2));
  }

  return processedData;
}
