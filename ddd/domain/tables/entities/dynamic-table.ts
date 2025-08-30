// AIDEV-NOTE: Dynamic Table domain entity with table-owns-fields approach
// Entity manages its own fields and handles validation/data processing internally

import type { TableMetadata } from '../value-objects/table-metadata';
import { TableField } from '../value-objects/table-field';
import type { RowData, ColumnData, FieldValidationResult, FieldValidationError } from '../value-objects/field-values';
import { TableId, DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export class DynamicTable {
  private constructor(
    private readonly _id: TableId,
    private readonly _databaseId: DatabaseId,              // References databases.id
    private readonly _organizationId: OrganizationId,      // References organizations.id (denormalized for RLS)
    private _name: string,                                 // Human-readable table name
    private _storageLocation: string,                      // Generic storage location (S3 path, table name, etc.)
    private _description: string | undefined,              // Optional description
    private _metadata: TableMetadata | undefined,         // Metadata using value object
    private _fields: TableField[],                        // Fields owned by this table (mutable within aggregate)
    private readonly _createdBy: UserId,                   // UUID reference to users.id
    private readonly _createdAt: Date | null,
    private _updatedAt: Date | null
  ) {}

  // Getters
  get id(): TableId { return this._id; }
  get databaseId(): DatabaseId { return this._databaseId; }
  get organizationId(): OrganizationId { return this._organizationId; }
  get name(): string { return this._name; }
  get storageLocation(): string { return this._storageLocation; }
  get description(): string | undefined { return this._description; }
  get metadata(): TableMetadata | undefined { return this._metadata; }
  get fields(): TableField[] { return [...this._fields]; } // Return copy to maintain encapsulation
  get createdBy(): UserId { return this._createdBy; }
  get createdAt(): Date | null { return this._createdAt ? new Date(this._createdAt) : null; }
  get updatedAt(): Date | null { return this._updatedAt ? new Date(this._updatedAt) : null; }

  // Business methods
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Table name cannot be empty');
    }
    if (newName.length > 100) {
      throw new Error('Table name cannot exceed 100 characters');
    }
    this._name = newName.trim();
    this._updatedAt = new Date();
  }

  updateDescription(newDescription: string | undefined): void {
    this._description = newDescription;
    this._updatedAt = new Date();
  }

  updateStorageLocation(newStorageLocation: string): void {
    if (!newStorageLocation || newStorageLocation.trim().length === 0) {
      throw new Error('Storage location cannot be empty');
    }
    this._storageLocation = newStorageLocation.trim();
    this._updatedAt = new Date();
  }

  updateMetadata(newMetadata: TableMetadata | undefined): void {
    this._metadata = newMetadata;
    this._updatedAt = new Date();
  }

  canBeDeleted(): boolean {
    // Add business logic for when tables can be deleted
    // For example, tables with dependent relations might not be deletable
    return true; // Placeholder - implement actual business rules
  }

  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._organizationId.equals(organizationId);
  }

  belongsToDatabase(databaseId: DatabaseId): boolean {
    return this._databaseId.equals(databaseId);
  }

  // ===== FIELD QUERY METHODS =====

  /**
   * Get a field by name
   */
  getField(fieldName: string): TableField | undefined {
    return this._fields.find(field => field.name === fieldName);
  }

  /**
   * Check if field exists by name
   */
  hasField(fieldName: string): boolean {
    return this._fields.some(field => field.name === fieldName);
  }

  /**
   * Get field by ID
   */
  getFieldById(fieldId: number): TableField | undefined {
    return this._fields.find(field => field.id === fieldId);
  }

  // ===== FIELD MUTATION METHODS (for aggregate consistency) =====

  /**
   * Add a field to the table (within aggregate boundary)
   */
  addField(field: TableField): void {
    // Check if field name already exists
    if (this._fields.some(f => f.name === field.name)) {
      throw new Error(`Field with name '${field.name}' already exists`);
    }
    
    this._fields.push(field);
    this._updatedAt = new Date();
  }

  /**
   * Update a field in the table
   */
  updateField(fieldId: number, updatedField: TableField): void {
    const index = this._fields.findIndex(f => f.id === fieldId);
    if (index === -1) {
      throw new Error(`Field with ID ${fieldId} not found`);
    }
    
    this._fields[index] = updatedField;
    this._updatedAt = new Date();
  }

  /**
   * Remove a field from the table
   */
  removeField(fieldId: number): void {
    const index = this._fields.findIndex(f => f.id === fieldId);
    if (index === -1) {
      throw new Error(`Field with ID ${fieldId} not found`);
    }
    
    this._fields.splice(index, 1);
    this._updatedAt = new Date();
  }

  // ===== TABLE-OWNS-FIELDS METHODS =====

  /**
   * Validate row data against this table's field definitions
   */
  validateRowData(data: RowData): FieldValidationResult {
    const errors: FieldValidationError[] = [];

    for (const field of this._fields) {
      const value = data[field.name];
      const validation = field.validateValue(value);
      
      if (!validation.valid && validation.error) {
        errors.push({
          field: field.name,
          error: validation.error
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Process row data for storage (convert field names to database column names)
   */
  processRowForStorage(data: RowData): ColumnData {
    const processed: ColumnData = {};
    
    for (const field of this._fields) {
      const value = data[field.name];
      const columnName = field.getColumnName();
      // Debug: console.log(`[DynamicTable] DEBUG processRowForStorage: field '${field.name}' -> column '${columnName}', value:`, value, 'type:', typeof value, 'isArray:', Array.isArray(value));
      processed[columnName] = this.processFieldValueForStorage(field, value);
    }
    
    return processed;
  }

  /**
   * Process row data from storage (convert database column names to field names)
   */
  processRowFromStorage(data: ColumnData): RowData {
    const processed: RowData = {};
    
    for (const field of this._fields) {
      const columnName = field.getColumnName();
      const value = data[columnName];
      processed[field.name] = this.processFieldValueFromStorage(field, value);
    }
    
    return processed;
  }

  // ===== PRIVATE FIELD PROCESSING HELPERS =====

  private processFieldValueForStorage(field: TableField, value: unknown): any {
    if (value === null || value === undefined) {
      return null;
    }

    switch (field.type) {
      case 'date':
        // Convert Date objects to ISO strings for storage
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      case 'relation':
      case 'file':
        // These are stored as JSONB - already in correct format
        return typeof value === 'object' ? value : value;
      default:
        return value;
    }
  }

  private processFieldValueFromStorage(field: TableField, value: unknown): any {
    if (value === null || value === undefined) {
      return null;
    }

    switch (field.type) {
      case 'date':
        // Convert ISO strings back to Date objects
        if (typeof value === 'string') {
          return new Date(value);
        }
        return value;
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }

  // Factory methods - entity only created from persistence with real ID
  static fromPersistence(data: {
    id: number;
    databaseId: number;
    organizationId: number;
    name: string;
    storageLocation: string;
    description?: string;
    metadata?: TableMetadata;
    fields: TableField[];
    createdBy: string;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }): DynamicTable {
    return new DynamicTable(
      TableId.fromNumber(data.id),
      DatabaseId.fromNumber(data.databaseId),
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      data.storageLocation,
      data.description,
      data.metadata,
      data.fields,
      UserId.fromString(data.createdBy),
      data.createdAt || null,
      data.updatedAt || null
    );
  }

  // Conversion method for persistence
  toPersistence(): {
    id: number;
    databaseId: number;
    organizationId: number;
    name: string;
    description: string | undefined;
    storageLocation: string;
    metadata?: TableMetadata;
    fields: TableField[];
    createdBy: string;
    createdAt: Date | null;
    updatedAt: Date | null;
  } {
    return {
      id: this._id.value,
      databaseId: this._databaseId.value,
      organizationId: this._organizationId.value,
      name: this._name,
      description: this._description,
      storageLocation: this._storageLocation,
      metadata: this._metadata,
      fields: this._fields,
      createdBy: this._createdBy.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}

// AIDEV-NOTE: Entity cleaned up - Command DTOs moved to application service
// Database entity exists in proper location: ddd/domain/databases/entities/database.ts
// Row types and query interfaces moved to proper value-objects or infrastructure types