'use client';

/**
 * WorkflowCanvas
 *
 * Main React Flow canvas for editing skill step workflows.
 * Provides n8n-style DAG editing with drag-and-drop nodes and port connections.
 *
 * Keyboard Shortcuts:
 * - Ctrl+C: Copy selected nodes
 * - Ctrl+V: Paste at mouse cursor
 * - Ctrl+D: Duplicate selected nodes
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z: Redo
 * - Ctrl+A: Select all nodes
 * - Delete/Backspace: Delete selected nodes
 * - Arrow keys: Navigate between connected nodes
 * - Escape: Clear selection
 * - F: Fit view
 * - Space: Center on selected node
 * - D: Toggle disabled on selected nodes
 * - Tab: Open quick add search at cursor
 * - Shift+S: Add sticky note at cursor
 * - Ctrl+K: Open command palette
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  Panel,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
  type Connection,
  type OnConnect,
  type OnSelectionChangeParams,
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
import type { SkillStep, InputDefinition, CanvasMetadata } from '@/ddd/domain/skills/entities/skill';
import type { FlowToStepsResult } from './utils/flow-converters';
import { useWorkflowCanvas } from './hooks/useWorkflowCanvas';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { QuickAddPopover } from './QuickAddPopover';
import { CommandPalette } from './CommandPalette';
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
import { StickyNode } from './nodes/StickyNode';

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
  sticky: StickyNode,
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
  onChange: (result: FlowToStepsResult) => void;
  skillInputs: InputDefinition[];

  // Optional props
  canvasMetadata?: CanvasMetadata;
  availableSkills?: AvailableSkill[];
  disabled?: boolean;
  showConfigPanel?: boolean;
  className?: string;

  // Expose internal state to parent (for external config panels)
  onNodeSelect?: (id: string | null) => void;
  onNodesExpose?: (nodes: WorkflowNode[]) => void;
  onEdgesExpose?: (edges: WorkflowEdge[]) => void;
  onUpdateNodeExpose?: (fn: (id: string, data: Partial<WorkflowNodeData>) => void) => void;
  onRenameNodeExpose?: (fn: (id: string, newName: string) => void) => void;
  onDeleteNodeExpose?: (fn: (id: string) => void) => void;
}

function WorkflowCanvasInner({
  steps,
  onChange,
  skillInputs,
  canvasMetadata,
  availableSkills = [],
  disabled = false,
  showConfigPanel = true,
  className,
  onNodeSelect,
  onNodesExpose,
  onEdgesExpose,
  onUpdateNodeExpose,
  onRenameNodeExpose,
  onDeleteNodeExpose,
}: WorkflowCanvasProps) {
  const { screenToFlowPosition, fitView, setCenter, getNode } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const mouseScreenPosition = useRef({ x: 0, y: 0 });

  // Quick Add popover state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddPosition, setQuickAddPosition] = useState({ x: 0, y: 0 });

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPalettePosition, setCommandPalettePosition] = useState({ x: 0, y: 0 });

  // Internal state management
  const {
    nodes,
    edges,
    setEdges,
    onNodesChange,
    onEdgesChange,
    selectedNodeId,
    setSelectedNodeId: internalSetSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectAll,
    clearSelection,
    addNode,
    updateNode,
    renameNode,
    deleteNode,
    deleteNodes,
    copyNodes,
    pasteNodes,
    duplicateNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    toggleDisabled,
    addStickyNote,
    updateMousePosition,
  } = useWorkflowCanvas({ steps, canvasMetadata, onChange });

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

  // Expose renameNode function to parent
  React.useEffect(() => {
    onRenameNodeExpose?.(renameNode);
  }, [renameNode, onRenameNodeExpose]);

  // Expose deleteNode function to parent
  React.useEffect(() => {
    onDeleteNodeExpose?.(deleteNode);
  }, [deleteNode, onDeleteNodeExpose]);

  // ==========================================================================
  // Keyboard Handling - All shortcuts
  // ==========================================================================
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl+C: Copy
      if (ctrlKey && event.key === 'c') {
        event.preventDefault();
        copyNodes();
        return;
      }

      // Ctrl+V: Paste
      if (ctrlKey && event.key === 'v') {
        event.preventDefault();
        pasteNodes();
        return;
      }

      // Ctrl+D: Duplicate
      if (ctrlKey && event.key === 'd') {
        event.preventDefault();
        duplicateNodes();
        return;
      }

      // Ctrl+Z: Undo
      if (ctrlKey && !event.shiftKey && event.key === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z: Redo
      if (ctrlKey && event.shiftKey && event.key === 'z') {
        event.preventDefault();
        redo();
        return;
      }

      // Ctrl+A: Select all
      if (ctrlKey && event.key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }

      // Delete/Backspace: Delete selected nodes
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeIds.size > 0) {
          event.preventDefault();
          deleteNodes(selectedNodeIds);
        }
        return;
      }

      // Escape: Clear selection
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
        return;
      }

      // F: Fit view
      if (event.key === 'f' && !ctrlKey) {
        event.preventDefault();
        fitView({ padding: 0.2 });
        return;
      }

      // Space: Center on selected node
      if (event.key === ' ' && selectedNodeId) {
        event.preventDefault();
        const node = getNode(selectedNodeId);
        if (node) {
          setCenter(node.position.x + 70, node.position.y + 30, { zoom: 1, duration: 300 });
        }
        return;
      }

      // D: Toggle disabled state
      if (event.key === 'd' && !ctrlKey && selectedNodeIds.size > 0) {
        event.preventDefault();
        toggleDisabled();
        return;
      }

      // Tab: Open quick add at mouse position
      if (event.key === 'Tab' && !ctrlKey && !event.shiftKey) {
        event.preventDefault();
        setQuickAddPosition(mouseScreenPosition.current);
        setQuickAddOpen(true);
        return;
      }

      // Shift+S: Add sticky note at mouse position
      if (event.key === 's' && event.shiftKey && !ctrlKey) {
        event.preventDefault();
        const position = screenToFlowPosition(mouseScreenPosition.current);
        addStickyNote(position);
        return;
      }

      // Ctrl+K: Open command palette
      if (ctrlKey && event.key === 'k') {
        event.preventDefault();
        setCommandPalettePosition(mouseScreenPosition.current);
        setCommandPaletteOpen(true);
        return;
      }

      // Arrow keys: Navigate between connected nodes
      if (selectedNodeId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          // Find outgoing edges
          const outgoing = edges.filter((e) => e.source === selectedNodeId);
          if (outgoing.length > 0) {
            internalSetSelectedNodeId(outgoing[0].target);
            onNodeSelect?.(outgoing[0].target);
          }
        } else {
          // Find incoming edges
          const incoming = edges.filter((e) => e.target === selectedNodeId);
          if (incoming.length > 0) {
            internalSetSelectedNodeId(incoming[0].source);
            onNodeSelect?.(incoming[0].source);
          }
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    selectedNodeIds,
    edges,
    copyNodes,
    pasteNodes,
    duplicateNodes,
    undo,
    redo,
    selectAll,
    clearSelection,
    deleteNodes,
    toggleDisabled,
    addStickyNote,
    fitView,
    setCenter,
    getNode,
    screenToFlowPosition,
    internalSetSelectedNodeId,
    onNodeSelect,
  ]);

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
  // Node Selection (with multi-select support)
  // ==========================================================================

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: any) => {
      // Ctrl/Cmd+click: Toggle selection
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

      if (ctrlKey) {
        setSelectedNodeIds((current) => {
          const next = new Set(current);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      } else if (event.shiftKey) {
        // Shift+click: Add to selection
        setSelectedNodeIds((current) => new Set([...current, node.id]));
      } else {
        // Regular click: Single select
        internalSetSelectedNodeId(node.id);
        onNodeSelect?.(node.id);
      }
    },
    [internalSetSelectedNodeId, setSelectedNodeIds, onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle React Flow's built-in selection changes (drag select)
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      if (selectedNodes.length > 0) {
        setSelectedNodeIds(new Set(selectedNodes.map((n) => n.id)));
        onNodeSelect?.(selectedNodes[0].id);
      }
    },
    [setSelectedNodeIds, onNodeSelect]
  );

  // Track mouse position for paste and quick add
  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // Track screen position for quick add popover
      mouseScreenPosition.current = { x: event.clientX, y: event.clientY };

      // Track flow position for paste
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      updateMousePosition(position);
    },
    [screenToFlowPosition, updateMousePosition]
  );

  // Handle quick add node selection
  const onQuickAddSelect = useCallback(
    (type: WorkflowNodeType) => {
      const position = screenToFlowPosition(quickAddPosition);
      addNode(type, position);
      setQuickAddOpen(false);
    },
    [screenToFlowPosition, quickAddPosition, addNode]
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      ref={canvasRef}
      className={cn(
        'h-full w-full rounded-lg border bg-background',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      onMouseMove={onMouseMove}
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
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode={['Control', 'Meta']}
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

      {/* Quick Add Popover */}
      <QuickAddPopover
        isOpen={quickAddOpen}
        position={quickAddPosition}
        onClose={() => setQuickAddOpen(false)}
        onSelect={onQuickAddSelect}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        position={commandPalettePosition}
        onClose={() => setCommandPaletteOpen(false)}
        onCopy={copyNodes}
        onPaste={pasteNodes}
        onDuplicate={duplicateNodes}
        onUndo={undo}
        onRedo={redo}
        onDelete={() => deleteNodes(selectedNodeIds)}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onFitView={() => fitView({ padding: 0.2 })}
        onCenterSelected={() => {
          if (selectedNodeId) {
            const node = getNode(selectedNodeId);
            if (node) {
              setCenter(node.position.x + 70, node.position.y + 30, { zoom: 1, duration: 300 });
            }
          }
        }}
        onToggleDisabled={toggleDisabled}
        onAddStickyNote={() => {
          const position = screenToFlowPosition(commandPalettePosition);
          addStickyNote(position);
        }}
        hasSelection={selectedNodeIds.size > 0}
        canUndo={canUndo}
        canRedo={canRedo}
      />
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
