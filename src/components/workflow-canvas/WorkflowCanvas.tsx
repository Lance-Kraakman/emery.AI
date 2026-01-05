'use client';

/**
 * WorkflowCanvas
 *
 * Main React Flow canvas for editing skill step workflows.
 * Provides n8n-style DAG editing with drag-and-drop nodes and port connections.
 *
 * Can be used in two modes:
 * 1. Controlled mode: Parent provides nodes/edges via useWorkflowCanvas hook
 * 2. Uncontrolled mode: Uses steps prop and manages state internally
 */

import React, { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Panel,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/styles/reactflow-custom.css';

import { cn } from '@/lib/utils';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowNodeData,
  AvailableSkill,
} from './types';
import type { SkillStep, InputDefinition } from '@/ddd/domain/skills/entities/skill';
import { useWorkflowCanvas } from './hooks/useWorkflowCanvas';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { getDefaultNodeData } from './utils/flow-converters';

// Node components
import { SkillRefNode } from './nodes/SkillRefNode';
import { ConditionNode } from './nodes/ConditionNode';
import { LoopNode } from './nodes/LoopNode';
import { AgenticNode } from './nodes/AgenticNode';
import { OperationNode } from './nodes/OperationNode';
import { ToolNode } from './nodes/ToolNode';
import { WriteNode } from './nodes/WriteNode';
import { ReadNode } from './nodes/ReadNode';

// Edge components
import { DeletableEdge } from './edges/DeletableEdge';

// Register node types
const nodeTypes = {
  skillRef: SkillRefNode,
  condition: ConditionNode,
  loop: LoopNode,
  agentic: AgenticNode,
  operation: OperationNode,
  tool: ToolNode,
  write: WriteNode,
  read: ReadNode,
};

// Register edge types
const edgeTypes = {
  success: DeletableEdge,
  error: DeletableEdge,
  condition: DeletableEdge,
  default: DeletableEdge,
};

/**
 * WorkflowCanvas props - uncontrolled mode with optional expose callbacks
 */
export interface WorkflowCanvasProps {
  // Required props
  steps: SkillStep[];
  onChange: (steps: SkillStep[]) => void;
  skillInputs: InputDefinition[];

  // Optional props
  availableSkills?: AvailableSkill[];
  disabled?: boolean;
  showConfigPanel?: boolean;
  className?: string;

  // Expose internal state to parent (for external config panels)
  onNodeSelect?: (id: string | null) => void;
  onNodesExpose?: (nodes: WorkflowNode[]) => void;
  onEdgesExpose?: (edges: WorkflowEdge[]) => void;
  onUpdateNodeExpose?: (fn: (id: string, data: Partial<WorkflowNodeData>) => void) => void;
  onDeleteNodeExpose?: (fn: (id: string) => void) => void;
}

function WorkflowCanvasInner({
  steps,
  onChange,
  skillInputs,
  availableSkills = [],
  disabled = false,
  showConfigPanel = true,
  className,
  onNodeSelect,
  onNodesExpose,
  onEdgesExpose,
  onUpdateNodeExpose,
  onDeleteNodeExpose,
}: WorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  // Internal state management
  const {
    nodes,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    selectedNodeId,
    setSelectedNodeId: internalSetSelectedNodeId,
    addNode,
    updateNode,
    deleteNode,
  } = useWorkflowCanvas({ steps, onChange });

  // Expose nodes to parent when they change
  React.useEffect(() => {
    onNodesExpose?.(nodes);
  }, [nodes, onNodesExpose]);

  // Expose edges to parent when they change
  React.useEffect(() => {
    onEdgesExpose?.(edges);
  }, [edges, onEdgesExpose]);

  // Expose updateNode function to parent
  React.useEffect(() => {
    onUpdateNodeExpose?.(updateNode);
  }, [updateNode, onUpdateNodeExpose]);

  // Expose deleteNode function to parent
  React.useEffect(() => {
    onDeleteNodeExpose?.(deleteNode);
  }, [deleteNode, onDeleteNodeExpose]);

  // ==========================================================================
  // Keyboard Handling (Delete/Backspace to delete selected node)
  // ==========================================================================
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Delete/Backspace when a node is selected
      if (!selectedNodeId) return;

      // Don't trigger when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteNode(selectedNodeId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, deleteNode]);

  // Wrap setSelectedNodeId to also notify parent
  const setSelectedNodeId = React.useCallback((id: string | null) => {
    internalSetSelectedNodeId(id);
    onNodeSelect?.(id);
  }, [internalSetSelectedNodeId, onNodeSelect]);

  // ==========================================================================
  // Connection Handling
  // ==========================================================================

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      // Prevent self-connections
      if (params.source === params.target) return;

      // Determine edge type from source handle
      const edgeType = params.sourceHandle?.includes('error')
        ? 'error'
        : params.sourceHandle?.startsWith('cond_')
          ? 'condition'
          : 'success';

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: edgeType,
            data: { label: edgeType },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // ==========================================================================
  // Drag & Drop from Palette
  // ==========================================================================

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        'application/reactflow'
      ) as WorkflowNodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  // ==========================================================================
  // Node Selection
  // ==========================================================================

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      className={cn(
        'h-full w-full rounded-lg border bg-background',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        proOptions={{ hideAttribution: true }}
        className="workflow-canvas"
      >
        <Controls />
        <Background gap={16} />

        {/* Node Palette */}
        <Panel position="top-left" className="m-2">
          <NodePalette disabled={disabled} />
        </Panel>

        {/* Node Configuration Panel - only in uncontrolled mode or when explicitly enabled */}
        {showConfigPanel && (
          <Panel position="top-right" className="m-2 w-80">
            <NodeConfigPanel
              nodeId={selectedNodeId ?? null}
              nodes={nodes}
              onUpdateNode={updateNode}
              skillInputs={skillInputs}
              availableSkills={availableSkills}
              disabled={disabled}
            />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

/**
 * WorkflowCanvas with ReactFlowProvider wrapper
 */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// Re-export the hook for parent components to use in controlled mode
export { useWorkflowCanvas } from './hooks/useWorkflowCanvas';
