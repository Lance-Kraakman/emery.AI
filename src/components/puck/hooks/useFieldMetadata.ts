'use client';

/**
 * useFieldMetadata Hook
 *
 * Gets field DTO by field ID from the DataLayoutContext.
 * Used by field blocks to access full field metadata (type, options, etc.)
 * needed for rendering inputs in edit mode.
 */

import { useMemo } from 'react';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * Get field metadata by field ID
 *
 * @param fieldId - The field ID to look up
 * @returns The field DTO or null if not found or not in DataBlock
 *
 * @example
 * ```tsx
 * function TextField({ fieldId }) {
 *   const field = useFieldMetadata(fieldId);
 *
 *   if (!field) return <div>Field not found</div>;
 *
 *   // Use field.type, field.metadata, etc.
 *   return <TextInput field={field} />;
 * }
 * ```
 */
export function useFieldMetadata(fieldId: number | undefined): FieldDTO | null {
  const dataContext = useDataLayoutContext();

  return useMemo(() => {
    if (fieldId === undefined || !dataContext?.fields) {
      return null;
    }

    return dataContext.fields.find(f => f.id === fieldId) ?? null;
  }, [fieldId, dataContext?.fields]);
}

/**
 * Get field metadata by field name
 *
 * @param fieldName - The field name to look up
 * @returns The field DTO or null if not found or not in DataBlock
 */
export function useFieldMetadataByName(fieldName: string | undefined): FieldDTO | null {
  const dataContext = useDataLayoutContext();

  return useMemo(() => {
    if (!fieldName || !dataContext?.fields) {
      return null;
    }

    return dataContext.fields.find(f => f.name === fieldName) ?? null;
  }, [fieldName, dataContext?.fields]);
}

/**
 * Get all available fields from the DataBlock context
 *
 * @returns Array of field DTOs or empty array if not in DataBlock
 */
export function useAvailableFields(): FieldDTO[] {
  const dataContext = useDataLayoutContext();
  return dataContext?.fields ?? [];
}
