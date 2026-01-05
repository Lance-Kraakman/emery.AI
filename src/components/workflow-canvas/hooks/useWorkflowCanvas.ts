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
  addEdge,
  type Connection,
  type XYPosition,
} from '@xyflow/react';
import type { SkillStep } from '@/ddd/domain/skills/entities/skill';
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
} from '../utils/flow-converters';

interface UseWorkflowCanvasProps {
  steps: SkillStep[];
  onChange: (steps: SkillStep[]) => void;
}

export function useWorkflowCanvas({
  steps,
  onChange,
}: UseWorkflowCanvasProps): UseWorkflowCanvasReturn {
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([]);

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
      const { nodes: newNodes, edges: newEdges } = stepsToFlow(steps);
      setNodes(newNodes);
      setEdges(newEdges);
      lastStepsRef.current = steps;

      // Reset sync flag after state update
      requestAnimationFrame(() => {
        isSyncingFromParent.current = false;
      });
    }
  }, [steps, nodes.length, setNodes, setEdges]);

  // ==========================================================================
  // Sync: Canvas nodes/edges → Parent steps (on internal changes)
  // ==========================================================================
  const syncToParent = useCallback(() => {
    if (isSyncingFromParent.current) return;

    const newSteps = flowToSteps(nodes, edges);
    lastStepsRef.current = newSteps;
    onChange(newSteps);
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
  // Node Operations
  // ==========================================================================

  /**
   * Add a new node at the specified position
   */
  const addNode = useCallback(
    (type: WorkflowNodeType, position: XYPosition) => {
      const id = `${type}_${Date.now()}`;
      const newNode: WorkflowNode = {
        id,
        type,
        position,
        data: getDefaultNodeData(type),
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(id);
    },
    [setNodes]
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
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== id && edge.target !== id)
      );
      // Use functional update to avoid dependency on selectedNodeId
      setSelectedNodeId((current) => (current === id ? null : current));
    },
    [setNodes, setEdges]
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    updateNode,
    deleteNode,
  };
}
