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

// =============================================================================
// Clone Utilities
// =============================================================================

/**
 * Deep clone a node, preserving React Flow's dimension properties.
 * React Flow stores resized dimensions in node.width/height/measured.
 */
function cloneNode(node: OrgChartNode): OrgChartNode {
  const nodeAny = node as any;
  return {
    ...node,
    data: { ...node.data },
    style: node.style ? { ...node.style } : undefined,
    width: nodeAny.width,
    height: nodeAny.height,
    measured: nodeAny.measured ? { ...nodeAny.measured } : undefined,
  } as OrgChartNode;
}

/**
 * Deep clone an edge.
 */
function cloneEdge(edge: OrgChartEdge): OrgChartEdge {
  return {
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
  } as OrgChartEdge;
}

/**
 * Create a deep clone of the current state for history.
 */
function cloneState(nodes: OrgChartNode[], edges: OrgChartEdge[]): HistoryState {
  return {
    nodes: nodes.map(cloneNode),
    edges: edges.map(cloneEdge),
  };
}

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
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), cloneState(nodes, edges)]);
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [cloneState(nodes, edges), ...f]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNodeIds(new Set());
  }, [past, nodes, edges, setNodes, setEdges, setSelectedNodeIds]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, cloneState(nodes, edges)]);
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
