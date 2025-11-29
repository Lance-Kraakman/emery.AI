'use client';

/**
 * EditorDataLayoutProvider
 *
 * Provides field metadata to the Puck editor sidebar by watching the selected item
 * and finding its parent DataBlock's viewId.
 *
 * This solves the problem where FieldSelectorField runs in the sidebar (outside
 * DataBlock's component tree) and can't access DataLayoutContext.
 *
 * Usage: Wrap the entire Puck editor with this provider.
 */

import React, { useState, useEffect, type ReactNode } from 'react';
import { createUsePuck } from '@measured/puck';
import { DataLayoutProvider } from './DataLayoutContext';
import { getFieldsForView } from '@/app/actions/fields';
import { executeView } from '@/app/actions/views';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { VARIABLE_AWARE_BLOCK_TYPES_SET } from '@/components/puck/constants';

const usePuck = createUsePuck();

/**
 * Inner component that uses usePuck hook
 * Must be rendered inside Puck's context
 */
function EditorDataLayoutProviderInner({ children }: { children: ReactNode }) {
  const selectedItem = usePuck((s) => s.selectedItem);
  const itemSelector = usePuck((s) => s.appState.ui.itemSelector);
  // Get Puck API methods for component lookup
  const getItemById = usePuck((s) => s.getItemById);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);

  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [sampleRow, setSampleRow] = useState<Record<string, unknown> | undefined>();
  const [currentViewId, setCurrentViewId] = useState<number | undefined>();

  useEffect(() => {
    // No selection - clear fields
    if (!selectedItem) {
      setFields([]);
      setSampleRow(undefined);
      setCurrentViewId(undefined);
      return;
    }

    // Find parent DataBlock's viewId using Puck's built-in APIs
    const parentViewId = findParentDataBlockViewId(
      selectedItem,
      itemSelector,
      getItemById,
      getSelectorForId
    );

    // If same viewId, no need to refetch
    if (parentViewId === currentViewId) {
      return;
    }

    // No parent DataBlock found - clear fields
    if (!parentViewId) {
      setFields([]);
      setSampleRow(undefined);
      setCurrentViewId(undefined);
      return;
    }

    // Fetch fields and sample row for the new viewId
    setCurrentViewId(parentViewId);

    // Fetch fields
    getFieldsForView(parentViewId)
      .then((fetchedFields) => {
        setFields(fetchedFields);
      })
      .catch((error) => {
        console.error('[EditorDataLayoutProvider] Error fetching fields:', error);
        setFields([]);
      });

    // Fetch sample row (first row from view)
    executeView(parentViewId, undefined, { pageSize: 1, offset: 0 })
      .then((result) => {
        if (result?.rows?.[0]) {
          setSampleRow(result.rows[0]);
        } else {
          setSampleRow(undefined);
        }
      })
      .catch((error) => {
        console.error('[EditorDataLayoutProvider] Error fetching sample row:', error);
        setSampleRow(undefined);
      });
  }, [selectedItem, itemSelector, getItemById, getSelectorForId, currentViewId]);

  return (
    <DataLayoutProvider viewId={currentViewId} fields={fields} sampleRow={sampleRow}>
      {children}
    </DataLayoutProvider>
  );
}

// Type for Puck's getItemById function
type GetItemById = (id: string) => { type: string; props: Record<string, unknown> } | undefined;
// Type for Puck's getSelectorForId function
type GetSelectorForId = (id: string) => { zone?: string; index: number } | undefined;

/**
 * Find the viewId of the parent DataBlock for the selected item.
 *
 * Uses Puck's built-in getItemById and getSelectorForId APIs to traverse the
 * component tree. These APIs work correctly for unsaved components.
 *
 * Zone names follow the pattern: "ComponentId:slotName"
 * E.g., "DataBlock-abc123:children" or "Grid-abc123:items"
 */
function findParentDataBlockViewId(
  selectedItem: { type: string; props: Record<string, unknown> },
  itemSelector: { zone?: string; index: number } | null,
  getItemById: GetItemById,
  getSelectorForId: GetSelectorForId
): number | undefined {
  // If the selected item IS a DataBlock, return its viewId
  if (selectedItem.type === 'DataBlock' && selectedItem.props?.viewId) {
    return selectedItem.props.viewId as number;
  }

  // Only variable-aware blocks need DataLayoutContext - skip lookup for other components
  if (!VARIABLE_AWARE_BLOCK_TYPES_SET.has(selectedItem.type)) {
    return undefined;
  }

  // No item selector means we can't determine the zone
  if (!itemSelector?.zone) {
    return undefined;
  }

  // Traverse up the component tree via zone chain
  let currentZone = itemSelector.zone;
  const visited = new Set<string>();

  while (currentZone && !visited.has(currentZone)) {
    visited.add(currentZone);

    // Parse zone name to get parent component ID
    // Zone format: "parentId:slotName"
    const colonIndex = currentZone.indexOf(':');
    if (colonIndex === -1) {
      // Root zone, no parent component
      return undefined;
    }

    const parentId = currentZone.substring(0, colonIndex);

    // Use Puck's API to get the parent component
    const parent = getItemById(parentId);

    if (parent?.type === 'DataBlock' && parent.props?.viewId) {
      return parent.props.viewId as number;
    }

    // Get parent's zone to continue traversal up the tree
    // getSelectorForId can throw for root-level components
    let parentSelector: { zone?: string; index: number } | undefined;
    try {
      parentSelector = getSelectorForId(parentId);
    } catch {
      // Parent is at root level or invalid, no DataBlock ancestor
      return undefined;
    }
    if (!parentSelector?.zone) {
      // Parent is at root level, no DataBlock ancestor
      return undefined;
    }

    currentZone = parentSelector.zone;
  }

  return undefined;
}

/**
 * Wrapper component that provides EditorDataLayoutProvider
 * This must be rendered INSIDE Puck's context (as a child of <Puck>)
 */
export function EditorDataLayoutProvider({ children }: { children: ReactNode }) {
  return <EditorDataLayoutProviderInner>{children}</EditorDataLayoutProviderInner>;
}

export default EditorDataLayoutProvider;
