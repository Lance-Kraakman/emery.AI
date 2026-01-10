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
import { orgChartNodeSizes } from '@/components/org-chart/theme';
import { useOrgChart } from '@/components/org-chart/hooks';
import {
  getNodeDimensions,
  arrangeNodesInRow,
  arrangeAgentsInRows,
  arrangeChildrenInGrid,
  calculateAgentDimensions,
} from '@/components/org-chart/utils';
import { DeleteConfirmationDialog, buildDeleteImpactItems } from '@/components/org-chart/dialogs';
import { EntityPalette } from './EntityPalette';
import { SearchDialog } from './SearchDialog';
import { StickyNoteProvider } from '@/components/shared/StickyNoteContext';
import type { OrgChartCanvasMetadata, OrgChartNodeType, AgentContainerNodeData } from '@/components/org-chart/types';

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
  /** Callback when a new entity should be created - returns the created entity */
  onCreateEntity?: (entityType: OrgChartNodeType, agentId?: number) => Promise<{ id: number; name: string; [key: string]: any } | null>;
  /** Callback when entities should be deleted - returns true if successful */
  onDeleteEntities?: (items: Array<{ type: OrgChartNodeType; entityId: number }>) => Promise<boolean>;
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
  onDeleteEntities,
}: OrgChartCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Memoize onSelect wrapper to prevent hook callback recreation
  const handleSelectInternal = useCallback(
    (nodeId: string | null, nodeType?: OrgChartNodeType) => {
      if (onSelect) {
        // Parse entity ID from node ID
        const match = nodeId?.match(/^([a-z_]+)-(\d+)$/);
        const entityId = match ? parseInt(match[2], 10) : undefined;
        onSelect(nodeId, nodeType, entityId);
      }
    },
    [onSelect]
  );

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
    updateNode,
    deleteNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    toggleAgentExpanded,
    addAgentNode,
    addSkillNode,
    addDatabaseNode,
  } = useOrgChart({
    agents,
    skills,
    databases,
    canvasMetadata,
    onSelect: handleSelectInternal,
  });

  // Handler for sticky note updates
  const handleUpdateStickyNote = useCallback(
    (id: string, data: { name?: string; content?: string }) => {
      updateNode(id, data);
    },
    [updateNode]
  );

  // Get React Flow instance for coordinate conversion
  const reactFlowInstance = useReactFlow();

  // Handle drag over for entity palette
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from entity palette
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const entityType = event.dataTransfer.getData('application/orgchart-entity') as OrgChartNodeType;
      if (!entityType || !onCreateEntity) return;

      // Get drop position in flow coordinates
      // screenToFlowPosition expects screen/client coordinates directly
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropping inside an agent container by checking bounds directly
      // React Flow stores resized dimensions in node.width/height or node.measured, not node.style
      const agentNodes = nodes.filter((n) => n.type === 'agent');
      const targetAgent = agentNodes.find((agentNode) => {
        const nodeAny = agentNode as any;
        const nodeWidth = nodeAny.width ?? nodeAny.measured?.width ?? (agentNode.style?.width as number) ?? 400;
        const nodeHeight = nodeAny.height ?? nodeAny.measured?.height ?? (agentNode.style?.height as number) ?? 140;
        return (
          position.x >= agentNode.position.x &&
          position.x <= agentNode.position.x + nodeWidth &&
          position.y >= agentNode.position.y &&
          position.y <= agentNode.position.y + nodeHeight
        );
      });
      const agentId = targetAgent
        ? (targetAgent.data as AgentContainerNodeData).agentId
        : null;

      // If dropping inside an agent, convert absolute position to relative position
      // React Flow expects child node positions to be relative to their parent
      const nodePosition = targetAgent
        ? { x: position.x - targetAgent.position.x, y: position.y - targetAgent.position.y }
        : position;

      // Create entity on server first, then add node at drop position
      switch (entityType) {
        case 'agent': {
          const createdAgent = await onCreateEntity('agent');
          if (createdAgent) {
            addAgentNode(
              { id: createdAgent.id, name: createdAgent.name, role: createdAgent.role },
              position // Agents use absolute position
            );
          }
          break;
        }
        case 'skill': {
          // Skills can be agent-scoped or org-level (null agentId)
          const createdSkill = await onCreateEntity('skill', agentId ?? undefined);
          if (createdSkill) {
            addSkillNode(
              { id: createdSkill.id, name: createdSkill.name, agentId },
              nodePosition // Relative if inside agent
            );
          }
          break;
        }
        case 'database': {
          // Databases can be org-level (null) or agent-scoped
          const createdDb = await onCreateEntity('database', agentId ?? undefined);
          if (createdDb) {
            addDatabaseNode(
              { id: createdDb.id, name: createdDb.name, slug: createdDb.slug || 'db', agentId },
              nodePosition // Relative if inside agent
            );
          }
          break;
        }
      }
    },
    [reactFlowInstance, onCreateEntity, addAgentNode, addSkillNode, addDatabaseNode, nodes]
  );

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
      // Delete/Backspace = Show delete confirmation
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeIds.size > 0) {
        event.preventDefault();
        // Filter out sticky notes from deletion confirmation (they're canvas-only)
        const nodesToDelete = new Set<string>();
        selectedNodeIds.forEach((id) => {
          const node = nodes.find((n) => n.id === id);
          if (node && node.type !== 'sticky') {
            nodesToDelete.add(id);
          } else if (node?.type === 'sticky') {
            // Immediately delete sticky notes (canvas-only, no server data)
            deleteNodes(new Set([id]));
          }
        });
        if (nodesToDelete.size > 0) {
          setPendingDeleteIds(nodesToDelete);
          setIsDeleteDialogOpen(true);
        }
      }
    },
    [undo, redo, deleteNodes, selectedNodeIds, nodes]
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!onDeleteEntities || pendingDeleteIds.size === 0) {
      // No server deletion callback - just delete from canvas
      deleteNodes(pendingDeleteIds);
      setIsDeleteDialogOpen(false);
      setPendingDeleteIds(new Set());
      return;
    }

    setIsDeleting(true);

    // Build list of entities to delete
    const itemsToDelete: Array<{ type: OrgChartNodeType; entityId: number }> = [];
    pendingDeleteIds.forEach((nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const match = nodeId.match(/^([a-z_]+)-(\d+)$/);
      if (match) {
        itemsToDelete.push({
          type: match[1] as OrgChartNodeType,
          entityId: parseInt(match[2], 10),
        });
      }
    });

    try {
      const success = await onDeleteEntities(itemsToDelete);
      if (success) {
        // Remove nodes from canvas
        deleteNodes(pendingDeleteIds);
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setPendingDeleteIds(new Set());
    }
  }, [onDeleteEntities, pendingDeleteIds, deleteNodes, nodes]);

  // Build delete impact items for the dialog
  const deleteImpactItems = buildDeleteImpactItems(pendingDeleteIds, nodes, skills, databases);

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

  // Auto-arrange: horizontal org-chart style layout
  const handleAutoArrange = useCallback(() => {
    const GAP = 40;
    const PADDING = 50;
    const MAX_ROW_WIDTH = 1600;
    let currentY = PADDING;
    let newNodes = [...nodes];

    // 1. Arrange org-level skills in a horizontal row
    const orgSkillIds = new Set(
      newNodes.filter((n) => n.type === 'skill' && !n.parentId).map((n) => n.id)
    );
    if (orgSkillIds.size > 0) {
      const result = arrangeNodesInRow(
        newNodes,
        orgSkillIds,
        PADDING,
        currentY,
        GAP,
        orgChartNodeSizes.nodeWidth
      );
      newNodes = result.updatedNodes;
      currentY += Math.max(result.rowHeight, orgChartNodeSizes.nodeHeight) + GAP;
    }

    // 2. Arrange org-level databases in a horizontal row
    const orgDatabaseIds = new Set(
      newNodes.filter((n) => n.type === 'database' && !n.parentId).map((n) => n.id)
    );
    if (orgDatabaseIds.size > 0) {
      const result = arrangeNodesInRow(
        newNodes,
        orgDatabaseIds,
        PADDING,
        currentY,
        GAP,
        orgChartNodeSizes.nodeWidth
      );
      newNodes = result.updatedNodes;
      currentY += Math.max(result.rowHeight, orgChartNodeSizes.nodeHeight) + GAP;
    }

    // 3. Size agents based on their children and arrange in horizontal rows
    const agentIds = newNodes.filter((n) => n.type === 'agent').map((n) => n.id);

    // First, resize agents to fit their children
    newNodes = newNodes.map((node) => {
      if (node.type !== 'agent') return node;
      const data = node.data as AgentContainerNodeData;
      const childCount = (data.skillCount ?? 0) + (data.databaseCount ?? 0);
      const { width, height } = calculateAgentDimensions(childCount);
      return {
        ...node,
        style: { ...node.style, width, height },
      };
    });

    // Arrange agents in horizontal rows
    newNodes = arrangeAgentsInRows(newNodes, agentIds, PADDING, currentY, GAP, MAX_ROW_WIDTH);

    // 4. Arrange children inside each agent in a 2-column grid
    for (const agentId of agentIds) {
      newNodes = arrangeChildrenInGrid(newNodes, agentId);
    }

    // 5. Keep sticky notes in their relative positions (don't rearrange)

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
      <StickyNoteProvider updateNote={handleUpdateStickyNote}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={disabled ? undefined : onNodesChange}
        onEdgesChange={disabled ? undefined : onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onDragOver={disabled ? undefined : handleDragOver}
        onDrop={disabled ? undefined : handleDrop}
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

        {/* Left panel - toolbar + entity palette in vertical stack */}
        <Panel position="top-left" className="flex flex-col gap-2">
          {/* Toolbar - glassmorphic style */}
          <div className="flex gap-1 bg-background/50 backdrop-blur-sm border rounded-lg shadow-sm p-1">
            <TooltipProvider delayDuration={300}>
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
              {!disabled && (
                <>
                  <div className="w-px h-6 bg-border mx-0.5" />
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
                </>
              )}
            </TooltipProvider>
          </div>

          {/* Entity palette - below toolbar */}
          {!disabled && onCreateEntity && (
            <EntityPalette
              disabled={disabled}
              onCreateEntity={(type) => onCreateEntity(type)}
            />
          )}
        </Panel>

        {/* Selection info panel */}
        {selectedNodeId && (
          <Panel position="bottom-center" className="bg-card border rounded-lg shadow-sm px-3 py-1.5 text-xs text-muted-foreground">
            Selected: {selectedNodeId}
          </Panel>
        )}
      </ReactFlow>
      </StickyNoteProvider>

      {/* Search dialog */}
      <SearchDialog
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        agents={agents}
        skills={skills}
        databases={databases}
        onSelectEntity={handleSearchSelect}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setPendingDeleteIds(new Set());
        }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemsToDelete={deleteImpactItems}
      />
    </div>
  );
}

export default OrgChartCanvas;
