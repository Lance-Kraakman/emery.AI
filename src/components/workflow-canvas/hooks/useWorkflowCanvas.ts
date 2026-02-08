/**
 * useWorkflowCanvas Hook
 *
 * Main state management hook for the workflow canvas.
 * Syncs between React Flow nodes/edges and parent form's SkillStep[] array.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  type XYPosition,
} from '@xyflow/react';
import type { SkillStep, CanvasMetadata, InputDefinition, OutputDefinition } from '@/ddd/domain/skills/entities/skill';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowNodeData,
  UseWorkflowCanvasReturn,
} from '../types';
import {
  stepsToFlow,
  flowToSteps,
  getDefaultNodeData,
  type FlowToStepsResult,
} from '../utils/flow-converters';
import { cascadeRenameInNodeData } from '../utils/rename-cascade';

interface UseWorkflowCanvasProps {
  steps: SkillStep[];
  canvasMetadata?: CanvasMetadata;
  onChange: (result: FlowToStepsResult) => void;
  skillInputs?: InputDefinition[];
  skillOutputs?: OutputDefinition[];
}

// History state for undo/redo
interface HistoryState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export function useWorkflowCanvas({
  steps,
  canvasMetadata,
  onChange,
  skillInputs,
  skillOutputs,
}: UseWorkflowCanvasProps): UseWorkflowCanvasReturn {
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);

  // Multi-selection state (Set for O(1) lookups)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Undo/Redo history (limited to 10 states to reduce memory usage)
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const MAX_HISTORY = 10;

  // Clipboard state (localStorage key for cross-tab support)
  const CLIPBOARD_KEY = 'workflow-canvas-clipboard';

  // Mouse position tracking for paste
  const mousePositionRef = useRef<XYPosition>({ x: 100, y: 100 });

  // Track if we're syncing from parent to prevent loops
  const isSyncingFromParent = useRef(false);
  // Track last steps to detect external changes
  const lastStepsRef = useRef<SkillStep[]>(steps);
  // Track if canvas has been initialized (had nodes at some point)
  const hasInitialized = useRef(false);

  // ==========================================================================
  // Sync: Parent steps → Canvas nodes/edges (on mount or external changes)
  // ==========================================================================
  useEffect(() => {
    // Only sync if steps changed externally (not from our own onChange)
    const stepsChanged = steps !== lastStepsRef.current;
    const isInitialLoad = nodes.length === 0 && steps.length > 0;

    if (stepsChanged || isInitialLoad) {
      isSyncingFromParent.current = true;
      const { nodes: newNodes, edges: newEdges } = stepsToFlow(steps, canvasMetadata, skillInputs, skillOutputs);
      setNodes(newNodes);
      setEdges(newEdges);
      lastStepsRef.current = steps;

      // Reset sync flag after state update
      requestAnimationFrame(() => {
        isSyncingFromParent.current = false;
      });
    }
  }, [steps, canvasMetadata, skillInputs, skillOutputs, nodes.length, setNodes, setEdges]);

  // ==========================================================================
  // Sync: Canvas nodes/edges → Parent steps (on internal changes)
  // ==========================================================================
  const syncToParent = useCallback(() => {
    if (isSyncingFromParent.current) return;

    const result = flowToSteps(nodes, edges);
    lastStepsRef.current = result.steps;
    onChange(result);
  }, [nodes, edges, onChange]);

  // Debounced sync on node/edge changes
  useEffect(() => {
    if (isSyncingFromParent.current) return;

    // Track when we first get nodes
    if (nodes.length > 0) {
      hasInitialized.current = true;
    }

    // Skip sync if we've never had nodes (initial empty state)
    // But allow sync when deleting down to zero (hasInitialized is true)
    if (nodes.length === 0 && !hasInitialized.current) return;

    const timeoutId = setTimeout(() => {
      syncToParent();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, syncToParent]);

  // ==========================================================================
  // History Management (Undo/Redo) - Must be defined before node operations
  // ==========================================================================

  /**
   * Push current state to history stack
   */
  const pushHistory = useCallback(() => {
    setPast((p) => {
      const newPast = [...p.slice(-(MAX_HISTORY - 1)), { nodes, edges }];
      return newPast;
    });
    setFuture([]); // Clear redo stack on new action
  }, [nodes, edges]);

  /**
   * Undo last action
   */
  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    setPast(newPast);
    setFuture((f) => [{ nodes, edges }, ...f]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNodeIds(new Set());
  }, [past, nodes, edges, setNodes, setEdges]);

  /**
   * Redo last undone action
   */
  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    setFuture(newFuture);
    setPast((p) => [...p, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNodeIds(new Set());
  }, [future, nodes, edges, setNodes, setEdges]);

  // ==========================================================================
  // Node Operations
  // ==========================================================================

  /**
   * Add a new node at the specified position
   */
  const addNode = useCallback(
    (type: WorkflowNodeType, position: XYPosition) => {
      pushHistory();
      const id = crypto.randomUUID();
      const newNode: WorkflowNode = {
        id,
        type,
        position,
        data: getDefaultNodeData(type, id),
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeIds(new Set([id]));
    },
    [setNodes, pushHistory]
  );

  /**
   * Add a sticky note (canvas annotation, not a workflow step)
   */
  const addStickyNote = useCallback(
    (position: XYPosition) => {
      pushHistory();
      const id = crypto.randomUUID();
      const newNode = {
        id,
        type: 'sticky' as const,
        position,
        data: {
          content: '<p></p>',
          color: 'yellow' as const,
        },
        style: { width: 200, height: 120 },
      };

      setNodes((nds) => [...nds, newNode as WorkflowNode]);
      setSelectedNodeIds(new Set([id]));
    },
    [setNodes, pushHistory]
  );

  /**
   * Update a node's data
   */
  const updateNode = useCallback(
    (id: string, data: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
            : node
        )
      );
    },
    [setNodes]
  );

  /**
   * Delete a node and its connected edges
   */
  const deleteNode = useCallback(
    (id: string) => {
      pushHistory();
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== id && edge.target !== id)
      );
      setSelectedNodeIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    },
    [setNodes, setEdges, pushHistory]
  );

  /**
   * Delete multiple nodes and their connected edges
   */
  const deleteNodes = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return;
      pushHistory();
      setNodes((nds) => nds.filter((node) => !ids.has(node.id)));
      setEdges((eds) =>
        eds.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target))
      );
      setSelectedNodeIds(new Set());
    },
    [setNodes, setEdges, pushHistory]
  );

  // ==========================================================================
  // Clipboard Operations (Copy/Paste/Duplicate)
  // ==========================================================================

  /**
   * Copy selected nodes to clipboard
   */
  const copyNodes = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    const selectedNodes = nodes.filter((n) => selectedNodeIds.has(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    );

    // Calculate bounding box center for relative positioning
    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));

    const clipboardData = {
      nodes: selectedNodes.map((n) => ({
        ...n,
        position: { x: n.position.x - minX, y: n.position.y - minY },
      })),
      edges: selectedEdges,
    };

    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(clipboardData));
    return selectedNodes.length;
  }, [nodes, edges, selectedNodeIds]);

  /**
   * Paste nodes from clipboard at mouse position
   */
  const pasteNodes = useCallback(
    (position?: XYPosition) => {
      const clipboardJson = localStorage.getItem(CLIPBOARD_KEY);
      if (!clipboardJson) return;

      try {
        const clipboardData = JSON.parse(clipboardJson) as {
          nodes: WorkflowNode[];
          edges: WorkflowEdge[];
        };

        if (!clipboardData.nodes?.length) return;

        pushHistory();

        // Generate new IDs mapping
        const idMap = new Map<string, string>();
        clipboardData.nodes.forEach((n) => {
          idMap.set(n.id, crypto.randomUUID());
        });

        // Paste position (mouse or offset from 0,0)
        const pastePos = position || mousePositionRef.current;

        // Create new nodes with new IDs and positions
        const newNodes: WorkflowNode[] = clipboardData.nodes.map((n) => ({
          ...n,
          id: idMap.get(n.id)!,
          position: {
            x: pastePos.x + n.position.x,
            y: pastePos.y + n.position.y,
          },
          data: {
            ...n.data,
            name: `${n.data.name}_copy`,
          } as WorkflowNodeData,
        }));

        // Create new edges with updated IDs
        const newEdges: WorkflowEdge[] = clipboardData.edges.map((e) => ({
          ...e,
          id: `${idMap.get(e.source)}-${idMap.get(e.target)}-${e.type}-copy`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);

        // Select the newly pasted nodes
        setSelectedNodeIds(new Set(newNodes.map((n) => n.id)));
      } catch (e) {
        console.error('Failed to paste nodes:', e);
      }
    },
    [setNodes, setEdges, pushHistory]
  );

  /**
   * Duplicate selected nodes in place (offset by 20,20)
   */
  const duplicateNodes = useCallback(() => {
    copyNodes();
    // Offset from first selected node position
    const firstSelected = nodes.find((n) => selectedNodeIds.has(n.id));
    if (firstSelected) {
      pasteNodes({
        x: firstSelected.position.x + 30,
        y: firstSelected.position.y + 30,
      });
    }
  }, [copyNodes, pasteNodes, nodes, selectedNodeIds]);

  /**
   * Select all nodes
   */
  const selectAll = useCallback(() => {
    setSelectedNodeIds(new Set(nodes.map((n) => n.id)));
  }, [nodes]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

  /**
   * Update mouse position (called from canvas)
   */
  const updateMousePosition = useCallback((pos: XYPosition) => {
    mousePositionRef.current = pos;
  }, []);

  /**
   * Toggle disabled state for selected nodes
   */
  const toggleDisabled = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    pushHistory();

    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodeIds.has(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              isDisabled: !node.data.isDisabled,
            } as WorkflowNodeData,
          };
        }
        return node;
      })
    );
  }, [selectedNodeIds, setNodes, pushHistory]);

  /**
   * Rename a node and cascade update all variable references in other nodes.
   * This ensures {{oldName.xxx}} references are updated to {{newName.xxx}}.
   */
  const renameNode = useCallback(
    (id: string, newName: string) => {
      setNodes((nds) => {
        // Find the node to get old name
        const node = nds.find((n) => n.id === id);
        if (!node || node.type === 'sticky') return nds;

        // Cast to WorkflowNodeData since we've ruled out sticky nodes
        const nodeData = node.data as WorkflowNodeData;
        const oldName = nodeData.name;
        if (!oldName || oldName === newName) return nds;

        // Update all nodes: rename target node, cascade refs in others
        return nds.map((n) => {
          if (n.id === id) {
            // Update this node's name
            return { ...n, data: { ...n.data, name: newName } as WorkflowNodeData };
          }
          // Skip sticky nodes - they don't have variable references
          if (n.type === 'sticky') return n;
          // Cascade: update variable references in other nodes
          return {
            ...n,
            data: cascadeRenameInNodeData(n.data as WorkflowNodeData, oldName, newName),
          };
        });
      });
    },
    [setNodes]
  );

  // Backwards compatibility: single selected node ID (first in set)
  const selectedNodeId = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds)[0] : null;

  // Backwards compatibility: setSelectedNodeId sets single selection
  const setSelectedNodeId = useCallback((id: string | null) => {
    setSelectedNodeIds(id ? new Set([id]) : new Set());
  }, []);

  return {
    // State
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,

    // Single selection (backwards compatible)
    selectedNodeId,
    setSelectedNodeId,

    // Multi-selection
    selectedNodeIds,
    setSelectedNodeIds,
    selectAll,
    clearSelection,

    // Node operations
    addNode,
    addStickyNote,
    updateNode,
    renameNode,
    deleteNode,
    deleteNodes,

    // Clipboard operations
    copyNodes,
    pasteNodes,
    duplicateNodes,

    // History operations
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,

    // Other operations
    toggleDisabled,
    updateMousePosition,
  };
}
