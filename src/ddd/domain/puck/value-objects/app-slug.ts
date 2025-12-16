// AIDEV-NOTE: AppSlug value object for URL-safe app identifiers
// Validates slug format and ensures URL compatibility

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class AppSlug {
  private constructor(private readonly _value: string) {}

  /**
   * Create an AppSlug from a string value
   * Validates that the slug is URL-safe and follows conventions
   */
  static create(value: string): Result<AppSlug> {
    // Trim whitespace
    const trimmed = value.trim();

    // Check if empty
    if (!trimmed) {
      return ResultHelpers.failure('App slug cannot be empty');
    }

    // Check length (reasonable limits for URLs)
    if (trimmed.length < 2) {
      return ResultHelpers.failure('App slug must be at least 2 characters');
    }

    if (trimmed.length > 100) {
      return ResultHelpers.failure('App slug cannot exceed 100 characters');
    }

    // Validate format: lowercase letters, numbers, hyphens only
    // Must start with letter, cannot end with hyphen
    const slugRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
    if (!slugRegex.test(trimmed)) {
      return ResultHelpers.failure(
        'App slug must start with a letter, contain only lowercase letters, numbers, and hyphens, and cannot end with a hyphen'
      );
    }

    // Disallow consecutive hyphens
    if (trimmed.includes('--')) {
      return ResultHelpers.failure('App slug cannot contain consecutive hyphens');
    }

    return ResultHelpers.success(new AppSlug(trimmed));
  }

  /**
   * Generate a slug from a name (helper for user convenience)
   */
  static fromName(name: string): Result<AppSlug> {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return AppSlug.create(slug);
  }

  get value(): string {
    return this._value;
  }

  equals(other: AppSlug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
