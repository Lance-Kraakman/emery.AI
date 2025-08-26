// AIDEV-NOTE: Shared test helper functions for application service testing
// Common utilities for setup, assertions, and test data manipulation

import { vi } from 'vitest';
import type { Result } from '@/ddd/domain/shared/result';

export class TestHelpers {
  /**
   * Helper to create success result objects
   */
  static success<T>(data: T): Result<T> {
    return {
      success: true,
      data
    };
  }

  /**
   * Helper to create error result objects
   */
  static error(error: string, warnings?: string[]): Result<never> {
    return {
      success: false,
      error,
      warnings
    };
  }

  /**
   * Helper to setup console spy to reduce noise in tests
   */
  static setupConsoleMocks() {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  }

  /**
   * Helper to expect partial object matching
   */
  static expectPartialMatch<T>(actual: T, expected: Partial<T>) {
    expect(actual).toEqual(expect.objectContaining(expected));
  }

  /**
   * Helper for async test cases that need delay
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper to create mock with resolved value
   */
  static mockResolvedValue<T>(value: T) {
    return vi.fn().mockResolvedValue(value);
  }

  /**
   * Helper to create mock with rejected value
   */
  static mockRejectedValue(error: Error | string) {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    return vi.fn().mockRejectedValue(errorObj);
  }
}