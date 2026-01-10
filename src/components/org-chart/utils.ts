/**
 * Org Chart Utility Functions
 *
 * Helper functions for org chart node creation and manipulation.
 */

import type { XYPosition } from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartNodeType,
  OrgChartCanvasMetadata,
  AgentContainerNodeData,
  SkillNodeData,
  DatabaseNodeData,
  StickyNoteData,
  PersistedOrgChartStickyNote,
} from './types';
import { orgChartNodeSizes } from './theme';

// =============================================================================
// Types for utility functions
// =============================================================================

export interface Agent {
  id: number;
  name: string;
  role?: string;
  status?: string;
}

export interface Skill {
  id: number;
  name: string;
  executionType?: string;
  agentId?: number | null;
}

export interface Database {
  id: number;
  name: string;
  slug: string;
  agentId?: number | null;
  tableCount?: number;
}

// =============================================================================
// Node ID Utilities
// =============================================================================

/**
 * Generate node ID from entity type and ID
 */
export function makeNodeId(type: OrgChartNodeType, entityId: number | string): string {
  return `${type}-${entityId}`;
}

/**
 * Parse entity info from node ID
 */
export function parseNodeId(nodeId: string): { type: OrgChartNodeType; entityId: string } | null {
  const match = nodeId.match(/^([a-z_]+)-(.+)$/);
  if (!match) return null;
  return { type: match[1] as OrgChartNodeType, entityId: match[2] };
}

// =============================================================================
// Node Dimension Utilities
// =============================================================================

/**
 * Get actual node dimensions from React Flow node.
 * React Flow stores resized dimensions in node.width/height or node.measured,
 * falling back to node.style for initial values.
 */
export function getNodeDimensions(node: OrgChartNode): { width: number; height: number } {
  const nodeAny = node as any;
  return {
    width: nodeAny.width ?? nodeAny.measured?.width ??
      (typeof node.style?.width === 'number' ? node.style.width : orgChartNodeSizes.containerMinWidth),
    height: nodeAny.height ?? nodeAny.measured?.height ??
      (typeof node.style?.height === 'number' ? node.style.height : orgChartNodeSizes.containerMinHeight),
  };
}

/**
 * Calculate required height for an agent container based on child count.
 */
export function calculateAgentContentHeight(childCount: number): number {
  const rows = Math.ceil(childCount / 2);
  return 60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
}

/**
 * Ensure a position is within the agent content area (below header).
 * Header is approximately 50px tall.
 */
export function ensureContentAreaPosition(position: XYPosition, hasParent: boolean): XYPosition {
  if (!hasParent) return position;
  return { x: position.x, y: Math.max(50, position.y) };
}

// =============================================================================
// Auto-Arrange Layout Utilities
// =============================================================================

/**
 * Calculate agent container dimensions based on child count.
 * Returns width and height that will fit children in a 2-column grid.
 */
export function calculateAgentDimensions(childCount: number): { width: number; height: number } {
  const width = orgChartNodeSizes.containerMinWidth;
  const height = Math.max(
    orgChartNodeSizes.containerMinHeight,
    calculateAgentContentHeight(childCount)
  );
  return { width, height };
}

/**
 * Arrange a list of node IDs horizontally in a row.
 * Updates node positions in place and returns the row height.
 */
export function arrangeNodesInRow(
  nodes: OrgChartNode[],
  nodeIds: Set<string>,
  startX: number,
  startY: number,
  gap: number,
  nodeWidth: number
): { updatedNodes: OrgChartNode[]; rowHeight: number } {
  let currentX = startX;
  let maxHeight = 0;

  const updatedNodes = nodes.map((node) => {
    if (!nodeIds.has(node.id)) return node;

    const { height } = getNodeDimensions(node);
    maxHeight = Math.max(maxHeight, height);

    const updatedNode = { ...node, position: { x: currentX, y: startY } };
    currentX += nodeWidth + gap;
    return updatedNode;
  });

  return { updatedNodes, rowHeight: maxHeight };
}

/**
 * Arrange agents in horizontal rows, wrapping to new row when exceeding max width.
 */
export function arrangeAgentsInRows(
  nodes: OrgChartNode[],
  agentIds: string[],
  startX: number,
  startY: number,
  gap: number,
  maxRowWidth: number
): OrgChartNode[] {
  let currentX = startX;
  let currentY = startY;
  let rowMaxHeight = 0;

  return nodes.map((node) => {
    if (!agentIds.includes(node.id)) return node;

    const { width, height } = getNodeDimensions(node);

    // Check if we need to wrap to next row
    if (currentX + width > maxRowWidth && currentX > startX) {
      currentX = startX;
      currentY += rowMaxHeight + gap;
      rowMaxHeight = 0;
    }

    const updatedNode = { ...node, position: { x: currentX, y: currentY } };
    currentX += width + gap;
    rowMaxHeight = Math.max(rowMaxHeight, height);

    return updatedNode;
  });
}

/**
 * Arrange children inside an agent container in a 2-column grid.
 * Children positions are relative to the parent agent.
 */
export function arrangeChildrenInGrid(
  nodes: OrgChartNode[],
  parentId: string
): OrgChartNode[] {
  const children = nodes.filter((n) => n.parentId === parentId);
  if (children.length === 0) return nodes;

  const childIds = new Set(children.map((c) => c.id));
  let index = 0;

  return nodes.map((node) => {
    if (!childIds.has(node.id)) return node;

    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = orgChartNodeSizes.containerPadding + col * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = 50 + row * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);

    index++;
    return { ...node, position: { x, y } };
  });
}

// =============================================================================
// Node Creation Functions
// =============================================================================

/**
 * Create an agent container node
 */
export function createAgentNode(
  agent: Agent,
  position?: XYPosition | null,
  metadata?: OrgChartCanvasMetadata,
  skills?: Skill[],
  databases?: Database[]
): OrgChartNode {
  const savedPosition = metadata?.agentPositions?.[agent.id];
  const savedDimensions = metadata?.agentDimensions?.[agent.id];
  const isExpanded = metadata?.agentExpandedStates?.[agent.id] ?? true;

  // Count resources for this agent
  const agentSkills = skills?.filter((s) => s.agentId === agent.id) ?? [];
  const agentDatabases = databases?.filter((d) => d.agentId === agent.id) ?? [];
  const childCount = agentSkills.length + agentDatabases.length;
  const rows = Math.ceil(childCount / 2);

  const defaultHeight = isExpanded
    ? Math.max(
        orgChartNodeSizes.containerMinHeight,
        60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
      )
    : 60;

  return {
    id: makeNodeId('agent', agent.id),
    type: 'agent',
    position: position ?? savedPosition ?? { x: 50, y: 50 },
    style: {
      width: savedDimensions?.width ?? orgChartNodeSizes.containerMinWidth,
      height: savedDimensions?.height ?? defaultHeight,
    },
    data: {
      name: agent.name,
      agentId: agent.id,
      role: agent.role,
      status: agent.status,
      skillCount: agentSkills.length,
      databaseCount: agentDatabases.length,
      automationCount: 0,
      isExpanded,
    } as AgentContainerNodeData,
  };
}

/**
 * Create a skill node
 */
export function createSkillNode(
  skill: Skill,
  position?: XYPosition | null,
  metadata?: OrgChartCanvasMetadata,
  indexInParent?: number
): OrgChartNode {
  const parentId = skill.agentId ? makeNodeId('agent', skill.agentId) : undefined;
  const savedPosition = metadata?.skillPositions?.[skill.id];

  // Priority: explicit position > saved position > calculated default
  let finalPosition: XYPosition;
  if (position) {
    finalPosition = position;
  } else if (savedPosition) {
    finalPosition = savedPosition;
  } else if (parentId && indexInParent !== undefined) {
    // Inside agent container - calculate grid position
    finalPosition = {
      x: orgChartNodeSizes.containerPadding + (indexInParent % 2) * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap),
      y: 50 + Math.floor(indexInParent / 2) * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap),
    };
  } else {
    finalPosition = { x: 50, y: 50 };
  }

  return {
    id: makeNodeId('skill', skill.id),
    type: 'skill',
    position: finalPosition,
    parentId,
    extent: parentId ? 'parent' : undefined,
    data: {
      name: skill.name,
      skillId: skill.id,
      executionType: skill.executionType,
      agentId: skill.agentId ?? null,
    } as SkillNodeData,
  };
}

/**
 * Create a database node
 */
export function createDatabaseNode(
  db: Database,
  position?: XYPosition | null,
  metadata?: OrgChartCanvasMetadata,
  indexInParent?: number
): OrgChartNode {
  const parentId = db.agentId ? makeNodeId('agent', db.agentId) : undefined;
  const savedPosition = metadata?.databasePositions?.[db.id];

  // Priority: explicit position > saved position > calculated default
  let finalPosition: XYPosition;
  if (position) {
    finalPosition = position;
  } else if (savedPosition) {
    finalPosition = savedPosition;
  } else if (parentId && indexInParent !== undefined) {
    // Inside agent container - calculate grid position
    finalPosition = {
      x: orgChartNodeSizes.containerPadding + (indexInParent % 2) * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap),
      y: 50 + Math.floor(indexInParent / 2) * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap),
    };
  } else {
    finalPosition = { x: 50, y: 50 };
  }

  return {
    id: makeNodeId('database', db.id),
    type: 'database',
    position: finalPosition,
    parentId,
    extent: parentId ? 'parent' : undefined,
    data: {
      name: db.name,
      databaseId: db.id,
      slug: db.slug,
      agentId: db.agentId ?? null,
      tableCount: db.tableCount,
    } as DatabaseNodeData,
  };
}

// =============================================================================
// Build Chart from Data
// =============================================================================

/**
 * Build initial nodes and edges from data
 */
export function buildOrgChartFromData(
  agents: Agent[],
  skills: Skill[],
  databases: Database[],
  canvasMetadata?: OrgChartCanvasMetadata
): { nodes: OrgChartNode[]; edges: OrgChartEdge[] } {
  const nodes: OrgChartNode[] = [];
  const edges: OrgChartEdge[] = [];

  // Get saved positions from metadata
  const agentPositions = canvasMetadata?.agentPositions ?? {};
  const skillPositions = canvasMetadata?.skillPositions ?? {};
  const databasePositions = canvasMetadata?.databasePositions ?? {};

  // Org-level resources (no parent container)
  const orgSkills = skills.filter((s) => s.agentId === null || s.agentId === undefined);
  const orgDatabases = databases.filter((d) => d.agentId === null || d.agentId === undefined);

  // Add org-level skills
  orgSkills.forEach((skill, index) => {
    const savedPosition = skillPositions[skill.id];
    nodes.push(createSkillNode(skill, savedPosition ?? {
      x: 50 + (index % 4) * (orgChartNodeSizes.nodeWidth + 20),
      y: 50 + Math.floor(index / 4) * (orgChartNodeSizes.nodeHeight + 20),
    }, canvasMetadata));
  });

  // Add org-level databases
  const dbStartY = orgSkills.length > 0
    ? 50 + Math.ceil(orgSkills.length / 4) * (orgChartNodeSizes.nodeHeight + 20) + 20
    : 50;
  orgDatabases.forEach((db, index) => {
    const savedPosition = databasePositions[db.id];
    nodes.push(createDatabaseNode(db, savedPosition ?? {
      x: 50 + (index % 4) * (orgChartNodeSizes.nodeWidth + 20),
      y: dbStartY + Math.floor(index / 4) * (orgChartNodeSizes.nodeHeight + 20),
    }, canvasMetadata));
  });

  // Calculate starting Y for agents (below org resources)
  const orgResourceRows = Math.ceil(orgSkills.length / 4) + Math.ceil(orgDatabases.length / 4);
  const agentStartY = orgResourceRows > 0
    ? 50 + orgResourceRows * (orgChartNodeSizes.nodeHeight + 20) + 40
    : 50;

  // Create agent container nodes with their children
  agents.forEach((agent, agentIndex) => {
    const savedPosition = agentPositions[agent.id];
    const isExpanded = canvasMetadata?.agentExpandedStates?.[agent.id] ?? true;

    // Get agent's resources
    const agentSkills = skills.filter((s) => s.agentId === agent.id);
    const agentDatabases = databases.filter((d) => d.agentId === agent.id);

    // Calculate container dimensions
    const childCount = agentSkills.length + agentDatabases.length;
    const rows = Math.ceil(childCount / 2);
    const defaultHeight = isExpanded
      ? Math.max(
          orgChartNodeSizes.containerMinHeight,
          60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
        )
      : 60;

    // Create agent node
    nodes.push(createAgentNode(
      agent,
      savedPosition ?? {
        x: 50 + (agentIndex % 2) * (orgChartNodeSizes.containerMinWidth + 40),
        y: agentStartY + Math.floor(agentIndex / 2) * (defaultHeight + 40),
      },
      canvasMetadata,
      skills,
      databases
    ));

    // Add children if expanded
    if (isExpanded) {
      const agentNodeId = makeNodeId('agent', agent.id);

      // Add agent's skills
      agentSkills.forEach((skill, index) => {
        const node = createSkillNode(skill, undefined, canvasMetadata, index);
        node.parentId = agentNodeId;
        node.extent = 'parent';
        nodes.push(node);
      });

      // Add agent's databases
      agentDatabases.forEach((db, index) => {
        const combinedIndex = agentSkills.length + index;
        const node = createDatabaseNode(db, undefined, canvasMetadata, combinedIndex);
        node.parentId = agentNodeId;
        node.extent = 'parent';
        nodes.push(node);
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
          color: note.color ?? 'yellow',
        } as StickyNoteData,
      });
    });
  }

  return { nodes, edges };
}

// =============================================================================
// Metadata Extraction
// =============================================================================

/**
 * Extract canvas metadata from current nodes for persistence
 */
export function extractMetadataFromNodes(nodes: OrgChartNode[]): OrgChartCanvasMetadata {
  const agentPositions: Record<number, { x: number; y: number }> = {};
  const agentExpandedStates: Record<number, boolean> = {};
  const agentDimensions: Record<number, { width: number; height: number }> = {};
  const skillPositions: Record<number, { x: number; y: number }> = {};
  const databasePositions: Record<number, { x: number; y: number }> = {};
  const stickyNotes: PersistedOrgChartStickyNote[] = [];

  nodes.forEach((node) => {
    if (node.type === 'agent') {
      const data = node.data as AgentContainerNodeData;
      agentPositions[data.agentId] = { x: node.position.x, y: node.position.y };
      agentExpandedStates[data.agentId] = data.isExpanded ?? true;
      agentDimensions[data.agentId] = getNodeDimensions(node);
    } else if (node.type === 'skill') {
      const data = node.data as SkillNodeData;
      // Save all skill positions (relative to parent if inside agent)
      if (data.skillId > 0) {
        skillPositions[data.skillId] = { x: node.position.x, y: node.position.y };
      }
    } else if (node.type === 'database') {
      const data = node.data as DatabaseNodeData;
      // Save all database positions (relative to parent if inside agent)
      if (data.databaseId > 0) {
        databasePositions[data.databaseId] = { x: node.position.x, y: node.position.y };
      }
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

  return {
    agentPositions,
    agentExpandedStates,
    agentDimensions,
    skillPositions,
    databasePositions,
    stickyNotes,
  };
}
