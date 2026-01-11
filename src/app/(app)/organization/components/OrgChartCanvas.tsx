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
  type Connection,
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
  getNextGridSlotPosition,
} from '@/components/org-chart/utils';
import { DeleteConfirmationDialog, buildDeleteImpactItems } from '@/components/org-chart/dialogs';
import { EntityPalette } from './EntityPalette';
import { SearchDialog } from './SearchDialog';
import { StickyNoteProvider } from '@/components/shared/StickyNoteContext';
import { OrgChartDragProvider } from '@/components/org-chart/context';
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
  /** Callback when an entity is selected - includes connected edges for skills */
  onSelect?: (
    nodeId: string | null,
    nodeType?: OrgChartNodeType,
    entityId?: number,
    connectedEdges?: Array<{ id: string; target: string; edgeType: string }>
  ) => void;
  /** Callback when an entity should be opened (e.g., navigate to skill editor) */
  onOpenEntity?: (entityType: OrgChartNodeType, entityId: number) => void;
  /** Callback when a new entity should be created - returns the created entity */
  onCreateEntity?: (entityType: OrgChartNodeType, agentId?: number) => Promise<{ id: number; name: string; [key: string]: any } | null>;
  /** Callback when entities should be deleted - returns true if successful */
  onDeleteEntities?: (items: Array<{ type: OrgChartNodeType; entityId: number }>) => Promise<boolean>;
  /** Initial viewport from session/metadata (if provided, overrides fitView) */
  initialViewport?: { x: number; y: number; zoom: number } | null;
  /** Callback when viewport changes (for session persistence) */
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
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
  initialViewport,
  onViewportChange,
}: OrgChartCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Note: We don't pass onSelect to useOrgChart - we handle it in handleSelectionChange
  // so we have access to edges at selection time

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
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
    // onSelect is handled in handleSelectionChange where we have access to edges
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
      const agentData = targetAgent?.data as AgentContainerNodeData | undefined;

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
            // If dropping inside agent, snap to grid slot; otherwise use drop position
            const nodePosition = targetAgent
              ? getNextGridSlotPosition('skill', agentData?.skillCount ?? 0)
              : position;
            addSkillNode(
              { id: createdSkill.id, name: createdSkill.name, agentId },
              nodePosition
            );
          }
          break;
        }
        case 'database': {
          // Databases can be org-level (null) or agent-scoped
          const createdDb = await onCreateEntity('database', agentId ?? undefined);
          if (createdDb) {
            // If dropping inside agent, snap to grid slot; otherwise use drop position
            const nodePosition = targetAgent
              ? getNextGridSlotPosition('database', agentData?.databaseCount ?? 0)
              : position;
            addDatabaseNode(
              { id: createdDb.id, name: createdDb.name, slug: createdDb.slug || 'db', agentId },
              nodePosition
            );
          }
          break;
        }
      }
    },
    [reactFlowInstance, onCreateEntity, addAgentNode, addSkillNode, addDatabaseNode, nodes]
  );

  // Validate connection attempts - only allow valid edge types
  const isValidConnection = useCallback(
    (connection: Connection | { source: string; target: string }) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return false;

      // Only allow skill → skill or skill → database
      if (sourceNode.type === 'skill') {
        return targetNode.type === 'skill' || targetNode.type === 'database';
      }

      // Database → skill is normalized in handleConnect, allow it
      if (sourceNode.type === 'database' && targetNode.type === 'skill') {
        return true;
      }

      return false;
    },
    [nodes]
  );

  // Handle manual edge creation (drag from handle to handle)
  const handleConnect = useCallback(
    (connection: Connection) => {
      console.log('[OrgChartCanvas] handleConnect called with:', {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });

      if (!connection.source || !connection.target) return;

      // Determine edge type based on source/target node types
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      console.log('[OrgChartCanvas] Found nodes:', {
        sourceNode: sourceNode ? { id: sourceNode.id, type: sourceNode.type, parentId: sourceNode.parentId } : null,
        targetNode: targetNode ? { id: targetNode.id, type: targetNode.type, parentId: targetNode.parentId } : null,
      });

      if (!sourceNode || !targetNode) return;

      // Extract which SIDE (left/right) the user dragged from/to
      const sourceSide = connection.sourceHandle?.startsWith('left') ? 'left' : 'right';
      const targetSide = connection.targetHandle?.startsWith('left') ? 'left' : 'right';

      // Normalize direction: skill should always be the source
      // This handles both skill→database and database→skill drags
      let actualSource = connection.source!;
      let actualTarget = connection.target!;
      let actualSourceHandle: string;
      let actualTargetHandle: string;
      let edgeType: 'skill_ref' | 'skill_table' = 'skill_table';
      let label = 'uses';

      if (sourceNode.type === 'skill' && targetNode.type === 'skill') {
        // skill → skill (no swap needed)
        edgeType = 'skill_ref';
        label = 'references';
        actualSourceHandle = `${sourceSide}-source`;
        actualTargetHandle = `${targetSide}-target`;
      } else if (sourceNode.type === 'skill' && targetNode.type === 'database') {
        // skill → database (no swap needed)
        edgeType = 'skill_table';
        label = 'uses';
        actualSourceHandle = `${sourceSide}-source`;
        actualTargetHandle = `${targetSide}-target`;
      } else if (sourceNode.type === 'database' && targetNode.type === 'skill') {
        // database → skill (swap to skill → database)
        actualSource = connection.target!;
        actualTarget = connection.source!;
        // After swap: skill is source, database is target
        // The side the user dragged TO (targetSide on skill) becomes the source side
        // The side the user dragged FROM (sourceSide on database) becomes the target side
        actualSourceHandle = `${targetSide}-source`;
        actualTargetHandle = `${sourceSide}-target`;
        edgeType = 'skill_table';
        label = 'uses';
      } else {
        // Unsupported connection type
        console.log('[OrgChartCanvas] Unsupported edge type:', sourceNode.type, '→', targetNode.type);
        return;
      }

      // Create unique edge ID
      const edgeId = `edge-${actualSource}-${actualTarget}-${Date.now()}`;

      // Add edge - sourceHandle must be a *-source handle, targetHandle must be a *-target handle
      setEdges((eds) => [
        ...eds,
        {
          id: edgeId,
          source: actualSource,
          target: actualTarget,
          sourceHandle: actualSourceHandle,
          targetHandle: actualTargetHandle,
          type: 'reference',
          data: {
            edgeType,
            label,
          },
        },
      ]);
    },
    [nodes, setEdges]
  );

  // Handle selection changes
  // Handle selection changes - includes edges for skills
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      console.log('[OrgChartCanvas] handleSelectionChange called, selectedNodes:', selectedNodes);

      if (selectedNodes.length === 0) {
        console.log('[OrgChartCanvas] No nodes selected, calling onSelect(null)');
        setSelectedNodeId(null);
        if (onSelect) {
          onSelect(null);
        }
      } else if (selectedNodes.length === 1) {
        const node = selectedNodes[0];
        setSelectedNodeId(node.id);

        if (onSelect) {
          // Parse entity ID from node ID (e.g., "skill-123" -> 123)
          const match = node.id.match(/^([a-z_]+)-(\d+)$/);
          const entityId = match ? parseInt(match[2], 10) : undefined;

          // For skills, include connected edges
          let connectedEdges: Array<{ id: string; target: string; edgeType: string }> | undefined;
          if (node.type === 'skill') {
            console.log('[OrgChartCanvas] Skill selected:', node.id);
            console.log('[OrgChartCanvas] All edges:', edges);
            console.log('[OrgChartCanvas] Edges for this skill:', edges.filter((e) => e.source === node.id));

            connectedEdges = edges
              .filter((e) => e.source === node.id)
              .map((e) => ({
                id: e.id,
                target: e.target,
                edgeType: ((e.data as any)?.edgeType as string) || 'skill_table',
              }));

            console.log('[OrgChartCanvas] Connected edges to pass:', connectedEdges);
          }

          onSelect(node.id, node.type as OrgChartNodeType, entityId, connectedEdges);
        }
      }
    },
    [setSelectedNodeId, onSelect, edges]
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
      // Delete/Backspace = Delete edges or show node delete confirmation
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();

        // Delete selected edges directly (no confirmation needed - they're canvas-only)
        const selectedEdges = edges.filter((e) => e.selected);
        if (selectedEdges.length > 0) {
          setEdges((eds) => eds.filter((e) => !e.selected));
        }

        // Handle node deletion with confirmation
        if (selectedNodeIds.size > 0) {
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
      }
    },
    [undo, redo, deleteNodes, selectedNodeIds, nodes, edges, setEdges]
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

    // First, resize agents to fit their children (sectioned layout)
    newNodes = newNodes.map((node) => {
      if (node.type !== 'agent') return node;
      const data = node.data as AgentContainerNodeData;
      const { width, height } = calculateAgentDimensions(
        data.skillCount ?? 0,
        data.databaseCount ?? 0
      );
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
    <OrgChartDragProvider>
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
        onConnect={disabled ? undefined : handleConnect}
        isValidConnection={isValidConnection}
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
        // Use saved viewport if available, otherwise fit view
        {...(initialViewport
          ? { defaultViewport: initialViewport }
          : { fitView: true, fitViewOptions: { padding: 0.2 } }
        )}
        onMoveEnd={(_, viewport) => {
          onViewportChange?.({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
        }}
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
    </OrgChartDragProvider>
  );
}

export default OrgChartCanvas;
