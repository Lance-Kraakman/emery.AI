/**
 * Field Visibility Utilities
 *
 * Shared logic for determining which fields should be visible in data displays
 * (TableBlock, DataGrid, etc.) based on view field mappings.
 *
 * Core logic:
 * 1. If field mappings exist: show mapped visible fields (sorted by order) + unmapped fields
 * 2. If no field mappings: show all fields
 *
 * This ensures new fields are automatically visible even when mappings exist.
 */

import type { FieldMapping } from '@/components/puck/blocks/TableBlock/TableBlock';

/**
 * Base interface for fields with an ID and name.
 * Generic enough to work with both FieldDTO and plain field objects.
 */
export interface FieldWithId {
  id: number;
  name: string;
  [key: string]: any; // Allow additional properties like type, metadata, etc.
}

/**
 * Calculates visible fields based on field mappings.
 *
 * Logic:
 * 1. If mappings exist: show mapped visible fields (sorted by order) + unmapped fields
 * 2. If no mappings: show all fields
 *
 * This ensures new fields are automatically visible even if mappings exist.
 *
 * @param fields - All available fields
 * @param fieldMappings - Optional field mappings from view configuration
 * @returns Array of fields to display, in the correct order
 *
 * @example
 * const visibleFields = getVisibleFields(allFields, view.fieldMappings);
 */
export function getVisibleFields<T extends FieldWithId>(
  fields: T[],
  fieldMappings?: FieldMapping[]
): T[] {
  if (!fieldMappings || fieldMappings.length === 0) {
    return fields;
  }

  // Get visible mapped fields in order
  const visibleMappings = fieldMappings
    .filter(m => m.visible)
    .sort((a, b) => a.order - b.order);

  const mappedFieldIds = new Set(fieldMappings.map(m => m.sourceFieldId));

  // Find actual field objects for mapped visible fields
  const mappedVisibleFields = visibleMappings
    .map(mapping => fields.find(f => f.id === mapping.sourceFieldId))
    .filter((field): field is T => field !== undefined);

  // Find fields without any mapping (should be shown by default)
  const unmappedFields = fields.filter(field => !mappedFieldIds.has(field.id));

  // Combine: mapped visible first (in order), then unmapped (in table order)
  return [...mappedVisibleFields, ...unmappedFields];
}

/**
 * Converts fields to FieldMapping format for display.
 * Used by components that need FieldMapping objects (like TableBlock).
 *
 * @param fields - Fields to convert
 * @param startOrder - Starting order index (useful when appending to existing mappings)
 * @returns Array of FieldMapping objects
 *
 * @example
 * const mappings = fieldsToMappings(unmappedFields, existingMappings.length);
 */
export function fieldsToMappings(
  fields: FieldWithId[],
  startOrder: number = 0
): FieldMapping[] {
  return fields.map((field, index) => ({
    sourceFieldId: field.id,
    displayName: field.name,
    visible: true,
    order: startOrder + index
  }));
}

/**
 * Combined utility for TableBlock use case.
 * Returns FieldMappings for visible fields based on existing mappings.
 *
 * This is a convenience function that combines getVisibleFields and fieldsToMappings
 * for components that work directly with FieldMapping objects.
 *
 * @param fields - All available fields
 * @param fieldMappings - Optional field mappings from view configuration
 * @returns Array of FieldMapping objects for display
 *
 * @example
 * const columnsToDisplay = getVisibleFieldMappings(_fields, fieldMappings);
 */
export function getVisibleFieldMappings(
  fields: FieldWithId[],
  fieldMappings?: FieldMapping[]
): FieldMapping[] {
  if (!fieldMappings || fieldMappings.length === 0) {
    return fieldsToMappings(fields);
  }

  const visibleMappings = fieldMappings
    .filter(m => m.visible)
    .sort((a, b) => a.order - b.order);

  const mappedFieldIds = new Set(fieldMappings.map(m => m.sourceFieldId));
  const unmappedFields = fields.filter(field => !mappedFieldIds.has(field.id));

  const unmappedMappings = fieldsToMappings(unmappedFields, fieldMappings.length);

  return [...visibleMappings, ...unmappedMappings];
}
