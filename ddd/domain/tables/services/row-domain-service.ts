/**
 * Row Domain Service
 * 
 * Pure domain service for row-related business logic and operations.
 * Contains no infrastructure dependencies - only domain rules and logic.
 * Used by DynamicTableService to handle row-specific business operations.
 * 
 * AIDEV-NOTE: Domain service for row operations - pure business logic only,
 * no infrastructure dependencies. Moved from application layer to domain.
 */

import type { Field } from '@/ddd/domain/fields/entities/field';
import { Row, RowCollection } from '@/ddd/domain/tables/value-objects/row';
import { FieldProcessor } from '@/ddd/domain/fields/services/field-processor';

export interface RowValidationResult {
  valid: boolean;
  errors: Array<{ field: string; error: string }>;
}

export interface RowProcessingResult {
  processedData: Record<string, any>;
  columnData: Record<string, any>;
}

/**
 * Domain service for row business logic
 */
export class RowDomainService {
  private readonly fieldProcessor = new FieldProcessor();

  /**
   * Validate row data against field definitions
   */
  validateRowData(fields: Field[], data: Record<string, any>): RowValidationResult {
    return this.fieldProcessor.validateRowData(fields, data);
  }

  /**
   * Process row data for storage (convert field values to storage format)
   */
  processRowForStorage(fields: Field[], data: Record<string, any>): Record<string, any> {
    return this.fieldProcessor.processRowForStorage(fields, data);
  }

  /**
   * Process row data from storage (convert from storage format to domain format)
   */
  processRowFromStorage(fields: Field[], data: Record<string, any>): Record<string, any> {
    return this.fieldProcessor.processRowFromStorage(fields, data);
  }

  /**
   * Create a domain Row object from plain data
   */
  createRowFromData(
    data: Record<string, any>, 
    tableId: number, 
    fields: Field[]
  ): Row {
    const fieldSlugs = fields.map(f => f.slug);
    const fieldTypes = fields.reduce((acc, f) => ({ ...acc, [f.slug]: f.type }), {});
    
    return Row.fromPlainObject(data, tableId, fieldSlugs, fieldTypes);
  }

  /**
   * Create a RowCollection from multiple plain data objects
   */
  createRowCollectionFromData(
    rowsData: Array<Record<string, any>>, 
    tableId: number, 
    fields: Field[]
  ): RowCollection {
    const fieldSlugs = fields.map(f => f.slug);
    const fieldTypes = fields.reduce((acc, f) => ({ ...acc, [f.slug]: f.type }), {});
    
    return RowCollection.fromPlainObjects(rowsData, tableId, fieldSlugs, fieldTypes);
  }

  /**
   * Validate bulk row data operations
   */
  validateBulkRowData(fields: Field[], rowsData: Array<Record<string, any>>): {
    valid: boolean;
    errors: Array<{ row: number; errors: Array<{ field: string; error: string }> }>;
  } {
    const validationErrors: Array<{ row: number; errors: Array<{ field: string; error: string }> }> = [];
    
    for (let i = 0; i < rowsData.length; i++) {
      const validation = this.validateRowData(fields, rowsData[i]);
      if (!validation.valid) {
        validationErrors.push({ row: i, errors: validation.errors });
      }
    }

    return {
      valid: validationErrors.length === 0,
      errors: validationErrors
    };
  }

  /**
   * Process bulk row data for storage
   */
  processBulkRowsForStorage(fields: Field[], rowsData: Array<Record<string, any>>): Array<Record<string, any>> {
    return rowsData.map(rowData => this.processRowForStorage(fields, rowData));
  }

  /**
   * Process bulk row data from storage
   */
  processBulkRowsFromStorage(fields: Field[], rowsData: Array<Record<string, any>>): Array<Record<string, any>> {
    return rowsData.map(rowData => this.processRowFromStorage(fields, rowData));
  }

  /**
   * Check if row data contains file fields that need special handling
   */
  hasFileFields(fields: Field[], data: Record<string, any>): boolean {
    const fileFields = fields.filter(f => f.type === 'file');
    return fileFields.some(field => data[field.slug] !== undefined && data[field.slug] !== null);
  }

  /**
   * Get file fields from row data
   */
  getFileFieldsFromData(fields: Field[], data: Record<string, any>): Array<{ field: Field; value: any }> {
    const fileFields = fields.filter(f => f.type === 'file');
    return fileFields
      .filter(field => data[field.slug] !== undefined && data[field.slug] !== null)
      .map(field => ({ field, value: data[field.slug] }));
  }

  /**
   * Validate row update data (partial updates allowed)
   */
  validateRowUpdateData(fields: Field[], updateData: Record<string, any>): RowValidationResult {
    // For updates, we only validate the fields being updated
    const fieldsToValidate = fields.filter(field => updateData[field.slug] !== undefined);
    
    // Create a temporary object with only the fields being updated
    const dataToValidate: Record<string, any> = {};
    for (const field of fieldsToValidate) {
      dataToValidate[field.slug] = updateData[field.slug];
    }

    return this.fieldProcessor.validateRowData(fieldsToValidate, dataToValidate, true); // partial validation
  }

  /**
   * Business rule: Check if row can be deleted
   */
  canDeleteRow(row: Row, fields: Field[]): { canDelete: boolean; reason?: string } {
    // Example business rules - customize based on your needs
    
    // Check if row has required relationships
    const relationFields = fields.filter(f => f.type === 'relation' && f.required);
    for (const field of relationFields) {
      const relationValue = row.getValue(field.slug);
      if (relationValue && Array.isArray(relationValue) && relationValue.length > 0) {
        // Could add logic here to check if relationships would be broken
      }
    }

    // For now, allow all deletions
    return { canDelete: true };
  }

  /**
   * Business rule: Check if row can be updated
   */
  canUpdateRow(
    existingRow: Row, 
    updateData: Record<string, any>, 
    fields: Field[]
  ): { canUpdate: boolean; reason?: string } {
    // Example business rules - customize based on your needs
    
    // Check if required fields are being removed
    const requiredFields = fields.filter(f => f.required);
    for (const field of requiredFields) {
      if (updateData.hasOwnProperty(field.slug) && 
          (updateData[field.slug] === null || updateData[field.slug] === undefined || updateData[field.slug] === '')) {
        return {
          canUpdate: false,
          reason: `Required field ${field.name} cannot be empty`
        };
      }
    }

    return { canUpdate: true };
  }
}