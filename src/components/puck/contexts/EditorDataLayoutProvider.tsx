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
import { createUsePuck, type Data } from '@measured/puck';
import { DataLayoutProvider } from './DataLayoutContext';
import { getFieldsForView } from '@/app/actions/fields';
import type { FieldDTO } from '@/app/mappers/field-mapper';

const usePuck = createUsePuck();

/**
 * Inner component that uses usePuck hook
 * Must be rendered inside Puck's context
 */
function EditorDataLayoutProviderInner({ children }: { children: ReactNode }) {
  const selectedItem = usePuck((s) => s.selectedItem);
  const data = usePuck((s) => s.appState.data);

  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [currentViewId, setCurrentViewId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No selection - clear fields
    if (!selectedItem) {
      setFields([]);
      setCurrentViewId(undefined);
      return;
    }

    // Find parent DataBlock for selected item
    const parentViewId = findParentDataBlockViewId(data, selectedItem.props?.id);

    // If same viewId, no need to refetch
    if (parentViewId === currentViewId) {
      return;
    }

    // No parent DataBlock found - clear fields
    if (!parentViewId) {
      setFields([]);
      setCurrentViewId(undefined);
      return;
    }

    // Fetch fields for the new viewId
    setCurrentViewId(parentViewId);
    setLoading(true);

    getFieldsForView(parentViewId)
      .then((fetchedFields) => {
        setFields(fetchedFields);
      })
      .catch((error) => {
        console.error('[EditorDataLayoutProvider] Error fetching fields:', error);
        setFields([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedItem, data, currentViewId]);

  return (
    <DataLayoutProvider viewId={currentViewId} fields={fields}>
      {children}
    </DataLayoutProvider>
  );
}

/**
 * Find the viewId of the parent DataBlock for a given component ID
 *
 * Puck stores components in zones with names like:
 * - "root" for top-level content
 * - "DataBlock-abc123:content" for zones inside a DataBlock
 * - "DataBlock-abc123:item-0" for list item zones
 */
function findParentDataBlockViewId(
  data: Data,
  selectedId: string | undefined
): number | undefined {
  if (!selectedId || !data) {
    return undefined;
  }

  // First check if the selected item IS a DataBlock
  const selectedComponent = findComponentById(data, selectedId);
  if (selectedComponent?.type === 'DataBlock' && selectedComponent.props?.viewId) {
    return selectedComponent.props.viewId as number;
  }

  // Check all zones to find which contains the selected item
  const zones = data.zones || {};

  for (const [zoneName, zoneContent] of Object.entries(zones)) {
    if (!Array.isArray(zoneContent)) continue;

    const hasSelected = zoneContent.some((item) => item.props?.id === selectedId);

    if (hasSelected) {
      // Parse zone name to find parent component
      // Zone names are like "DataBlock-abc123:content" or "DataBlock-abc123:item-0"
      const colonIndex = zoneName.indexOf(':');

      if (colonIndex > 0) {
        const parentPart = zoneName.substring(0, colonIndex);
        // parentPart is like "DataBlock-abc123"

        // Find the parent component in the data
        const parent = findComponentInData(data, (comp) => {
          const compId = comp.props?.id as string | undefined;
          return compId ? parentPart.endsWith(compId) : false;
        });

        if (parent?.type === 'DataBlock' && parent.props?.viewId) {
          return parent.props.viewId as number;
        }

        // If parent is not a DataBlock, recurse to find its parent
        const parentId = parent?.props?.id as string | undefined;
        if (parentId) {
          const grandparentViewId = findParentDataBlockViewId(data, parentId);
          if (grandparentViewId) {
            return grandparentViewId;
          }
        }
      }
    }
  }

  // Also check root content
  if (Array.isArray(data.content)) {
    const hasSelected = data.content.some((item) => item.props?.id === selectedId);
    if (hasSelected) {
      // Selected item is at root level, no parent DataBlock
      return undefined;
    }
  }

  return undefined;
}

/**
 * Find a component by ID in the Puck data structure
 */
function findComponentById(
  data: Data,
  id: string
): { type: string; props: Record<string, unknown> } | undefined {
  return findComponentInData(data, (comp) => comp.props?.id === id);
}

/**
 * Find a component in data that matches a predicate
 */
function findComponentInData(
  data: Data,
  predicate: (comp: { type: string; props: Record<string, unknown> }) => boolean
): { type: string; props: Record<string, unknown> } | undefined {
  // Check root content
  if (Array.isArray(data.content)) {
    for (const item of data.content) {
      if (predicate(item)) {
        return item;
      }
    }
  }

  // Check all zones
  const zones = data.zones || {};
  for (const zoneContent of Object.values(zones)) {
    if (!Array.isArray(zoneContent)) continue;

    for (const item of zoneContent) {
      if (predicate(item)) {
        return item;
      }
    }
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
