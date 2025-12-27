/**
 * useDataBlockContextForSelection
 *
 * Hook to detect when the selected component is inside a DataBlock
 * and provide the DataBlock's field context to the sidebar.
 *
 * This solves the issue where VariableAutocompleteInput in the sidebar
 * needs DataLayoutContext, but the sidebar is outside the DataBlock's
 * provider wrapper in the canvas.
 *
 * Simplified approach: Check if the selection's zone starts with a DataBlock ID.
 * Zone format is "parentId:slotName" (e.g., "DataBlock-abc123:children").
 */

import { useMemo } from 'react';
import { usePuck } from '@measured/puck';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface DataBlockContext {
  tableId?: number;
  viewId?: number;
  fields: FieldDTO[];
  sampleRow?: Record<string, unknown>;
}

/**
 * Given the current Puck selection, checks if it's inside a DataBlock's slot.
 * If found, returns the DataBlock's field context for use in sidebar components.
 */
export function useDataBlockContextForSelection(): DataBlockContext | null {
  const { appState, getItemById } = usePuck();
  const itemSelector = appState.ui.itemSelector;

  return useMemo(() => {
    // No selection, no context
    if (!itemSelector?.zone) {
      return null;
    }

    // Zone format is "parentId:slotName" (e.g., "DataBlock-abc123:children")
    const colonIndex = itemSelector.zone.indexOf(':');
    if (colonIndex === -1) return null;

    const parentId = itemSelector.zone.substring(0, colonIndex);
    const parent = getItemById(parentId);

    // Debug logging
    console.log('[useDataBlockContextForSelection]', {
      zone: itemSelector.zone,
      parentId,
      parentType: parent?.type,
      hasFields: !!(parent?.props as Record<string, unknown>)?._fields,
    });

    if (!parent) return null;

    // Check if immediate parent is a DataBlock
    if (parent.type === 'DataBlock') {
      const props = parent.props as Record<string, unknown>;
      const context = {
        tableId: props._tableId as number | undefined,
        viewId: props.viewId as number | undefined,
        fields: (props._fields as FieldDTO[]) || [],
        sampleRow: (props._rows as Record<string, unknown>[])?.[0] ||
                   (props._resolvedRow as Record<string, unknown>) ||
                   undefined,
      };
      console.log('[useDataBlockContextForSelection] Found DataBlock context:', {
        viewId: context.viewId,
        tableId: context.tableId,
        fieldCount: context.fields.length,
      });
      return context;
    }

    // TODO: If needed, traverse further up to find ancestor DataBlocks
    // For now, only support direct children of DataBlock slots
    return null;
  }, [itemSelector, getItemById]);
}
