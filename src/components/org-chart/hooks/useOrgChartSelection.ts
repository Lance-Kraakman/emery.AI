/**
 * useOrgChartSelection Hook
 *
 * Selection state management for the org chart canvas.
 */

import { useState, useCallback } from 'react';
import type { OrgChartNode, OrgChartNodeType } from '../types';

type SelectCallback = (nodeId: string | null, nodeType?: OrgChartNodeType) => void;

export interface UseOrgChartSelectionReturn {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAll: () => void;
  clearSelection: () => void;
}

export function useOrgChartSelection(
  nodes: OrgChartNode[],
  onSelect?: SelectCallback
): UseOrgChartSelectionReturn {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Single selection (backwards compatible)
  const selectedNodeId = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds)[0] : null;

  const setSelectedNodeId = useCallback(
    (id: string | null) => {
      setSelectedNodeIds(id ? new Set([id]) : new Set());
      if (onSelect) {
        const node = nodes.find((n) => n.id === id);
        onSelect(id, node?.type);
      }
    },
    [nodes, onSelect]
  );

  const selectAll = useCallback(() => {
    setSelectedNodeIds(new Set(nodes.map((n) => n.id)));
  }, [nodes]);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectAll,
    clearSelection,
  };
}
