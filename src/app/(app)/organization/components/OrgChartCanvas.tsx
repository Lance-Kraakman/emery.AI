'use client';

/**
 * OrgChartCanvas Component
 *
 * React Flow canvas for the organization chart editor.
 * Shows hierarchical org structure with agents as containers.
 */

import React, { useCallback, useRef, useState } from 'react';
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
import { Undo2, Redo2, StickyNote, Search, Maximize, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { orgChartNodeTypes } from '@/components/org-chart/nodes';
import { orgChartEdgeTypes } from '@/components/org-chart/edges';
import { useOrgChartCanvas } from '@/components/org-chart/hooks/useOrgChartCanvas';
import { EntityPalette } from './EntityPalette';
import { SearchDialog } from './SearchDialog';
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const {
    nodes,
    edges,
    setNodes,
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
      // Cmd/Ctrl + K = Open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }
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

  // Handle search result selection
  const handleSearchSelect = useCallback(
    (nodeId: string, nodeType: OrgChartNodeType, entityId: number) => {
      setSelectedNodeId(nodeId);
      if (onSelect) {
        onSelect(nodeId, nodeType, entityId);
      }
    },
    [setSelectedNodeId, onSelect]
  );

  // Simple auto-arrange: position agents in a grid, with their resources inside
  const handleAutoArrange = useCallback(() => {
    const agentNodes = nodes.filter((n) => n.type === 'agent');
    const orgResourcesNode = nodes.find((n) => n.type === 'org_resources');
    const otherNodes = nodes.filter((n) => n.type !== 'agent' && n.type !== 'org_resources');

    const PADDING = 50;
    const AGENT_WIDTH = 350;
    const AGENT_HEIGHT = 300;
    const COLS = 3;

    let newNodes = [...nodes];

    // Position org resources at top
    if (orgResourcesNode) {
      newNodes = newNodes.map((n) =>
        n.id === orgResourcesNode.id ? { ...n, position: { x: PADDING, y: PADDING } } : n
      );
    }

    // Position agents in a grid below org resources
    const startY = orgResourcesNode ? PADDING + 200 : PADDING;
    agentNodes.forEach((agent, index) => {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const x = PADDING + col * (AGENT_WIDTH + PADDING);
      const y = startY + row * (AGENT_HEIGHT + PADDING);

      newNodes = newNodes.map((n) => (n.id === agent.id ? { ...n, position: { x, y } } : n));
    });

    setNodes(newNodes);
  }, [nodes, setNodes]);

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
        edgeTypes={orgChartEdgeTypes}
        defaultEdgeOptions={{
          type: 'reference',
          animated: false,
        }}
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
          <TooltipProvider delayDuration={300}>
            {/* Undo/Redo */}
            <div className="flex gap-1 bg-card border rounded-lg shadow-sm p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={undo}
                    disabled={disabled || !canUndo}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Undo <kbd className="ml-1 text-[10px] opacity-60">⌘Z</kbd></p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={redo}
                    disabled={disabled || !canRedo}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Redo <kbd className="ml-1 text-[10px] opacity-60">⌘⇧Z</kbd></p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Layout tools */}
            {!disabled && (
              <div className="flex gap-1 bg-card border rounded-lg shadow-sm p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleAutoArrange}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Auto-arrange</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Add tools */}
            {!disabled && (
              <div className="flex gap-1 bg-card border rounded-lg shadow-sm p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleAddStickyNote}
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Add Note</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsSearchOpen(true)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Search <kbd className="ml-1 text-[10px] opacity-60">⌘K</kbd></p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </TooltipProvider>
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

      {/* Search dialog */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        agents={agents}
        skills={skills}
        databases={databases}
        onSelectEntity={handleSearchSelect}
      />
    </div>
  );
}

export default OrgChartCanvas;
