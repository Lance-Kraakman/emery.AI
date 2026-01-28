/**
 * useDataBlockFieldsForPanel
 *
 * Hook that provides DataBlock field metadata for the sidebar Data Fields panel.
 * Detects when the user is editing a DataBlock (either selected directly or
 * editing inside its slot) and returns the available fields + insertion helpers.
 *
 * Uses Puck's selector-based usePuck for minimal re-renders:
 * - Only re-renders when selectedItem type or zone changes
 */

import { useMemo, useCallback } from 'react';
import { createUsePuck, useGetPuck } from '@measured/puck';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

const usePuck = createUsePuck();

/**
 * Maps database field types to the best-matching Puck field component.
 * Based on each component's filterTypes configuration.
 */
const FIELD_TYPE_TO_COMPONENT: Partial<Record<FieldType, string>> = {
  text: 'TextField',
  email: 'TextField',
  phone: 'TextField',
  number: 'NumberField',
  autonumber: 'NumberField',
  boolean: 'BooleanField',
  date: 'DateField',
  'last-updated': 'DateField',
  'created-at': 'DateField',
  'single-select': 'SelectField',
  'multi-select': 'SelectField',
  file: 'FileField',
  document: 'DocumentField',
  relation: 'RelationField',
};

export interface DataBlockFieldsPanelState {
  /** Whether the panel should be visible */
  isActive: boolean;
  /** Available fields from the DataBlock's view */
  fields: FieldDTO[];
  /** Insert a field component into the DataBlock's children slot */
  insertField: (field: FieldDTO) => void;
}

/**
 * Find the ID of the DataBlock that the current selection belongs to.
 * Handles both direct DataBlock selection and selection inside its slot.
 */
function findDataBlockId(
  selectedType: string | undefined,
  selectedId: string | undefined,
  zone: string | undefined,
  getItemById: (id: string) => { type: string; props: Record<string, unknown> } | undefined,
): string | undefined {
  // Case 1: DataBlock itself is selected
  if (selectedType === 'DataBlock' && selectedId) {
    return selectedId;
  }

  // Case 2: Something inside a DataBlock's slot is selected
  if (zone) {
    const parentId = zone.split(':')[0];
    const parent = getItemById(parentId);
    if (parent?.type === 'DataBlock') {
      return parentId;
    }
  }

  return undefined;
}

/**
 * Get field metadata from a DataBlock component's resolved props.
 */
function getFieldsFromDataBlock(
  dataBlockId: string,
  getItemById: (id: string) => { type: string; props: Record<string, unknown> } | undefined,
): FieldDTO[] {
  const item = getItemById(dataBlockId);
  if (!item) return [];
  return (item.props._fields as FieldDTO[]) || [];
}

export function useDataBlockFieldsForPanel(): DataBlockFieldsPanelState {
  // Subscribe only to selection changes (type + zone)
  const selectedType = usePuck((s) => s.selectedItem?.type);
  const zone = usePuck((s) => s.appState.ui.itemSelector?.zone);

  const getPuck = useGetPuck();

  // Derive state from current selection
  const { isActive, fields, dataBlockId } = useMemo(() => {
    const { selectedItem, getItemById } = getPuck();
    const selectedId = selectedItem?.props?.id as string | undefined;

    const dbId = findDataBlockId(selectedType, selectedId, zone, getItemById);
    if (!dbId) {
      return { isActive: false, fields: [] as FieldDTO[], dataBlockId: undefined };
    }

    const dbFields = getFieldsFromDataBlock(dbId, getItemById);
    return { isActive: true, fields: dbFields, dataBlockId: dbId };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, zone]);

  // Insert a field component into the DataBlock's children slot
  const insertField = useCallback((field: FieldDTO) => {
    if (!dataBlockId) return;

    const { appState, dispatch } = getPuck();
    const componentType = FIELD_TYPE_TO_COMPONENT[field.type] || 'TextField';

    // Generate unique ID
    const newId = `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Build new component with pre-configured fieldId
    const newComponent = {
      type: componentType,
      props: {
        id: newId,
        fieldId: field.id,
      },
    };

    // Clone data tree and find the DataBlock to insert into
    const newData = structuredClone(appState.data);

    const insertIntoDataBlock = (items: Array<{ type: string; props: Record<string, unknown> }>): boolean => {
      for (const item of items) {
        if (item.props?.id === dataBlockId) {
          if (!Array.isArray(item.props.children)) {
            item.props.children = [];
          }
          (item.props.children as unknown[]).push(newComponent);
          return true;
        }
        // Recurse into slot arrays
        for (const value of Object.values(item.props || {})) {
          if (Array.isArray(value) && insertIntoDataBlock(value as Array<{ type: string; props: Record<string, unknown> }>)) {
            return true;
          }
        }
      }
      return false;
    };

    if (insertIntoDataBlock(newData.content as Array<{ type: string; props: Record<string, unknown> }>)) {
      dispatch({ type: 'setData', data: newData });
    }
  }, [dataBlockId, getPuck]);

  return { isActive, fields, insertField };
}
