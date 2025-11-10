// AIDEV-NOTE: PageOrder value object for page ordering in navigation
// Encapsulates ordering logic and validation

import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class PageOrder {
  private constructor(private readonly _value: number) {}

  /**
   * Create a PageOrder from a number
   * Validates that the order is a non-negative integer
   */
  static create(value: number): Result<PageOrder> {
    // Validate that it's an integer
    if (!Number.isInteger(value)) {
      return ResultHelpers.failure('Page order must be an integer');
    }

    // Validate that it's non-negative
    if (value < 0) {
      return ResultHelpers.failure('Page order must be non-negative');
    }

    // Reasonable upper limit to prevent issues
    if (value > 10000) {
      return ResultHelpers.failure('Page order cannot exceed 10000');
    }

    return ResultHelpers.success(new PageOrder(value));
  }

  /**
   * Create a default page order (0)
   */
  static default(): PageOrder {
    return new PageOrder(0);
  }

  /**
   * Create the next order in sequence
   */
  next(): PageOrder {
    return new PageOrder(this._value + 1);
  }

  /**
   * Create the previous order in sequence
   */
  previous(): Result<PageOrder> {
    if (this._value === 0) {
      return ResultHelpers.failure('Cannot create order before 0');
    }
    return ResultHelpers.success(new PageOrder(this._value - 1));
  }

  get value(): number {
    return this._value;
  }

  equals(other: PageOrder): boolean {
    return this._value === other._value;
  }

  isGreaterThan(other: PageOrder): boolean {
    return this._value > other._value;
  }

  isLessThan(other: PageOrder): boolean {
    return this._value < other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}
