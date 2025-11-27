// AIDEV-NOTE: PageSlug value object for URL-safe page identifiers
// Validates slug format for use in URL routing (no leading slash, consistent with org/app slugs)

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class PageSlug {
  private constructor(private readonly _value: string) {}

  /**
   * Create a PageSlug from a string value
   * Validates that the slug is URL-safe and suitable for routing
   * Should NOT include leading slash (consistent with org/app slugs)
   */
  static create(value: string): Result<PageSlug> {
    // Trim whitespace
    const trimmed = value.trim();

    // Check if empty
    if (!trimmed) {
      return ResultHelpers.failure('Page slug cannot be empty');
    }

    // Check length
    if (trimmed.length < 1) {
      return ResultHelpers.failure('Page slug must be at least 1 character');
    }

    if (trimmed.length > 200) {
      return ResultHelpers.failure('Page slug cannot exceed 200 characters');
    }

    // Validate format: lowercase letters, numbers, and hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(trimmed)) {
      return ResultHelpers.failure(
        'Page slug must contain only lowercase letters, numbers, and hyphens'
      );
    }

    // Disallow consecutive hyphens
    if (trimmed.includes('--')) {
      return ResultHelpers.failure('Page slug cannot contain consecutive hyphens');
    }

    // Disallow leading/trailing hyphens
    if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
      return ResultHelpers.failure('Page slug cannot start or end with a hyphen');
    }

    return ResultHelpers.success(new PageSlug(trimmed));
  }

  /**
   * Generate a slug from a page name (helper for user convenience)
   */
  static fromName(name: string): Result<PageSlug> {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return PageSlug.create(slug);
  }

  get value(): string {
    return this._value;
  }

  equals(other: PageSlug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
