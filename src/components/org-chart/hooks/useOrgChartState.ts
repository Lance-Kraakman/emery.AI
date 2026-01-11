/**
 * useOrgChartState Hook
 *
 * Core node/edge state management for the org chart canvas.
 * Provides basic CRUD operations for nodes and edges.
 */

import { useCallback, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  type XYPosition,
} from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartNodeData,
  StickyNoteData,
  AgentContainerNodeData,
} from '../types';
import { orgChartNodeSizes } from '../theme';
import { makeNodeId } from '../utils';

export interface UseOrgChartStateReturn {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
  setNodes: React.Dispatch<React.SetStateAction<OrgChartNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<OrgChartEdge[]>>;
  onNodesChange: ReturnType<typeof useNodesState<OrgChartNode>>[2];
  onEdgesChange: ReturnType<typeof useEdgesState<OrgChartEdge>>[2];
  updateNode: (id: string, data: Partial<OrgChartNodeData>) => void;
  deleteNode: (id: string, pushHistory: () => void) => void;
  deleteNodes: (ids: Set<string>, pushHistory: () => void) => void;
  addStickyNote: (position: XYPosition, pushHistory: () => void) => string;
  toggleAgentExpanded: (nodeId: string, pushHistory: () => void) => void;
  nodesRef: React.MutableRefObject<OrgChartNode[]>;
}

export function useOrgChartState(): UseOrgChartStateReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgChartNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<OrgChartEdge>([]);

  // Keep a ref to nodes for persistence (avoids stale closure issues)
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const updateNode = useCallback(
    (id: string, data: Partial<OrgChartNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...data } as OrgChartNodeData } : node
        )
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (id: string, pushHistory: () => void) => {
      pushHistory();

      // Find children to delete (for container nodes)
      setNodes((nds) => {
        const childIds = nds.filter((n) => n.parentId === id).map((n) => n.id);
        const idsToDelete = new Set([id, ...childIds]);
        return nds.filter((node) => !idsToDelete.has(node.id));
      });

      setEdges((eds) =>
        eds.filter((edge) => edge.source !== id && edge.target !== id)
      );
    },
    [setNodes, setEdges]
  );

  const deleteNodes = useCallback(
    (ids: Set<string>, pushHistory: () => void) => {
      if (ids.size === 0) return;
      pushHistory();

      setNodes((nds) => {
        // Collect all IDs including children
        const allIds = new Set(ids);
        nds.forEach((n) => {
          if (n.parentId && ids.has(n.parentId)) {
            allIds.add(n.id);
          }
        });
        return nds.filter((node) => !allIds.has(node.id));
      });

      setEdges((eds) =>
        eds.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target))
      );
    },
    [setNodes, setEdges]
  );

  const addStickyNote = useCallback(
    (position: XYPosition, pushHistory: () => void): string => {
      pushHistory();
      const id = crypto.randomUUID();
      const newNode: OrgChartNode = {
        id,
        type: 'sticky',
        position,
        style: { width: 200, height: 120 },
        data: {
          content: '<p></p>',
          color: 'yellow',
        } as StickyNoteData,
      };

      setNodes((nds) => [...nds, newNode]);
      return id;
    },
    [setNodes]
  );

  const toggleAgentExpanded = useCallback(
    (nodeId: string, pushHistory: () => void) => {
      pushHistory();
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId && node.type === 'agent') {
            const data = node.data as AgentContainerNodeData;
            const isExpanded = !data.isExpanded;

            // Calculate new height
            const childCount = (data.skillCount ?? 0) + (data.databaseCount ?? 0);
            const rows = Math.ceil(childCount / 2);
            const newHeight = isExpanded
              ? Math.max(
                  orgChartNodeSizes.containerMinHeight,
                  60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
                )
              : 60;

            return {
              ...node,
              style: { ...node.style, height: newHeight },
              data: { ...data, isExpanded },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    updateNode,
    deleteNode,
    deleteNodes,
    addStickyNote,
    toggleAgentExpanded,
    nodesRef,
  };
}
