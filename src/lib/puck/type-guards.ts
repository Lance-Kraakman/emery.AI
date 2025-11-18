/**
 * Puck Type Guards
 *
 * Runtime type checking utilities for Puck DTOs and value objects.
 * Use these when validating data from:
 * - JSON parsing (sessionStorage, API responses)
 * - User input
 * - External sources
 */

import type { PageDTO } from '@/app/mappers/puck-page-mapper';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import type {
  ThemeConfigProps,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeBorders,
} from '@/ddd/domain/puck/value-objects/theme-config';

/**
 * Type guard for PageDTO
 * Validates that unknown data matches PageDTO structure
 */
export function isPageDTO(value: unknown): value is PageDTO {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'number' &&
    typeof obj.appId === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    typeof obj.order === 'number' &&
    typeof obj.templateData === 'object' &&
    obj.templateData !== null &&
    (obj.themeConfig === undefined || typeof obj.themeConfig === 'object') &&
    typeof obj.isPublic === 'boolean' &&
    typeof obj.requiresAuth === 'boolean' &&
    (obj.allowedRoles === undefined || Array.isArray(obj.allowedRoles)) &&
    typeof obj.createdBy === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  );
}

/**
 * Type guard for AppDTO
 * Validates that unknown data matches AppDTO structure
 */
export function isAppDTO(value: unknown): value is AppDTO {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.id === 'number' &&
    typeof obj.organizationId === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.slug === 'string' &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.themeConfig === undefined || typeof obj.themeConfig === 'object') &&
    typeof obj.createdBy === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  );
}

/**
 * Type guard for ThemeColors
 */
export function isThemeColors(value: unknown): value is ThemeColors {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.primary === 'string' &&
    typeof obj.secondary === 'string' &&
    typeof obj.background === 'string' &&
    typeof obj.surface === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.textMuted === 'string' &&
    typeof obj.border === 'string' &&
    typeof obj.link === 'string' &&
    typeof obj.success === 'string' &&
    typeof obj.warning === 'string' &&
    typeof obj.error === 'string'
  );
}

/**
 * Type guard for ThemeTypography
 */
export function isThemeTypography(value: unknown): value is ThemeTypography {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.fontFamily === 'string' &&
    typeof obj.fontSize === 'string' &&
    typeof obj.headingFontWeight === 'number' &&
    (obj.headingColor === undefined || typeof obj.headingColor === 'string')
  );
}

/**
 * Type guard for ThemeSpacing
 */
export function isThemeSpacing(value: unknown): value is ThemeSpacing {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.unit === 'string' &&
    typeof obj.scale === 'number'
  );
}

/**
 * Type guard for ThemeBorders
 */
export function isThemeBorders(value: unknown): value is ThemeBorders {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.radius === 'string' &&
    typeof obj.width === 'string'
  );
}

/**
 * Type guard for ThemeConfigProps
 * Validates complete theme configuration
 */
export function isThemeConfigProps(value: unknown): value is ThemeConfigProps {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    isThemeColors(obj.colors) &&
    isThemeTypography(obj.typography) &&
    isThemeSpacing(obj.spacing) &&
    isThemeBorders(obj.borders)
  );
}

/**
 * Validate and parse PageDTO from unknown data
 * Throws descriptive error if validation fails
 *
 * @example
 * const data = JSON.parse(response);
 * const page = assertPageDTO(data);
 */
export function assertPageDTO(value: unknown): PageDTO {
  if (!isPageDTO(value)) {
    throw new Error('Invalid PageDTO: Missing or incorrect required fields');
  }
  return value;
}

/**
 * Validate and parse AppDTO from unknown data
 * Throws descriptive error if validation fails
 */
export function assertAppDTO(value: unknown): AppDTO {
  if (!isAppDTO(value)) {
    throw new Error('Invalid AppDTO: Missing or incorrect required fields');
  }
  return value;
}

/**
 * Validate and parse ThemeConfigProps from unknown data
 * Throws descriptive error if validation fails
 */
export function assertThemeConfigProps(value: unknown): ThemeConfigProps {
  if (!isThemeConfigProps(value)) {
    throw new Error('Invalid ThemeConfigProps: Missing or incorrect required fields');
  }
  return value;
}
