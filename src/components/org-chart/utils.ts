/**
 * Org Chart Utility Functions
 *
 * Helper functions for org chart node creation and manipulation.
 */

import type { XYPosition } from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartEdgeData,
  OrgChartNodeType,
  OrgChartCanvasMetadata,
  AgentContainerNodeData,
  SkillNodeData,
  DatabaseNodeData,
  StickyNoteData,
  PersistedOrgChartStickyNote,
  PersistedOrgChartEdge,
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
  steps?: Array<{
    id: string;
    skillId?: number;
    readConfig?: { sourceTableId?: number };
    writeConfig?: { targetTableId?: number };
  }>;
}

export interface Database {
  id: number;
  name: string;
  slug: string;
  agentId?: number | null;
  tableCount?: number;
  tables?: Array<{ id: number; name: string }>;
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
 * Calculate required height for an agent container based on child counts.
 * Now supports sectioned layout with skills and databases in separate sections.
 */
export function calculateAgentContentHeight(
  skillCount: number,
  databaseCount: number
): number {
  const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;

  // Calculate skills section height
  const skillRows = Math.ceil(skillCount / 2);
  const skillSectionHeight = skillRows > 0
    ? skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
    : 0;

  // Add section gap if we have both skills and databases
  const sectionGap = (skillCount > 0 && databaseCount > 0) ? orgChartNodeSizes.sectionGap : 0;

  // Calculate databases section height
  const databaseRows = Math.ceil(databaseCount / 2);
  const databaseSectionHeight = databaseRows > 0
    ? databaseRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
    : 0;

  return contentStartY + skillSectionHeight + sectionGap + databaseSectionHeight + orgChartNodeSizes.containerPadding;
}

/**
 * Ensure a position is within the agent content area (below header).
 */
export function ensureContentAreaPosition(position: XYPosition, hasParent: boolean): XYPosition {
  if (!hasParent) return position;
  const minY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;
  return { x: Math.max(orgChartNodeSizes.containerPadding, position.x), y: Math.max(minY, position.y) };
}

// =============================================================================
// Auto-Arrange Layout Utilities
// =============================================================================

/**
 * Calculate agent container dimensions based on child counts.
 * Returns width and height that will fit children in sectioned 2-column grids.
 */
export function calculateAgentDimensions(
  skillCount: number,
  databaseCount: number
): { width: number; height: number } {
  const width = orgChartNodeSizes.containerMinWidth;
  const height = Math.max(
    orgChartNodeSizes.containerMinHeight,
    calculateAgentContentHeight(skillCount, databaseCount)
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
 * Separates skills (top) from databases (bottom) with a section gap.
 */
export function arrangeChildrenInGrid(
  nodes: OrgChartNode[],
  parentId: string
): OrgChartNode[] {
  const children = nodes.filter((n) => n.parentId === parentId);
  if (children.length === 0) return nodes;

  // Separate children by type: skills first, then databases
  const skills = children.filter((c) => c.type === 'skill');
  const databases = children.filter((c) => c.type === 'database');
  const other = children.filter((c) => c.type !== 'skill' && c.type !== 'database');

  const childIds = new Set(children.map((c) => c.id));
  const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;

  // Calculate positions for skills section
  const skillPositions = new Map<string, { x: number; y: number }>();
  skills.forEach((node, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = orgChartNodeSizes.containerPadding + col * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = contentStartY + row * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
    skillPositions.set(node.id, { x, y });
  });

  // Calculate where databases section starts
  const skillRows = Math.ceil(skills.length / 2);
  const skillSectionHeight = skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const databaseStartY = contentStartY +
    (skills.length > 0 ? skillSectionHeight + orgChartNodeSizes.sectionGap : 0);

  // Calculate positions for databases section
  const databasePositions = new Map<string, { x: number; y: number }>();
  databases.forEach((node, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = orgChartNodeSizes.containerPadding + col * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = databaseStartY + row * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
    databasePositions.set(node.id, { x, y });
  });

  // Calculate positions for other nodes (after databases)
  const databaseRows = Math.ceil(databases.length / 2);
  const databaseSectionHeight = databaseRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const otherStartY = databaseStartY +
    (databases.length > 0 ? databaseSectionHeight + orgChartNodeSizes.sectionGap : 0);

  const otherPositions = new Map<string, { x: number; y: number }>();
  other.forEach((node, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = orgChartNodeSizes.containerPadding + col * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = otherStartY + row * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
    otherPositions.set(node.id, { x, y });
  });

  return nodes.map((node) => {
    if (!childIds.has(node.id)) return node;

    const pos = skillPositions.get(node.id) ||
                databasePositions.get(node.id) ||
                otherPositions.get(node.id);

    if (pos) {
      return { ...node, position: pos };
    }
    return node;
  });
}

/**
 * Calculate section layout info for an agent container.
 * Used by AgentContainerNode to render section labels and drop zones.
 */
export function getAgentSectionLayout(
  skillCount: number,
  databaseCount: number
): {
  skillsStartY: number;
  skillsEndY: number;
  databasesStartY: number;
  databasesEndY: number;
  totalHeight: number;
} {
  const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;

  // Skills section
  const skillRows = Math.ceil(Math.max(skillCount, 1) / 2); // At least 1 row for drop zone
  const skillSectionHeight = skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const skillsStartY = contentStartY;
  const skillsEndY = contentStartY + skillSectionHeight;

  // Databases section
  const databaseStartY = skillsEndY + (skillCount > 0 ? orgChartNodeSizes.sectionGap : 0);
  const databaseRows = Math.ceil(Math.max(databaseCount, 1) / 2); // At least 1 row for drop zone
  const databaseSectionHeight = databaseRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const databasesEndY = databaseStartY + databaseSectionHeight;

  return {
    skillsStartY,
    skillsEndY,
    databasesStartY: databaseStartY,
    databasesEndY,
    totalHeight: databasesEndY + orgChartNodeSizes.containerPadding,
  };
}

/**
 * Calculate the next available grid slot position for a dropped item.
 * Used when dropping skills/databases into an agent container.
 *
 * @param entityType - 'skill' or 'database'
 * @param existingCount - Current count of items of that type in the agent
 * @returns Relative position within the agent container
 */
export function getNextGridSlotPosition(
  entityType: 'skill' | 'database',
  existingCount: number
): XYPosition {
  const { containerPadding, nodeWidth, nodeHeight, childNodeGap, containerHeaderHeight, sectionGap, sectionLabelHeight } = orgChartNodeSizes;

  // 2-column grid layout
  const col = existingCount % 2;
  const row = Math.floor(existingCount / 2);

  const x = containerPadding + col * (nodeWidth + childNodeGap);

  // Skills start after header + section label, databases start after skills section
  if (entityType === 'skill') {
    const y = containerHeaderHeight + sectionLabelHeight + row * (nodeHeight + childNodeGap);
    return { x, y };
  } else {
    // Database section starts after skills
    // Assuming at least 1 skill row for the section header
    const skillRows = 1; // Minimum row for drop zone
    const skillSectionEnd = containerHeaderHeight + sectionLabelHeight + skillRows * (nodeHeight + childNodeGap);
    const databaseSectionStart = skillSectionEnd + sectionGap + sectionLabelHeight;
    const y = databaseSectionStart + row * (nodeHeight + childNodeGap);
    return { x, y };
  }
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
    const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;
    finalPosition = {
      x: orgChartNodeSizes.containerPadding + (indexInParent % 2) * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap),
      y: contentStartY + Math.floor(indexInParent / 2) * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap),
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
    const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;
    finalPosition = {
      x: orgChartNodeSizes.containerPadding + (indexInParent % 2) * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap),
      y: contentStartY + Math.floor(indexInParent / 2) * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap),
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
      // Include first 5 tables for inline display
      tables: db.tables?.slice(0, 5).map(t => ({ id: t.id, name: t.name })),
    } as DatabaseNodeData,
  };
}

// =============================================================================
// Edge Extraction
// =============================================================================

/**
 * Extract edges from skill configurations.
 * Parses skill steps to find database reads/writes and skill references.
 */
export function extractSkillEdges(
  skills: Skill[],
  databases: Database[]
): OrgChartEdge[] {
  const edges: OrgChartEdge[] = [];

  // Build table ID -> database ID lookup
  const tableToDatabase = new Map<number, number>();
  databases.forEach((db) => {
    db.tables?.forEach((table) => {
      tableToDatabase.set(table.id, db.id);
    });
  });

  // Set to track unique edges (avoid duplicates)
  const edgeSet = new Set<string>();

  skills.forEach((skill) => {
    if (!skill.steps) return;

    skill.steps.forEach((step) => {
      // Check for skill references (skill_ref edges)
      if (step.skillId) {
        const edgeKey = `skill_ref:${skill.id}-${step.skillId}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            id: `skill-${skill.id}-ref-${step.skillId}`,
            source: makeNodeId('skill', skill.id),
            target: makeNodeId('skill', step.skillId),
            sourceHandle: 'right-source',
            targetHandle: 'left-target',
            type: 'reference',
            data: {
              edgeType: 'skill_ref',
              label: 'references',
            },
          });
        }
      }

      // Check for read config (skill_table edges)
      if (step.readConfig?.sourceTableId) {
        const dbId = tableToDatabase.get(step.readConfig.sourceTableId);
        if (dbId) {
          const edgeKey = `skill_table:${skill.id}-${dbId}:read`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              id: `skill-${skill.id}-reads-db-${dbId}`,
              source: makeNodeId('skill', skill.id),
              target: makeNodeId('database', dbId),
              sourceHandle: 'right-source',
              targetHandle: 'left-target',
              type: 'reference',
              data: {
                edgeType: 'skill_table',
                label: 'reads',
              },
            });
          }
        }
      }

      // Check for write config (skill_table edges)
      if (step.writeConfig?.targetTableId) {
        const dbId = tableToDatabase.get(step.writeConfig.targetTableId);
        if (dbId) {
          const edgeKey = `skill_table:${skill.id}-${dbId}:write`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              id: `skill-${skill.id}-writes-db-${dbId}`,
              source: makeNodeId('skill', skill.id),
              target: makeNodeId('database', dbId),
              sourceHandle: 'right-source',
              targetHandle: 'left-target',
              type: 'reference',
              data: {
                edgeType: 'skill_table',
                label: 'writes',
              },
            });
          }
        }
      }
    });
  });

  return edges;
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

  // Extract edges from skill configurations (reads/writes/references)
  const edges = extractSkillEdges(skills, databases);

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

    // Calculate container dimensions with sectioned layout
    const defaultHeight = isExpanded
      ? calculateAgentContentHeight(agentSkills.length, agentDatabases.length)
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

  // Restore saved manual edges from metadata
  if (canvasMetadata?.edges) {
    canvasMetadata.edges.forEach((savedEdge) => {
      // Check if edge already exists (from auto-generation)
      const exists = edges.some((e) => e.id === savedEdge.id);
      if (!exists) {
        edges.push({
          id: savedEdge.id,
          source: savedEdge.source,
          target: savedEdge.target,
          sourceHandle: savedEdge.sourceHandle ?? 'right-source',
          targetHandle: savedEdge.targetHandle ?? 'left-target',
          type: 'reference',
          data: {
            edgeType: savedEdge.edgeType,
            label: savedEdge.label,
          },
        });
      }
    });
  }

  return { nodes, edges };
}

// =============================================================================
// Metadata Extraction
// =============================================================================

/**
 * Extract canvas metadata from current nodes and edges for persistence
 */
export function extractMetadataFromNodes(
  nodes: OrgChartNode[],
  edges?: OrgChartEdge[]
): OrgChartCanvasMetadata {
  const agentPositions: Record<number, { x: number; y: number }> = {};
  const agentExpandedStates: Record<number, boolean> = {};
  const agentDimensions: Record<number, { width: number; height: number }> = {};
  const skillPositions: Record<number, { x: number; y: number }> = {};
  const databasePositions: Record<number, { x: number; y: number }> = {};
  const stickyNotes: PersistedOrgChartStickyNote[] = [];
  const persistedEdges: PersistedOrgChartEdge[] = [];

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

  // Extract manual edges for persistence (only reference edges, not auto-generated)
  if (edges) {
    edges.forEach((edge) => {
      // Only persist edges that start with 'edge-' (manually created)
      // Auto-generated edges have IDs like 'skill-123-ref-456'
      if (edge.id.startsWith('edge-')) {
        const edgeData = edge.data as OrgChartEdgeData | undefined;
        if (edgeData?.edgeType && edgeData.edgeType !== 'containment') {
          persistedEdges.push({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            edgeType: edgeData.edgeType,
            label: edgeData.label,
          });
        }
      }
    });
  }

  return {
    agentPositions,
    agentExpandedStates,
    agentDimensions,
    skillPositions,
    databasePositions,
    stickyNotes,
    edges: persistedEdges.length > 0 ? persistedEdges : undefined,
  };
}
