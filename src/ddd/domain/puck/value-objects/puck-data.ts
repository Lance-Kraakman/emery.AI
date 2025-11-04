// AIDEV-NOTE: PuckData value object wrapping Puck's JSON structure
// Provides type safety and validation for Puck template data

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

/**
 * Puck Data structure representing the visual editor's JSON format
 * This matches the structure used by @measured/puck
 */
export interface PuckDataStructure {
  content: Array<{
    type: string;
    props: {
      id: string;
      [key: string]: any;
    };
  }>;
  root: Record<string, any>;
  zones?: Record<string, Array<{ type: string; props: any }>>;
}

export class PuckData {
  private constructor(private readonly _data: PuckDataStructure) {}

  /**
   * Create PuckData from a raw object
   * Validates basic structure
   */
  static create(data: unknown): Result<PuckData> {
    // Validate that data is an object
    if (typeof data !== 'object' || data === null) {
      return ResultHelpers.failure('Puck data must be an object');
    }

    const puckData = data as any;

    // Validate required fields
    if (!Array.isArray(puckData.content)) {
      return ResultHelpers.failure('Puck data must have a content array');
    }

    if (typeof puckData.root !== 'object' || puckData.root === null) {
      return ResultHelpers.failure('Puck data must have a root object');
    }

    // Validate content array structure
    for (const item of puckData.content) {
      if (typeof item !== 'object' || item === null) {
        return ResultHelpers.failure('Each content item must be an object');
      }
      if (typeof item.type !== 'string') {
        return ResultHelpers.failure('Each content item must have a type string');
      }
      if (typeof item.props !== 'object' || item.props === null) {
        return ResultHelpers.failure('Each content item must have a props object');
      }
      if (typeof item.props.id !== 'string') {
        return ResultHelpers.failure('Each content item props must have an id string');
      }
    }

    // Validate zones if present
    if (puckData.zones !== undefined) {
      if (typeof puckData.zones !== 'object' || puckData.zones === null || Array.isArray(puckData.zones)) {
        return ResultHelpers.failure('Puck zones must be an object');
      }

      for (const zone of Object.values(puckData.zones)) {
        if (!Array.isArray(zone)) {
          return ResultHelpers.failure('Each zone must be an array');
        }
      }
    }

    return ResultHelpers.success(new PuckData(puckData as PuckDataStructure));
  }

  /**
   * Create empty PuckData (for new pages)
   */
  static empty(): PuckData {
    return new PuckData({
      content: [],
      root: {},
      zones: {}
    });
  }

  /**
   * Create PuckData from JSON string
   */
  static fromJson(json: string): Result<PuckData> {
    try {
      const parsed = JSON.parse(json);
      return PuckData.create(parsed);
    } catch (error) {
      return ResultHelpers.failure(
        `Failed to parse Puck data JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the underlying data structure
   */
  get data(): PuckDataStructure {
    return this._data;
  }

  /**
   * Check if the data is empty (no content)
   */
  isEmpty(): boolean {
    return this._data.content.length === 0;
  }

  /**
   * Get the number of content items
   */
  get contentCount(): number {
    return this._data.content.length;
  }

  /**
   * Convert to JSON string
   */
  toJson(): string {
    return JSON.stringify(this._data);
  }

  /**
   * Convert to database-compatible format
   */
  toDatabaseJson(): Record<string, any> {
    return this._data;
  }

  /**
   * Check equality with another PuckData
   */
  equals(other: PuckData): boolean {
    return JSON.stringify(this._data) === JSON.stringify(other._data);
  }

  toString(): string {
    return `PuckData(${this.contentCount} items)`;
  }
}
