'use client';

/**
 * OrgChartCanvas Component
 *
 * React Flow canvas for the organization chart editor.
 * Shows hierarchical org structure with agents as containers.
 */

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  useReactFlow,
  type OnSelectionChangeParams,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/lib/utils';
import { Undo2, Redo2, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { orgChartNodeTypes } from '@/components/org-chart/nodes';
import { useOrgChartCanvas } from '@/components/org-chart/hooks/useOrgChartCanvas';
import { EntityPalette } from './EntityPalette';
import type { OrgChartCanvasMetadata, OrgChartNodeType } from '@/components/org-chart/types';

interface OrgChartCanvasProps {
  /** Initial agents */
  agents: Array<{
    id: number;
    name: string;
    role?: string;
    status?: string;
  }>;
  /** Initial skills */
  skills: Array<{
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
  }>;
  /** Initial databases */
  databases: Array<{
    id: number;
    name: string;
    slug: string;
    agentId?: number | null;
    tableCount?: number;
  }>;
  /** Saved canvas metadata */
  canvasMetadata?: OrgChartCanvasMetadata;
  /** Whether the canvas is read-only */
  disabled?: boolean;
  /** Callback when an entity is selected */
  onSelect?: (nodeId: string | null, nodeType?: OrgChartNodeType, entityId?: number) => void;
  /** Callback when an entity should be opened (e.g., navigate to skill editor) */
  onOpenEntity?: (entityType: OrgChartNodeType, entityId: number) => void;
  /** Callback when a new entity should be created */
  onCreateEntity?: (entityType: OrgChartNodeType, agentId?: number) => void;
}

export function OrgChartCanvas({
  agents,
  skills,
  databases,
  canvasMetadata,
  disabled = false,
  onSelect,
  onOpenEntity,
  onCreateEntity,
}: OrgChartCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    addStickyNote,
    deleteNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    toggleAgentExpanded,
  } = useOrgChartCanvas({
    agents,
    skills,
    databases,
    canvasMetadata,
    onSelect: (nodeId, nodeType) => {
      if (onSelect) {
        // Parse entity ID from node ID
        const match = nodeId?.match(/^([a-z_]+)-(\d+)$/);
        const entityId = match ? parseInt(match[2], 10) : undefined;
        onSelect(nodeId, nodeType, entityId);
      }
    },
  });

  // Handle selection changes
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      if (selectedNodes.length === 0) {
        setSelectedNodeId(null);
      } else if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id);
      }
    },
    [setSelectedNodeId]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Cmd/Ctrl + Z = Undo
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      // Cmd/Ctrl + Shift + Z = Redo
      if ((event.metaKey || event.ctrlKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      }
      // Delete/Backspace = Delete selected nodes
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeIds.size > 0) {
        event.preventDefault();
        deleteNodes(selectedNodeIds);
      }
    },
    [undo, redo, deleteNodes, selectedNodeIds]
  );

  // Handle node double-click (open editor)
  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: any) => {
      if (onOpenEntity) {
        const match = node.id.match(/^([a-z_]+)-(\d+)$/);
        if (match) {
          const nodeType = match[1] as OrgChartNodeType;
          const entityId = parseInt(match[2], 10);
          onOpenEntity(nodeType, entityId);
        }
      }

      // Toggle expand/collapse for agent containers
      if (node.type === 'agent') {
        toggleAgentExpanded(node.id);
      }
    },
    [onOpenEntity, toggleAgentExpanded]
  );

  // Add sticky note at center
  const handleAddStickyNote = useCallback(() => {
    const center: XYPosition = { x: 400, y: 300 };
    addStickyNote(center);
  }, [addStickyNote]);

  return (
    <div
      ref={reactFlowWrapper}
      className="h-full w-full"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={disabled ? undefined : onNodesChange}
        onEdgesChange={disabled ? undefined : onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={orgChartNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={null} // We handle delete manually
        selectionOnDrag={!disabled}
        panOnScroll
        panOnDrag={[1, 2]} // Middle and right mouse button
        selectionMode={SelectionMode.Full} // Box must fully contain nodes
        className="bg-muted/30"
      >
        {/* Background grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.2)"
        />

        {/* Controls (zoom in/out/fit) */}
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !shadow-sm"
        />

        {/* Minimap */}
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={(node) => {
            switch (node.type) {
              case 'agent':
                return '#10b981'; // emerald
              case 'skill':
                return '#8b5cf6'; // violet
              case 'database':
                return '#64748b'; // slate
              case 'sticky':
                return '#eab308'; // yellow
              default:
                return '#94a3b8';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />

        {/* Toolbar panel */}
        <Panel position="top-left" className="flex gap-2">
          {/* Undo/Redo */}
          <div className="flex gap-1 bg-card border rounded-lg shadow-sm p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={undo}
              disabled={disabled || !canUndo}
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={redo}
              disabled={disabled || !canRedo}
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Add sticky note */}
          {!disabled && (
            <div className="flex gap-1 bg-card border rounded-lg shadow-sm p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleAddStickyNote}
                title="Add Note"
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Panel>

        {/* Entity palette */}
        {!disabled && onCreateEntity && (
          <Panel position="top-right">
            <EntityPalette
              disabled={disabled}
              onCreateEntity={(type) => onCreateEntity(type)}
            />
          </Panel>
        )}

        {/* Selection info panel */}
        {selectedNodeId && (
          <Panel position="bottom-center" className="bg-card border rounded-lg shadow-sm px-3 py-1.5 text-xs text-muted-foreground">
            Selected: {selectedNodeId}
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export default OrgChartCanvas;
