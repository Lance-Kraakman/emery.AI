/**
 * Table Metadata Value Object
 * 
 * Encapsulates table metadata with validation and type safety.
 * Replaces loose `| null | undefined` metadata handling throughout the system.
 * 
 * AIDEV-NOTE: Domain value object for table metadata following S3TablePath pattern
 */

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class TableMetadata {
  private constructor(
    private readonly _description?: string,
    private readonly _tags: readonly string[] = [],
    private readonly _extra: Readonly<Record<string, unknown>> = {}
  ) {}

  /**
   * Create TableMetadata from database JSONB data
   */
  static fromDatabase(jsonb: unknown): Result<TableMetadata> {
    try {
      if (jsonb === null || jsonb === undefined) {
        return ResultHelpers.success(this.empty());
      }

      if (typeof jsonb !== 'object') {
        return ResultHelpers.failure('Table metadata must be an object');
      }

      const data = jsonb as Record<string, unknown>;
      
      // Validate and extract known fields
      const description = typeof data.description === 'string' ? data.description : undefined;
      
      let tags: string[] = [];
      if (Array.isArray(data.tags)) {
        const validTags = data.tags.filter((tag): tag is string => typeof tag === 'string');
        if (validTags.length !== data.tags.length) {
          return ResultHelpers.failure('All tags must be strings');
        }
        tags = validTags;
      } else if (data.tags !== undefined) {
        return ResultHelpers.failure('Tags must be an array of strings');
      }

      // Extract extra properties (excluding known fields)
      const { description: _, tags: __, ...extra } = data;
      
      return ResultHelpers.success(
        new TableMetadata(description, tags, extra)
      );
      
    } catch (error) {
      return ResultHelpers.failure(
        `Failed to parse table metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create empty metadata
   */
  static empty(): TableMetadata {
    return new TableMetadata();
  }

  /**
   * Create metadata with specific values
   */
  static create(options: {
    description?: string;
    tags?: string[];
    extra?: Record<string, unknown>;
  }): Result<TableMetadata> {
    const { description, tags = [], extra = {} } = options;

    // Validate tags
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      return ResultHelpers.failure('Tags must be an array of strings');
    }

    // Validate extra properties
    if (typeof extra !== 'object' || extra === null || Array.isArray(extra)) {
      return ResultHelpers.failure('Extra properties must be a plain object');
    }

    return ResultHelpers.success(
      new TableMetadata(description, tags, extra)
    );
  }

  /**
   * Create metadata from partial data - common pattern for application services
   * Handles the common case where we have description and/or metadata Record<string, any>
   */
  static fromPartial(options: {
    description?: string;
    metadata?: Record<string, any>;
  }): Result<TableMetadata> {
    if (!options.description && !options.metadata) {
      return ResultHelpers.success(TableMetadata.empty());
    }

    return TableMetadata.create({
      description: options.description,
      extra: options.metadata || {}
    });
  }

  // Getters
  get description(): string | undefined {
    return this._description;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  get hasDescription(): boolean {
    return this._description !== undefined && this._description.length > 0;
  }

  get hasTags(): boolean {
    return this._tags.length > 0;
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
    
    if (this._description !== undefined) {
      result.description = this._description;
    }
    
    if (this._tags.length > 0) {
      result.tags = this._tags;
    }
    
    return result;
  }

  /**
   * Create a new instance with updated description
   */
  withDescription(description?: string): TableMetadata {
    return new TableMetadata(description, this._tags, this._extra);
  }

  /**
   * Create a new instance with updated tags
   */
  withTags(tags: string[]): Result<TableMetadata> {
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
      return ResultHelpers.failure('Tags must be an array of strings');
    }
    
    return ResultHelpers.success(
      new TableMetadata(this._description, tags, this._extra)
    );
  }

  /**
   * Create a new instance with additional extra properties
   */
  withExtra(extra: Record<string, unknown>): Result<TableMetadata> {
    if (typeof extra !== 'object' || extra === null || Array.isArray(extra)) {
      return ResultHelpers.failure('Extra properties must be a plain object');
    }
    
    const merged = { ...this._extra, ...extra };
    
    return ResultHelpers.success(
      new TableMetadata(this._description, this._tags, merged)
    );
  }

  /**
   * Check if two metadata objects are equal
   */
  equals(other: TableMetadata): boolean {
    return (
      this._description === other._description &&
      this._tags.length === other._tags.length &&
      this._tags.every((tag, index) => tag === other._tags[index]) &&
      JSON.stringify(this._extra) === JSON.stringify(other._extra)
    );
  }

  toString(): string {
    const parts = [];
    if (this._description) parts.push(`desc: "${this._description}"`);
    if (this._tags.length > 0) parts.push(`tags: [${this._tags.join(', ')}]`);
    if (this.hasExtra) parts.push(`extra: ${Object.keys(this._extra).length} props`);
    
    return `TableMetadata(${parts.join(', ')})`;
  }
}