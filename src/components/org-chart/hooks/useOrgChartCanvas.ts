/**
 * useOrgChartCanvas Hook
 *
 * Main state management hook for the org chart canvas.
 * Builds hierarchy from EmeryStore data and manages canvas state.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  useNodesState,
  useEdgesState,
  type XYPosition,
} from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartNodeData,
  OrgChartNodeType,
  AgentContainerNodeData,
  SkillNodeData,
  DatabaseNodeData,
  StickyNoteData,
  UseOrgChartCanvasReturn,
  OrgChartCanvasMetadata,
  PersistedOrgChartStickyNote,
} from '../types';
import { orgChartNodeSizes } from '../theme';
import { saveOrgChartCanvasMetadata } from '@/app/actions/organizations';

// =============================================================================
// Types
// =============================================================================

interface UseOrgChartCanvasProps {
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
  /** Callback when selection changes */
  onSelect?: (nodeId: string | null, nodeType?: OrgChartNodeType) => void;
}

// History state for undo/redo
interface HistoryState {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate node ID from entity type and ID
 */
function makeNodeId(type: OrgChartNodeType, entityId: number | string): string {
  return `${type}-${entityId}`;
}

/**
 * Parse entity info from node ID
 */
function parseNodeId(nodeId: string): { type: OrgChartNodeType; entityId: string } | null {
  const match = nodeId.match(/^([a-z_]+)-(.+)$/);
  if (!match) return null;
  return { type: match[1] as OrgChartNodeType, entityId: match[2] };
}

/**
 * Build initial nodes and edges from data
 */
function buildOrgChartFromData(
  agents: UseOrgChartCanvasProps['agents'],
  skills: UseOrgChartCanvasProps['skills'],
  databases: UseOrgChartCanvasProps['databases'],
  canvasMetadata?: OrgChartCanvasMetadata
): { nodes: OrgChartNode[]; edges: OrgChartEdge[] } {
  const nodes: OrgChartNode[] = [];
  const edges: OrgChartEdge[] = [];

  // Get saved positions or use defaults
  const agentPositions = canvasMetadata?.agentPositions || {};
  const agentExpandedStates = canvasMetadata?.agentExpandedStates || {};

  // Create org-level section (positioned at top)
  const orgSkills = skills.filter((s) => s.agentId === null || s.agentId === undefined);
  const orgDatabases = databases.filter((d) => d.agentId === null || d.agentId === undefined);

  // Create org resources section if there are org-level resources
  if (orgSkills.length > 0 || orgDatabases.length > 0) {
    nodes.push({
      id: 'org-resources',
      type: 'org_resources',
      position: { x: 50, y: 50 },
      data: {
        name: 'Organization Resources',
        resourceType: 'all',
      },
    });

    // Add org-level skills
    orgSkills.forEach((skill, index) => {
      const nodeId = makeNodeId('skill', skill.id);
      nodes.push({
        id: nodeId,
        type: 'skill',
        position: {
          x: 80 + (index % 3) * (orgChartNodeSizes.nodeWidth + 20),
          y: 100 + Math.floor(index / 3) * (orgChartNodeSizes.nodeHeight + 20),
        },
        parentId: 'org-resources',
        extent: 'parent',
        data: {
          name: skill.name,
          skillId: skill.id,
          executionType: skill.executionType,
          agentId: null,
        } as SkillNodeData,
      });
    });

    // Add org-level databases (after skills)
    const dbStartY = 100 + Math.ceil(orgSkills.length / 3) * (orgChartNodeSizes.nodeHeight + 20) + 40;
    orgDatabases.forEach((db, index) => {
      const nodeId = makeNodeId('database', db.id);
      nodes.push({
        id: nodeId,
        type: 'database',
        position: {
          x: 80 + (index % 3) * (orgChartNodeSizes.nodeWidth + 20),
          y: dbStartY + Math.floor(index / 3) * (orgChartNodeSizes.nodeHeight + 20),
        },
        parentId: 'org-resources',
        extent: 'parent',
        data: {
          name: db.name,
          databaseId: db.id,
          slug: db.slug,
          agentId: null,
          tableCount: db.tableCount,
        } as DatabaseNodeData,
      });
    });
  }

  // Calculate starting Y for agents (below org resources)
  const agentStartY = orgSkills.length > 0 || orgDatabases.length > 0 ? 400 : 50;

  // Create agent container nodes
  agents.forEach((agent, agentIndex) => {
    const agentNodeId = makeNodeId('agent', agent.id);
    const savedPosition = agentPositions[agent.id];
    const isExpanded = agentExpandedStates[agent.id] ?? true;

    // Get agent's resources
    const agentSkills = skills.filter((s) => s.agentId === agent.id);
    const agentDatabases = databases.filter((d) => d.agentId === agent.id);

    // Calculate container size based on children
    const childCount = agentSkills.length + agentDatabases.length;
    const rows = Math.ceil(childCount / 2);
    const containerHeight = isExpanded
      ? Math.max(
          orgChartNodeSizes.containerMinHeight,
          60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
        )
      : 60; // Collapsed height

    // Create agent node
    nodes.push({
      id: agentNodeId,
      type: 'agent',
      position: savedPosition || {
        x: 50 + (agentIndex % 2) * (orgChartNodeSizes.containerMinWidth + 40),
        y: agentStartY + Math.floor(agentIndex / 2) * (containerHeight + 40),
      },
      style: {
        width: orgChartNodeSizes.containerMinWidth,
        height: containerHeight,
      },
      data: {
        name: agent.name,
        agentId: agent.id,
        role: agent.role,
        status: agent.status,
        skillCount: agentSkills.length,
        databaseCount: agentDatabases.length,
        automationCount: 0, // TODO: Add automations
        isExpanded,
      } as AgentContainerNodeData,
    });

    // Only add children if expanded
    if (isExpanded) {
      // Add agent's skills
      agentSkills.forEach((skill, index) => {
        const nodeId = makeNodeId('skill', skill.id);
        nodes.push({
          id: nodeId,
          type: 'skill',
          position: {
            x: orgChartNodeSizes.containerPadding + (index % 2) * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap),
            y: 50 + Math.floor(index / 2) * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap),
          },
          parentId: agentNodeId,
          extent: 'parent',
          data: {
            name: skill.name,
            skillId: skill.id,
            executionType: skill.executionType,
            agentId: agent.id,
          } as SkillNodeData,
        });
      });

      // Add agent's databases (after skills)
      const dbStartIndex = agentSkills.length;
      agentDatabases.forEach((db, index) => {
        const nodeId = makeNodeId('database', db.id);
        const combinedIndex = dbStartIndex + index;
        nodes.push({
          id: nodeId,
          type: 'database',
          position: {
            x: orgChartNodeSizes.containerPadding + (combinedIndex % 2) * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap),
            y: 50 + Math.floor(combinedIndex / 2) * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap),
          },
          parentId: agentNodeId,
          extent: 'parent',
          data: {
            name: db.name,
            databaseId: db.id,
            slug: db.slug,
            agentId: agent.id,
            tableCount: db.tableCount,
          } as DatabaseNodeData,
        });
      });
    }
  });

  // Add saved sticky notes
  if (canvasMetadata?.stickyNotes) {
    canvasMetadata.stickyNotes.forEach((note) => {
      nodes.push({
        id: note.id,
        type: 'sticky',
        position: note.position,
        style: note.size ? { width: note.size.width, height: note.size.height } : { width: 200, height: 120 },
        data: {
          name: note.name,
          content: note.content,
          color: note.color || 'yellow',
        } as StickyNoteData,
      });
    });
  }

  return { nodes, edges };
}

// =============================================================================
// Hook
// =============================================================================

export function useOrgChartCanvas({
  agents,
  skills,
  databases,
  canvasMetadata,
  onSelect,
}: UseOrgChartCanvasProps): UseOrgChartCanvasReturn {
  // Build initial state from data
  const initial = buildOrgChartFromData(agents, skills, databases, canvasMetadata);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgChartNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<OrgChartEdge>(initial.edges);

  // Multi-selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());

  // Undo/Redo history
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const MAX_HISTORY = 10;

  // Clipboard key
  const CLIPBOARD_KEY = 'org-chart-clipboard';

  // Mouse position tracking
  const mousePositionRef = useRef<XYPosition>({ x: 100, y: 100 });

  // ==========================================================================
  // History Management
  // ==========================================================================

  const pushHistory = useCallback(() => {
    setPast((p) => {
      const newPast = [...p.slice(-(MAX_HISTORY - 1)), { nodes, edges }];
      return newPast;
    });
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [{ nodes, edges }, ...f]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSelectedNodeIds(new Set());
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNodeIds(new Set());
  }, [future, nodes, edges, setNodes, setEdges]);

  // ==========================================================================
  // Node Operations
  // ==========================================================================

  const addAgent = useCallback(
    async (position: XYPosition): Promise<string> => {
      pushHistory();
      const tempId = `temp-agent-${Date.now()}`;
      const newNode: OrgChartNode = {
        id: tempId,
        type: 'agent',
        position,
        style: {
          width: orgChartNodeSizes.containerMinWidth,
          height: orgChartNodeSizes.containerMinHeight,
        },
        data: {
          name: 'New Agent',
          agentId: -1, // Temporary, will be set after server save
          isExpanded: true,
          skillCount: 0,
          databaseCount: 0,
          automationCount: 0,
        } as AgentContainerNodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeIds(new Set([tempId]));
      return tempId;
    },
    [setNodes, pushHistory]
  );

  const addSkill = useCallback(
    async (position: XYPosition, agentId?: number | null): Promise<string> => {
      pushHistory();
      const tempId = `temp-skill-${Date.now()}`;

      // Determine parent node
      let parentId: string | undefined;
      if (agentId) {
        parentId = makeNodeId('agent', agentId);
      }

      const newNode: OrgChartNode = {
        id: tempId,
        type: 'skill',
        position,
        parentId,
        extent: parentId ? 'parent' : undefined,
        data: {
          name: 'New Skill',
          skillId: -1, // Temporary
          agentId: agentId || null,
        } as SkillNodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeIds(new Set([tempId]));
      return tempId;
    },
    [setNodes, pushHistory]
  );

  const addDatabase = useCallback(
    async (position: XYPosition, agentId?: number | null): Promise<string> => {
      pushHistory();
      const tempId = `temp-database-${Date.now()}`;

      let parentId: string | undefined;
      if (agentId) {
        parentId = makeNodeId('agent', agentId);
      }

      const newNode: OrgChartNode = {
        id: tempId,
        type: 'database',
        position,
        parentId,
        extent: parentId ? 'parent' : undefined,
        data: {
          name: 'New Database',
          databaseId: -1, // Temporary
          slug: 'new-database',
          agentId: agentId || null,
        } as DatabaseNodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeIds(new Set([tempId]));
      return tempId;
    },
    [setNodes, pushHistory]
  );

  const addStickyNote = useCallback(
    (position: XYPosition) => {
      pushHistory();
      const id = crypto.randomUUID();
      const newNode: OrgChartNode = {
        id,
        type: 'sticky',
        position,
        style: { width: 200, height: 120 },
        data: {
          name: 'Note',
          content: '',
          color: 'yellow',
        } as StickyNoteData,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeIds(new Set([id]));
    },
    [setNodes, pushHistory]
  );

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
    (id: string) => {
      pushHistory();

      // Find children to delete (for container nodes)
      const nodeToDelete = nodes.find((n) => n.id === id);
      const childIds = nodes.filter((n) => n.parentId === id).map((n) => n.id);
      const idsToDelete = new Set([id, ...childIds]);

      setNodes((nds) => nds.filter((node) => !idsToDelete.has(node.id)));
      setEdges((eds) =>
        eds.filter((edge) => !idsToDelete.has(edge.source) && !idsToDelete.has(edge.target))
      );
      setSelectedNodeIds((current) => {
        const next = new Set(current);
        idsToDelete.forEach((nodeId) => next.delete(nodeId));
        return next;
      });
    },
    [nodes, setNodes, setEdges, pushHistory]
  );

  const deleteNodes = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return;
      pushHistory();

      // Collect all IDs including children
      const allIds = new Set(ids);
      nodes.forEach((n) => {
        if (n.parentId && ids.has(n.parentId)) {
          allIds.add(n.id);
        }
      });

      setNodes((nds) => nds.filter((node) => !allIds.has(node.id)));
      setEdges((eds) =>
        eds.filter((edge) => !allIds.has(edge.source) && !allIds.has(edge.target))
      );
      setSelectedNodeIds(new Set());
    },
    [nodes, setNodes, setEdges, pushHistory]
  );

  // ==========================================================================
  // Container Operations
  // ==========================================================================

  const toggleAgentExpanded = useCallback(
    (nodeId: string) => {
      pushHistory();
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId && node.type === 'agent') {
            const data = node.data as AgentContainerNodeData;
            const isExpanded = !data.isExpanded;

            // Calculate new height
            const childCount = (data.skillCount || 0) + (data.databaseCount || 0);
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

      // Show/hide child nodes
      const agentNode = nodes.find((n) => n.id === nodeId);
      if (agentNode && agentNode.type === 'agent') {
        const isCurrentlyExpanded = (agentNode.data as AgentContainerNodeData).isExpanded;
        // Child visibility is handled by the parent size change
      }
    },
    [nodes, setNodes, pushHistory]
  );

  // ==========================================================================
  // Clipboard Operations
  // ==========================================================================

  const copyNodes = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    const selectedNodes = nodes.filter((n) => selectedNodeIds.has(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    );

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

  const pasteNodes = useCallback(
    (position?: XYPosition) => {
      const clipboardJson = localStorage.getItem(CLIPBOARD_KEY);
      if (!clipboardJson) return;

      try {
        const clipboardData = JSON.parse(clipboardJson) as {
          nodes: OrgChartNode[];
          edges: OrgChartEdge[];
        };

        if (!clipboardData.nodes?.length) return;

        pushHistory();

        const idMap = new Map<string, string>();
        clipboardData.nodes.forEach((n) => {
          idMap.set(n.id, crypto.randomUUID());
        });

        const pastePos = position || mousePositionRef.current;

        const newNodes: OrgChartNode[] = clipboardData.nodes.map((n) => ({
          ...n,
          id: idMap.get(n.id)!,
          parentId: n.parentId ? idMap.get(n.parentId) : undefined,
          position: {
            x: pastePos.x + n.position.x,
            y: pastePos.y + n.position.y,
          },
          data: {
            ...n.data,
            name: `${(n.data as any).name}_copy`,
          } as OrgChartNodeData,
        }));

        const newEdges: OrgChartEdge[] = clipboardData.edges.map((e) => ({
          ...e,
          id: `${idMap.get(e.source)}-${idMap.get(e.target)}-copy`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
        }));

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        setSelectedNodeIds(new Set(newNodes.map((n) => n.id)));
      } catch (e) {
        console.error('Failed to paste nodes:', e);
      }
    },
    [setNodes, setEdges, pushHistory]
  );

  // ==========================================================================
  // Selection Operations
  // ==========================================================================

  const selectAll = useCallback(() => {
    setSelectedNodeIds(new Set(nodes.map((n) => n.id)));
  }, [nodes]);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

  // Single selection (backwards compatible)
  const selectedNodeId = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds)[0] : null;

  const setSelectedNodeId = useCallback(
    (id: string | null) => {
      setSelectedNodeIds(id ? new Set([id]) : new Set());
      if (onSelect) {
        const node = nodes.find((n) => n.id === id);
        onSelect(id, node?.type);
      }
    },
    [nodes, onSelect]
  );

  // ==========================================================================
  // Auto-save Canvas Metadata
  // ==========================================================================

  // Extract canvas metadata from current state
  const extractCanvasMetadata = useCallback((): OrgChartCanvasMetadata => {
    const agentPositions: Record<number, { x: number; y: number }> = {};
    const agentExpandedStates: Record<number, boolean> = {};
    const stickyNotes: PersistedOrgChartStickyNote[] = [];

    nodes.forEach((node) => {
      if (node.type === 'agent') {
        const data = node.data as AgentContainerNodeData;
        agentPositions[data.agentId] = { x: node.position.x, y: node.position.y };
        agentExpandedStates[data.agentId] = data.isExpanded ?? true;
      } else if (node.type === 'sticky') {
        const data = node.data as StickyNoteData;
        stickyNotes.push({
          id: node.id,
          name: data.name,
          content: data.content,
          color: data.color,
          position: node.position,
          size: node.style ? {
            width: typeof node.style.width === 'number' ? node.style.width : 200,
            height: typeof node.style.height === 'number' ? node.style.height : 120,
          } : undefined,
        });
      }
    });

    return { agentPositions, agentExpandedStates, stickyNotes };
  }, [nodes]);

  // Debounced auto-save effect
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      const metadata = extractCanvasMetadata();
      const metadataJson = JSON.stringify(metadata);

      // Only save if something changed
      if (metadataJson !== lastSavedRef.current) {
        lastSavedRef.current = metadataJson;
        saveOrgChartCanvasMetadata(metadata).catch((err) => {
          console.error('Failed to auto-save canvas metadata:', err);
        });
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, extractCanvasMetadata]);

  return {
    // State
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,

    // Selection
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectAll,
    clearSelection,

    // Node operations
    addAgent,
    addSkill,
    addDatabase,
    addStickyNote,
    updateNode,
    deleteNode,
    deleteNodes,

    // Container operations
    toggleAgentExpanded,

    // Clipboard operations
    copyNodes,
    pasteNodes,

    // History operations
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
