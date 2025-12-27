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
 * Uses buildDataBlockHierarchy to traverse the Puck data tree - this is
 * the edit-mode equivalent of the runtime DataLayoutProvider stack.
 */

import { useMemo } from 'react';
import { createUsePuck, useGetPuck } from '@measured/puck';
import type { Data } from '@measured/puck';
import type { FieldDTO } from '@/app/mappers/field-mapper';

// Create usePuck with selector support to avoid re-renders
const usePuck = createUsePuck();

interface DataBlockContext {
  tableId?: number;
  viewId?: number;
  fields: FieldDTO[];
  sampleRow?: Record<string, unknown>;
}

/**
 * Build DataBlock hierarchy by traversing Puck data tree.
 * Edit-mode equivalent of runtime DataLayoutProvider stack.
 *
 * @param data - Puck appState.data
 * @param selectedZone - The zone of selected component (e.g., "ConditionalBlock-xxx:children")
 * @param getItemById - Puck's getItemById function
 * @returns Array of DataBlock contexts from outermost to innermost
 */
export function buildDataBlockHierarchy(
  data: Data,
  selectedZone: string | undefined,
  getItemById: (id: string) => { type: string; props: Record<string, unknown> } | undefined
): DataBlockContext[] {
  if (!selectedZone) return [];

  const hierarchy: DataBlockContext[] = [];
  let currentZone: string | undefined = selectedZone;
  const visited = new Set<string>();

  while (currentZone && !visited.has(currentZone)) {
    visited.add(currentZone);

    const colonIndex = currentZone.indexOf(':');
    if (colonIndex === -1) break;

    const parentId = currentZone.substring(0, colonIndex);
    const parent = getItemById(parentId);
    if (!parent) break;

    // Found a DataBlock - add to hierarchy
    if (parent.type === 'DataBlock') {
      const props = parent.props;
      hierarchy.unshift({
        tableId: props._tableId as number | undefined,
        viewId: props.viewId as number | undefined,
        fields: (props._fields as FieldDTO[]) || [],
        sampleRow: (props._rows as Record<string, unknown>[])?.[0] ||
                   (props._resolvedRow as Record<string, unknown>) ||
                   undefined,
      });
    }

    // Find parent's zone to continue up
    currentZone = findZoneContaining(data, parentId);
  }

  return hierarchy;
}

/**
 * Helper: Find which zone contains a component ID
 * Returns the zone string (e.g., "DataBlock-abc:children") or undefined if at root
 */
function findZoneContaining(data: Data, componentId: string): string | undefined {
  // Check root content
  const rootContent = data.content as Array<{ props?: { id?: string } }> | undefined;
  if (rootContent?.some((c) => c.props?.id === componentId)) {
    return undefined; // At root, no parent zone
  }

  // Recursive search through component tree
  function searchSlots(
    comp: { props?: Record<string, unknown> },
    compId: string
  ): string | undefined {
    if (!comp.props) return undefined;

    for (const [slotName, slotValue] of Object.entries(comp.props)) {
      if (!Array.isArray(slotValue)) continue;

      // Check if this slot contains our target
      if (slotValue.some((c: { props?: { id?: string } }) => c.props?.id === componentId)) {
        return `${compId}:${slotName}`;
      }

      // Recurse into children
      for (const child of slotValue) {
        if (child?.props?.id) {
          const found = searchSlots(child, child.props.id);
          if (found) return found;
        }
      }
    }
    return undefined;
  }

  for (const comp of rootContent || []) {
    if (comp.props?.id) {
      const found = searchSlots(comp as { props: Record<string, unknown> }, comp.props.id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Given the current Puck selection, checks if it's inside a DataBlock's slot.
 * If found, returns the innermost DataBlock's field context for use in sidebar components.
 */
export function useDataBlockContextForSelection(): DataBlockContext | null {
  // ONLY subscribe to zone changes - this prevents re-renders when any prop changes
  // We use zone because it only changes when selection changes, not on every state update
  const zone = usePuck((s) => s.appState.ui.itemSelector?.zone);

  // Non-reactive: get latest API and data on-demand
  const getPuck = useGetPuck();

  return useMemo(() => {
    const { appState, getItemById } = getPuck();
    const hierarchy = buildDataBlockHierarchy(appState.data, zone, getItemById);
    // Return innermost DataBlock context (last in array)
    return hierarchy.length > 0 ? hierarchy[hierarchy.length - 1] : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone]); // Only depend on zone - getPuck is stable, data is read on-demand
}

/**
 * Returns the PARENT DataBlock context (for nested DataBlocks).
 * Used by MultiFilterField for "Parent Row" filtering.
 */
export function useParentDataBlockContext(): DataBlockContext | null {
  // ONLY subscribe to zone changes - this prevents re-renders when any prop changes
  // We use zone because it only changes when selection changes, not on every state update
  const zone = usePuck((s) => s.appState.ui.itemSelector?.zone);

  // Non-reactive: get latest API and data on-demand
  const getPuck = useGetPuck();

  return useMemo(() => {
    const { appState, getItemById } = getPuck();
    const hierarchy = buildDataBlockHierarchy(appState.data, zone, getItemById);
    // hierarchy contains ANCESTOR DataBlocks only (not the selected DataBlock itself)
    // Return the last ancestor (immediate parent DataBlock)
    return hierarchy.length >= 1 ? hierarchy[hierarchy.length - 1] : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone]); // Only depend on zone - getPuck is stable, data is read on-demand
}
