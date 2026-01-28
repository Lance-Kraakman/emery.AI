/**
 * useDataBlockFieldsForPanel
 *
 * Hook that provides DataBlock field metadata for the sidebar Data Fields panel.
 * Detects when the user is editing a DataBlock (either selected directly or
 * editing inside its slot) and returns the available fields + insertion helpers.
 *
 * Detection paths:
 * 1. DataBlock directly selected → read _fields from its props via getItemById
 * 2. Inside a DataBlock slot → reuse useDataBlockContextForSelection
 *    (which traverses the full component tree for deep nesting)
 *
 * Follows the same proven reactive pattern as useDataBlockContextForSelection:
 * subscribe to primitive selectors only, read everything else on-demand via getPuck().
 */

import { useMemo, useCallback } from 'react';
import { createUsePuck, useGetPuck } from '@measured/puck';
import { useDataBlockContextForSelection } from './useDataBlockContextForSelection';
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
  /** The DataBlock component ID to insert into */
  dataBlockId: string | undefined;
  /** Insert a field component into the DataBlock's children slot */
  insertField: (field: FieldDTO) => void;
}

export function useDataBlockFieldsForPanel(): DataBlockFieldsPanelState {
  // Subscribe to primitive selection signals only (avoids object-reference re-renders)
  // Zone changes when selection moves between slots; index changes within the same slot
  const zone = usePuck((s) => s.appState.ui.itemSelector?.zone);
  const index = usePuck((s) => s.appState.ui.itemSelector?.index);
  const getPuck = useGetPuck();

  // Handles deep nesting detection (selection inside Container inside DataBlock, etc.)
  const ancestorContext = useDataBlockContextForSelection();

  // Compute DataBlock context from current selection
  const { isActive, fields, dataBlockId } = useMemo(() => {
    const { selectedItem, getItemById } = getPuck();

    // Path 1: DataBlock directly selected
    if (selectedItem?.type === 'DataBlock') {
      const id = selectedItem.props?.id as string | undefined;
      if (id) {
        const item = getItemById(id);
        const dbFields = (item?.props._fields as FieldDTO[]) || [];
        return { isActive: true, fields: dbFields, dataBlockId: id };
      }
    }

    // Path 2: Inside a DataBlock slot (detected by ancestor hook)
    if (ancestorContext) {
      // Try to resolve the DataBlock's component ID from the zone
      let dbId: string | undefined;
      if (zone) {
        const parentId = zone.split(':')[0];
        const parent = getItemById(parentId);
        if (parent?.type === 'DataBlock') {
          dbId = parentId;
        }
      }
      return { isActive: true, fields: ancestorContext.fields, dataBlockId: dbId };
    }

    return { isActive: false, fields: [] as FieldDTO[], dataBlockId: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, index, ancestorContext]);

  // Insert a field component into the DataBlock's children slot.
  // Uses Puck's `insert` action (pushes to undo history) then patches the fieldId.
  const insertField = useCallback((field: FieldDTO) => {
    if (!dataBlockId) return;

    const { appState, dispatch, getItemById } = getPuck();
    const componentType = FIELD_TYPE_TO_COMPONENT[field.type] || 'TextField';
    const newId = `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Determine children count for insertion index
    const dataBlock = getItemById(dataBlockId);
    const children = (dataBlock?.props?.children ?? []) as unknown[];
    const destinationZone = `${dataBlockId}:children`;

    // Step 1: Insert via Puck action (records in undo history)
    dispatch({
      type: 'insert',
      componentType,
      destinationZone,
      destinationIndex: children.length,
      id: newId,
    });

    // Step 2: Patch the fieldId onto the newly inserted component.
    // Read fresh state after insert, clone, find the component, set fieldId.
    const { appState: freshState } = getPuck();
    const newData = structuredClone(freshState.data);

    const patchFieldId = (items: Array<{ type: string; props: Record<string, unknown> }>): boolean => {
      for (const item of items) {
        if (item.props?.id === newId) {
          item.props.fieldId = field.id;
          return true;
        }
        for (const value of Object.values(item.props || {})) {
          if (Array.isArray(value) && patchFieldId(value as typeof items)) {
            return true;
          }
        }
      }
      return false;
    };

    if (patchFieldId(newData.content as Array<{ type: string; props: Record<string, unknown> }>)) {
      dispatch({ type: 'setData', data: newData });
    }
  }, [dataBlockId, getPuck]);

  return { isActive, fields, dataBlockId, insertField };
}
