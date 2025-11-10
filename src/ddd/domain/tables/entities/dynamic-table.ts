// AIDEV-NOTE: Dynamic Table domain entity with table-owns-fields approach
// Entity manages its own fields and handles validation/data processing internally

import type { TableMetadata } from '../value-objects/table-metadata';
import { TableField } from '../value-objects/table-field';
import type { FieldValidationResult, FieldValidationError } from '../value-objects/field-values';
import { TableId, DatabaseId, OrganizationId, UserId, FieldId } from '@/ddd/domain/shared/value-objects';

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

  /**
   * Update the table's timestamp to trigger RAG reindexing
   * Called after row operations to ensure RAG indexes stay synchronized
   */
  touch(): void {
    this._updatedAt = new Date();
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
  getFieldById(fieldId: FieldId): TableField | undefined {
    return this._fields.find(field => field.id.value === fieldId.value);
  }

  // ===== FIELD MUTATION METHODS (for aggregate consistency) =====

  /**
   * Add a field to the table (within aggregate boundary)
   */
  addField(field: TableField): void {
    // AIDEV-NOTE: Prevent creating field named 'id' (reserved for system row identifier)
    if (field.name.toLowerCase() === 'id') {
      throw new Error(`Field name 'id' is reserved for the system row identifier. Please choose a different name.`);
    }

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
  updateField(fieldId: FieldId, updatedField: TableField): void {
    const index = this._fields.findIndex(f => f.id.value === fieldId.value);
    if (index === -1) {
      throw new Error(`Field with ID ${fieldId} not found`);
    }
    
    this._fields[index] = updatedField;
    this._updatedAt = new Date();
  }

  /**
   * Remove a field from the table
   */
  removeField(fieldId: FieldId): void {
    const index = this._fields.findIndex(f => f.id.value === fieldId.value);
    if (index === -1) {
      throw new Error(`Field with ID ${fieldId} not found`);
    }
    
    this._fields.splice(index, 1);
    this._updatedAt = new Date();
  }

  // ===== TABLE-OWNS-FIELDS METHODS =====

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