/**
 * useOrgChartHistory Hook
 *
 * Undo/redo functionality for the org chart canvas.
 */

import { useState, useCallback } from 'react';
import type { OrgChartNode, OrgChartEdge } from '../types';

interface HistoryState {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
}

export interface UseOrgChartHistoryReturn {
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearSelection: () => void;
}

const MAX_HISTORY = 10;

export function useOrgChartHistory(
  nodes: OrgChartNode[],
  edges: OrgChartEdge[],
  setNodes: React.Dispatch<React.SetStateAction<OrgChartNode[]>>,
  setEdges: React.Dispatch<React.SetStateAction<OrgChartEdge[]>>,
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>
): UseOrgChartHistoryReturn {
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  const pushHistory = useCallback(() => {
    setPast((p) => {
      // Deep clone nodes to preserve all properties including width, height, measured, style
      const clonedNodes = nodes.map((node) => ({
        ...node,
        data: { ...node.data },
        style: node.style ? { ...node.style } : undefined,
        // Preserve React Flow's dimension properties
        width: (node as any).width,
        height: (node as any).height,
        measured: (node as any).measured ? { ...(node as any).measured } : undefined,
      })) as OrgChartNode[];
      const clonedEdges = edges.map((edge) => ({
        ...edge,
        data: edge.data ? { ...edge.data } : undefined,
      })) as OrgChartEdge[];
      const newPast = [...p.slice(-(MAX_HISTORY - 1)), { nodes: clonedNodes, edges: clonedEdges }];
      return newPast;
    });
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    // Deep clone current state before pushing to future
    const clonedNodes = nodes.map((node) => ({
      ...node,
      data: { ...node.data },
      style: node.style ? { ...node.style } : undefined,
      width: (node as any).width,
      height: (node as any).height,
      measured: (node as any).measured ? { ...(node as any).measured } : undefined,
    })) as OrgChartNode[];
    const clonedEdges = edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : undefined,
    })) as OrgChartEdge[];
    setFuture((f) => [{ nodes: clonedNodes, edges: clonedEdges }, ...f]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNodeIds(new Set());
  }, [past, nodes, edges, setNodes, setEdges, setSelectedNodeIds]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    setFuture((f) => f.slice(1));
    // Deep clone current state before pushing to past
    const clonedNodes = nodes.map((node) => ({
      ...node,
      data: { ...node.data },
      style: node.style ? { ...node.style } : undefined,
      width: (node as any).width,
      height: (node as any).height,
      measured: (node as any).measured ? { ...(node as any).measured } : undefined,
    })) as OrgChartNode[];
    const clonedEdges = edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : undefined,
    })) as OrgChartEdge[];
    setPast((p) => [...p, { nodes: clonedNodes, edges: clonedEdges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNodeIds(new Set());
  }, [future, nodes, edges, setNodes, setEdges, setSelectedNodeIds]);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, [setSelectedNodeIds]);

  return {
    pushHistory,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clearSelection,
  };
}
