// AIDEV-NOTE: PageSlug value object for URL-safe page route paths
// Validates slug format for use in URL routing (can include forward slashes)

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class PageSlug {
  private constructor(private readonly _value: string) {}

  /**
   * Create a PageSlug from a string value
   * Validates that the slug is URL-safe and suitable for routing
   * Can contain forward slashes for nested routes (e.g., "/products/pricing")
   */
  static create(value: string): Result<PageSlug> {
    // Trim whitespace
    const trimmed = value.trim();

    // Check if empty
    if (!trimmed) {
      return ResultHelpers.failure('Page slug cannot be empty');
    }

    // Ensure it starts with a forward slash
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    // Check length
    if (normalized.length < 2) {
      return ResultHelpers.failure('Page slug must be at least 2 characters (including leading /)');
    }

    if (normalized.length > 200) {
      return ResultHelpers.failure('Page slug cannot exceed 200 characters');
    }

    // Validate format: /path/to/page with lowercase, numbers, hyphens, underscores
    // Each segment must start with alphanumeric
    const slugRegex = /^\/[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/;
    if (!slugRegex.test(normalized)) {
      return ResultHelpers.failure(
        'Page slug must start with /, contain only lowercase letters, numbers, hyphens, underscores, and forward slashes. Each segment must start and end with alphanumeric characters'
      );
    }

    // Disallow consecutive slashes or hyphens
    if (normalized.includes('//') || normalized.includes('--')) {
      return ResultHelpers.failure('Page slug cannot contain consecutive slashes or hyphens');
    }

    // Disallow trailing slash (except for root "/")
    if (normalized.length > 1 && normalized.endsWith('/')) {
      return ResultHelpers.failure('Page slug cannot end with a slash (except root path)');
    }

    return ResultHelpers.success(new PageSlug(normalized));
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

    return PageSlug.create(`/${slug}`);
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

  /**
   * Get the path without the leading slash (useful for routing)
   */
  get pathWithoutLeadingSlash(): string {
    return this._value.substring(1);
  }
}
