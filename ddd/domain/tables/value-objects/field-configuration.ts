/**
 * Field Configuration Value Object
 * 
 * Encapsulates field configuration data with type safety and validation.
 * Bridges the gap between database JSONB storage and domain types.
 * 
 * AIDEV-NOTE: Domain value object for field configuration following S3TablePath pattern
 */

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import type { FileFieldConfig, RelationValue } from '@/ddd/domain/fields/entities/field';

export class FieldConfiguration {
  private constructor(
    private readonly _fileConfig?: FileFieldConfig,
    private readonly _relationConfig?: RelationValue,
    private readonly _extra: Readonly<Record<string, unknown>> = {}
  ) {}

  /**
   * Create FieldConfiguration from database JSONB data
   */
  static fromDatabase(jsonb: unknown): Result<FieldConfiguration> {
    try {
      if (jsonb === null || jsonb === undefined) {
        return ResultHelpers.success(this.empty());
      }

      if (typeof jsonb !== 'object') {
        return ResultHelpers.failure('Field configuration must be an object');
      }

      const data = jsonb as Record<string, unknown>;
      
      // Parse file configuration
      let fileConfig: FileFieldConfig | undefined;
      if (data.fileConfig && typeof data.fileConfig === 'object') {
        const fileResult = this.parseFileConfig(data.fileConfig);
        if (!fileResult.success) {
          return ResultHelpers.failure(`Invalid file config: ${fileResult.error}`);
        }
        fileConfig = fileResult.data;
      } else if (data.allowedTypes || data.maxSize || data.maxFiles || data.multiple) {
        // Legacy: file config properties directly on the object
        const fileResult = this.parseFileConfig(data);
        if (!fileResult.success) {
          return ResultHelpers.failure(`Invalid file config: ${fileResult.error}`);
        }
        fileConfig = fileResult.data;
      }

      // Parse relation configuration
      let relationConfig: RelationValue | undefined;
      if (data.relationConfig && typeof data.relationConfig === 'object') {
        const relationResult = this.parseRelationConfig(data.relationConfig);
        if (!relationResult.success) {
          return ResultHelpers.failure(`Invalid relation config: ${relationResult.error}`);
        }
        relationConfig = relationResult.data;
      } else if (data.targetTableId || data.relationshipType || data.displayField) {
        // Legacy: relation config properties directly on the object
        const relationResult = this.parseRelationConfig(data);
        if (!relationResult.success) {
          return ResultHelpers.failure(`Invalid relation config: ${relationResult.error}`);
        }
        relationConfig = relationResult.data;
      }

      // Extract extra properties (excluding known config types)
      const extra = this.extractExtraProperties(data);
      
      return ResultHelpers.success(
        new FieldConfiguration(fileConfig, relationConfig, extra)
      );
      
    } catch (error) {
      return ResultHelpers.failure(
        `Failed to parse field configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse file configuration from object
   */
  private static parseFileConfig(data: unknown): Result<FileFieldConfig> {
    if (typeof data !== 'object' || data === null) {
      return ResultHelpers.failure('File config must be an object');
    }

    const config = data as Record<string, unknown>;
    const result: FileFieldConfig = {};

    // Parse allowedTypes
    if (config.allowedTypes !== undefined) {
      if (!Array.isArray(config.allowedTypes)) {
        return ResultHelpers.failure('allowedTypes must be an array');
      }
      if (!config.allowedTypes.every(type => typeof type === 'string')) {
        return ResultHelpers.failure('All allowedTypes must be strings');
      }
      result.allowedTypes = config.allowedTypes as string[];
    }

    // Parse maxSize
    if (config.maxSize !== undefined) {
      if (typeof config.maxSize !== 'number' || config.maxSize <= 0) {
        return ResultHelpers.failure('maxSize must be a positive number');
      }
      result.maxSize = config.maxSize;
    }

    // Parse maxFiles
    if (config.maxFiles !== undefined) {
      if (typeof config.maxFiles !== 'number' || config.maxFiles <= 0 || !Number.isInteger(config.maxFiles)) {
        return ResultHelpers.failure('maxFiles must be a positive integer');
      }
      result.maxFiles = config.maxFiles;
    }

    // Parse multiple flag
    if (config.multiple !== undefined) {
      if (typeof config.multiple !== 'boolean') {
        return ResultHelpers.failure('multiple must be a boolean');
      }
      result.multiple = config.multiple;
    }

    // Parse boolean flags
    const booleanFields = ['generateThumbnails', 'compressionEnabled'] as const;
    for (const field of booleanFields) {
      if (config[field] !== undefined) {
        if (typeof config[field] !== 'boolean') {
          return ResultHelpers.failure(`${field} must be a boolean`);
        }
        (result as any)[field] = config[field];
      }
    }

    // Parse string fields
    const stringFields = ['s3BucketName'] as const;
    for (const field of stringFields) {
      if (config[field] !== undefined) {
        if (typeof config[field] !== 'string') {
          return ResultHelpers.failure(`${field} must be a string`);
        }
        (result as any)[field] = config[field];
      }
    }

    // Parse thumbnailSizes
    if (config.thumbnailSizes !== undefined) {
      if (!Array.isArray(config.thumbnailSizes)) {
        return ResultHelpers.failure('thumbnailSizes must be an array');
      }
      if (!config.thumbnailSizes.every(size => typeof size === 'string')) {
        return ResultHelpers.failure('All thumbnailSizes must be strings');
      }
      result.thumbnailSizes = config.thumbnailSizes as string[];
    }

    return ResultHelpers.success(result);
  }

  /**
   * Parse relation configuration from object
   */
  private static parseRelationConfig(data: unknown): Result<RelationValue> {
    if (typeof data !== 'object' || data === null) {
      return ResultHelpers.failure('Relation config must be an object');
    }

    const config = data as Record<string, unknown>;
    
    // Required field: id (for RelationValue)
    if (!config.id || typeof config.id !== 'string') {
      return ResultHelpers.failure('Relation config must have a string id');
    }

    const result: RelationValue = {
      id: config.id
    };

    // Optional displayValue
    if (config.displayValue !== undefined) {
      if (typeof config.displayValue !== 'string') {
        return ResultHelpers.failure('displayValue must be a string');
      }
      result.displayValue = config.displayValue;
    }

    // Include any extra properties
    const { id: _, displayValue: __, ...extra } = config;
    Object.assign(result, extra);

    return ResultHelpers.success(result);
  }

  /**
   * Create empty configuration
   */
  static empty(): FieldConfiguration {
    return new FieldConfiguration();
  }

  /**
   * Create configuration with specific values
   */
  static create(options: {
    fileConfig?: FileFieldConfig;
    relationConfig?: RelationValue;
    extra?: Record<string, unknown>;
  }): Result<FieldConfiguration> {
    const { fileConfig, relationConfig, extra = {} } = options;

    // Validate extra properties
    if (typeof extra !== 'object' || extra === null || Array.isArray(extra)) {
      return ResultHelpers.failure('Extra properties must be a plain object');
    }

    return ResultHelpers.success(
      new FieldConfiguration(fileConfig, relationConfig, extra)
    );
  }

  // Getters
  get fileConfig(): FileFieldConfig | undefined {
    return this._fileConfig;
  }

  get relationConfig(): RelationValue | undefined {
    return this._relationConfig;
  }

  get hasFileConfig(): boolean {
    return this._fileConfig !== undefined;
  }

  get hasRelationConfig(): boolean {
    return this._relationConfig !== undefined;
  }

  get hasExtra(): boolean {
    return Object.keys(this._extra).length > 0;
  }

  /**
   * Get extra property by key
   */
  getExtra<T = unknown>(key: string): T | undefined {
    return this._extra[key] as T | undefined;
  }

  /**
   * Get all extra properties
   */
  getAllExtra(): Readonly<Record<string, unknown>> {
    return this._extra;
  }

  /**
   * Convert to database JSON format
   */
  toDatabaseJson(): Record<string, unknown> {
    const result: Record<string, unknown> = { ...this._extra };
    
    if (this._fileConfig) {
      result.fileConfig = this._fileConfig;
    }
    
    if (this._relationConfig) {
      result.relationConfig = this._relationConfig;
    }
    
    return result;
  }

  /**
   * Check if two configurations are equal
   */
  equals(other: FieldConfiguration): boolean {
    return (
      JSON.stringify(this._fileConfig) === JSON.stringify(other._fileConfig) &&
      JSON.stringify(this._relationConfig) === JSON.stringify(other._relationConfig) &&
      JSON.stringify(this._extra) === JSON.stringify(other._extra)
    );
  }

  toString(): string {
    const parts = [];
    if (this._fileConfig) parts.push('file');
    if (this._relationConfig) parts.push('relation');
    if (this.hasExtra) parts.push(`${Object.keys(this._extra).length} extra`);
    
    return `FieldConfiguration(${parts.join(', ')})`;
  }

  /**
   * Extract extra properties by excluding known configuration fields
   * Helper method to reduce complexity of destructuring pattern
   */
  private static extractExtraProperties(data: Record<string, unknown>): Record<string, unknown> {
    const knownFields = new Set([
      'fileConfig', 'relationConfig',
      // Legacy file config properties
      'allowedTypes', 'maxSize', 'maxFiles', 'multiple',
      // Legacy relation config properties  
      'targetTableId', 'relationshipType', 'displayField'
    ]);

    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!knownFields.has(key)) {
        extra[key] = value;
      }
    }
    return extra;
  }
}