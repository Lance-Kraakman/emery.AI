/**
 * Layout Utilities
 *
 * Functions for calculating node positions and container dimensions.
 */

import type { XYPosition } from '@xyflow/react';
import type { OrgChartNode, OrgChartEdge, OrgChartEdgeData, AgentContainerNodeData } from './types';
import { orgChartNodeSizes } from './theme';

// =============================================================================
// Layout Constants
// =============================================================================

export const LAYOUT_PADDING = 50;
export const LAYOUT_GAP = 20;
export const COLUMNS = 4;

// =============================================================================
// Grid Position Utilities
// =============================================================================

/**
 * Calculate grid position for an item at a given index.
 * Used for laying out org-level nodes in a grid.
 */
export function calculateGridPosition(
  index: number,
  startY: number,
  itemWidth: number,
  itemHeight: number,
  columns = COLUMNS
): XYPosition {
  return {
    x: LAYOUT_PADDING + (index % columns) * (itemWidth + LAYOUT_GAP),
    y: startY + Math.floor(index / columns) * (itemHeight + LAYOUT_GAP),
  };
}

/**
 * Calculate the next available grid slot position for a dropped item.
 * Used when dropping skills/databases into an agent container.
 */
export function getNextGridSlotPosition(
  entityType: 'skill' | 'database',
  existingCount: number
): XYPosition {
  const { containerPadding, nodeWidth, nodeHeight, childNodeGap, containerHeaderHeight, sectionGap, sectionLabelHeight } = orgChartNodeSizes;

  if (entityType === 'skill') {
    // Skills: single vertical column
    const x = containerPadding;
    const y = containerHeaderHeight + sectionLabelHeight + existingCount * (nodeHeight + childNodeGap);
    return { x, y };
  } else {
    // Databases: single horizontal row
    const skillRows = 1;
    const skillSectionEnd = containerHeaderHeight + sectionLabelHeight + skillRows * (nodeHeight + childNodeGap);
    const databaseSectionStart = skillSectionEnd + sectionGap + sectionLabelHeight;
    const x = containerPadding + existingCount * (nodeWidth + childNodeGap);
    const y = databaseSectionStart;
    return { x, y };
  }
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
// Node Dimension Utilities
// =============================================================================

/**
 * Get actual node dimensions from React Flow node.
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
 */
export function calculateAgentContentHeight(
  skillCount: number,
  databaseCount: number
): number {
  const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;

  // Skills: 1 column = 1 row per skill
  const skillRows = skillCount;
  const skillSectionHeight = skillRows > 0
    ? skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
    : 0;

  const sectionGap = (skillCount > 0 && databaseCount > 0) ? orgChartNodeSizes.sectionGap : 0;

  // Databases: always 1 horizontal row
  const databaseRows = databaseCount > 0 ? 1 : 0;
  const databaseSectionHeight = databaseRows > 0
    ? databaseRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
    : 0;

  return contentStartY + skillSectionHeight + sectionGap + databaseSectionHeight + orgChartNodeSizes.containerPadding;
}

/**
 * Calculate agent container dimensions based on child counts.
 */
export function calculateAgentDimensions(
  skillCount: number,
  databaseCount: number
): { width: number; height: number } {
  // Width must accommodate horizontal database row
  const dbRowWidth = databaseCount > 0
    ? orgChartNodeSizes.containerPadding * 2 + databaseCount * orgChartNodeSizes.nodeWidth + (databaseCount - 1) * orgChartNodeSizes.childNodeGap
    : 0;
  const width = Math.max(orgChartNodeSizes.containerMinWidth, dbRowWidth);
  const height = Math.max(
    orgChartNodeSizes.containerMinHeight,
    calculateAgentContentHeight(skillCount, databaseCount)
  );
  return { width, height };
}

/**
 * Calculate section layout info for an agent container.
 */
/** Compact height for empty placeholder dropzones */
const COMPACT_PLACEHOLDER_HEIGHT = 28;

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

  // Use compact height for empty placeholder, full height for actual items
  const skillRowHeight = skillCount === 0 ? COMPACT_PLACEHOLDER_HEIGHT : orgChartNodeSizes.nodeHeight;
  // Skills: 1 column = 1 row per skill
  const skillRows = Math.max(skillCount, 1);
  const skillSectionHeight = skillRows * (skillRowHeight + orgChartNodeSizes.childNodeGap);
  const skillsStartY = contentStartY;
  const skillsEndY = contentStartY + skillSectionHeight;

  // Reduced gap when sections are empty
  const sectionGap = (skillCount > 0 || databaseCount > 0) ? orgChartNodeSizes.sectionGap : 8;
  const databaseStartY = skillsEndY + sectionGap;

  const databaseRowHeight = databaseCount === 0 ? COMPACT_PLACEHOLDER_HEIGHT : orgChartNodeSizes.nodeHeight;
  // Databases: always 1 horizontal row
  const databaseRows = 1;
  const databaseSectionHeight = databaseRows * (databaseRowHeight + orgChartNodeSizes.childNodeGap);
  const databasesEndY = databaseStartY + databaseSectionHeight;

  return {
    skillsStartY,
    skillsEndY,
    databasesStartY: databaseStartY,
    databasesEndY,
    totalHeight: databasesEndY + orgChartNodeSizes.containerPadding,
  };
}

// =============================================================================
// Auto-Arrange Layout Utilities
// =============================================================================

/**
 * Arrange a list of node IDs horizontally in a row.
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
 */
export function arrangeChildrenInGrid(
  nodes: OrgChartNode[],
  parentId: string
): OrgChartNode[] {
  const children = nodes.filter((n) => n.parentId === parentId);
  if (children.length === 0) return nodes;

  const skills = children.filter((c) => c.type === 'skill');
  const databases = children.filter((c) => c.type === 'database');
  const other = children.filter((c) => c.type !== 'skill' && c.type !== 'database');

  const childIds = new Set(children.map((c) => c.id));
  const contentStartY = orgChartNodeSizes.containerHeaderHeight + orgChartNodeSizes.containerPadding;

  // Skills: single vertical column
  const skillPositions = new Map<string, { x: number; y: number }>();
  skills.forEach((node, index) => {
    const x = orgChartNodeSizes.containerPadding;
    const y = contentStartY + index * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
    skillPositions.set(node.id, { x, y });
  });

  const skillRows = skills.length;
  const skillSectionHeight = skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const databaseStartY = contentStartY +
    (skills.length > 0 ? skillSectionHeight + orgChartNodeSizes.sectionGap : 0);

  // Databases: single horizontal row
  const databasePositions = new Map<string, { x: number; y: number }>();
  databases.forEach((node, index) => {
    const x = orgChartNodeSizes.containerPadding + index * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = databaseStartY;
    databasePositions.set(node.id, { x, y });
  });

  const databaseRows = databases.length > 0 ? 1 : 0;
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

// =============================================================================
// Top-Down Org Chart Layout
// =============================================================================

/**
 * Compute which agent each org-level database is most connected to.
 * Returns a map of databaseNodeId → agentNodeId.
 */
function computeDatabaseAffinity(
  nodes: OrgChartNode[],
  edges: OrgChartEdge[]
): Map<string, string> {
  // Build skill → parent agent lookup
  const skillToAgent = new Map<string, string>();
  for (const node of nodes) {
    if (node.type === 'skill' && node.parentId) {
      skillToAgent.set(node.id, node.parentId);
    }
  }

  // Count edges from each agent to each database
  // affinityCounts: dbNodeId → Map<agentNodeId, count>
  const affinityCounts = new Map<string, Map<string, number>>();

  for (const edge of edges) {
    const edgeType = (edge.data as OrgChartEdgeData | undefined)?.edgeType;
    if (edgeType !== 'skill_table' && edgeType !== 'data_source') continue;

    // Determine which agent this edge originates from
    let agentId: string | undefined;
    if (skillToAgent.has(edge.source)) {
      agentId = skillToAgent.get(edge.source);
    } else {
      // Source might be an agent directly (data_source edges)
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode?.type === 'agent') {
        agentId = sourceNode.id;
      }
    }
    if (!agentId) continue;

    // Target should be a database
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!targetNode || targetNode.type !== 'database' || targetNode.parentId) continue;

    if (!affinityCounts.has(edge.target)) {
      affinityCounts.set(edge.target, new Map());
    }
    const counts = affinityCounts.get(edge.target)!;
    counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
  }

  // Pick the agent with the highest count for each database
  const result = new Map<string, string>();
  for (const [dbId, counts] of affinityCounts) {
    let bestAgent = '';
    let bestCount = 0;
    for (const [agentId, count] of counts) {
      if (count > bestCount) {
        bestAgent = agentId;
        bestCount = count;
      }
    }
    if (bestAgent) {
      result.set(dbId, bestAgent);
    }
  }

  return result;
}

/**
 * Arrange the org chart in a left-to-right layout:
 *   Column 1 (left): Org-level skills
 *   Column 2-N (middle): Agent cards in a grid
 *   Column N+1 (right): Org-level databases
 *
 * This creates a cleaner flow: skills → agents → databases
 */
export function arrangeOrgChartLTR(
  nodes: OrgChartNode[],
  edges: OrgChartEdge[]
): OrgChartNode[] {
  const PADDING = 50;
  const HORIZONTAL_GAP = 80; // Gap between columns
  const VERTICAL_GAP = 30;   // Gap between rows within a column
  const AGENT_WIDTH = 220;   // Estimated width for compact agent cards
  const NODE_WIDTH = 160;    // Width for skill/database nodes
  const NODE_HEIGHT = 80;    // Estimated height
  const MAX_AGENTS_PER_COLUMN = 4; // Max agents in a row before wrapping

  let result = [...nodes];

  // --- Classify nodes ---
  const orgSkills = result.filter((n) => n.type === 'skill' && !n.parentId);
  const agents = result.filter((n) => n.type === 'agent');
  const orgDatabases = result.filter((n) => n.type === 'database' && !n.parentId);

  // --- Column 1: Org-level skills (left side) ---
  const skillColumnX = PADDING;
  let currentY = PADDING;

  const skillPositions = new Map<string, { x: number; y: number }>();
  orgSkills.forEach((skill, index) => {
    skillPositions.set(skill.id, { x: skillColumnX, y: currentY + index * (NODE_HEIGHT + VERTICAL_GAP) });
  });

  // Calculate width of skill column
  const skillColumnWidth = orgSkills.length > 0 ? NODE_WIDTH + HORIZONTAL_GAP : 0;

  // --- Column 2-N: Agents in a grid ---
  const agentColumnStartX = PADDING + skillColumnWidth;
  currentY = PADDING;

  const agentPositions = new Map<string, { x: number; y: number }>();
  agents.forEach((agent, index) => {
    const row = index % MAX_AGENTS_PER_COLUMN;
    const col = Math.floor(index / MAX_AGENTS_PER_COLUMN);
    const x = agentColumnStartX + col * (AGENT_WIDTH + HORIZONTAL_GAP);
    const y = PADDING + row * (NODE_HEIGHT * 2 + VERTICAL_GAP); // Agents are taller
    agentPositions.set(agent.id, { x, y });
  });

  // Calculate total width of agent columns
  const agentColumns = Math.ceil(agents.length / MAX_AGENTS_PER_COLUMN);
  const agentColumnsWidth = agentColumns > 0 ? agentColumns * (AGENT_WIDTH + HORIZONTAL_GAP) : 0;

  // --- Column N+1: Org-level databases (right side) ---
  const databaseColumnX = agentColumnStartX + agentColumnsWidth;
  currentY = PADDING;

  const databasePositions = new Map<string, { x: number; y: number }>();
  orgDatabases.forEach((db, index) => {
    databasePositions.set(db.id, { x: databaseColumnX, y: currentY + index * (NODE_HEIGHT + VERTICAL_GAP) });
  });

  // --- Apply positions to all nodes ---
  result = result.map((node) => {
    const skillPos = skillPositions.get(node.id);
    if (skillPos) {
      return { ...node, position: skillPos };
    }

    const agentPos = agentPositions.get(node.id);
    if (agentPos) {
      return { ...node, position: agentPos };
    }

    const dbPos = databasePositions.get(node.id);
    if (dbPos) {
      return { ...node, position: dbPos };
    }

    return node;
  });

  return result;
}

/**
 * Arrange the org chart in a top-down tiered layout:
 *   Tier 1 (top): Org-level skills
 *   Tier 2 (middle): Agent containers side-by-side
 *   Tier 3 (bottom): Databases aligned under their most-connected agent
 *
 * @deprecated Use arrangeOrgChartLTR instead for cleaner left-to-right flow
 */
export function arrangeOrgChartTopDown(
  nodes: OrgChartNode[],
  edges: OrgChartEdge[]
): OrgChartNode[] {
  const PADDING = 50;
  const GAP = 40;
  const TIER_GAP = 60;
  const MAX_ROW_WIDTH = 3000;

  let result = [...nodes];
  let cursorY = PADDING;

  // --- Classify nodes ---
  const orgSkillIds = new Set(
    result.filter((n) => n.type === 'skill' && !n.parentId).map((n) => n.id)
  );
  const agentIds = result.filter((n) => n.type === 'agent').map((n) => n.id);
  const orgDatabaseIds = new Set(
    result.filter((n) => n.type === 'database' && !n.parentId).map((n) => n.id)
  );

  // --- Compute affinity ---
  const dbAffinity = computeDatabaseAffinity(result, edges);

  // --- Resize agents to fit children ---
  result = result.map((node) => {
    if (node.type !== 'agent') return node;
    const data = node.data as AgentContainerNodeData;
    const { width, height } = calculateAgentDimensions(
      data.skillCount ?? 0,
      data.databaseCount ?? 0
    );
    return { ...node, style: { ...node.style, width, height } };
  });

  // --- Tier 1: Org-level skills ---
  if (orgSkillIds.size > 0) {
    const rowResult = arrangeNodesInRow(
      result, orgSkillIds, PADDING, cursorY, GAP, orgChartNodeSizes.nodeWidth
    );
    result = rowResult.updatedNodes;
    cursorY += Math.max(rowResult.rowHeight, orgChartNodeSizes.nodeHeight) + GAP;
  }

  // --- Tier 2: Agents side-by-side ---
  result = arrangeAgentsInRows(result, agentIds, PADDING, cursorY, GAP, MAX_ROW_WIDTH);

  // Track each agent's positioned layout for database alignment
  const agentLayout = new Map<string, { x: number; y: number; width: number; height: number }>();
  let agentTierBottom = cursorY;
  for (const node of result) {
    if (node.type !== 'agent') continue;
    const dims = getNodeDimensions(node);
    agentLayout.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      width: dims.width,
      height: dims.height,
    });
    agentTierBottom = Math.max(agentTierBottom, node.position.y + dims.height);
  }

  // Arrange children inside each agent
  for (const agentId of agentIds) {
    result = arrangeChildrenInGrid(result, agentId);
  }

  // --- Tier 3: Databases aligned under affiliated agents ---
  const dbTierY = agentTierBottom + TIER_GAP;

  // Group databases by affiliated agent
  const agentDatabases = new Map<string, string[]>(); // agentNodeId → [dbNodeId]
  const unaffiliated: string[] = [];

  for (const dbId of orgDatabaseIds) {
    const agentId = dbAffinity.get(dbId);
    if (agentId && agentLayout.has(agentId)) {
      if (!agentDatabases.has(agentId)) {
        agentDatabases.set(agentId, []);
      }
      agentDatabases.get(agentId)!.push(dbId);
    } else {
      unaffiliated.push(dbId);
    }
  }

  // Position map for all databases
  const dbPositions = new Map<string, XYPosition>();

  // Place affiliated databases under their agent
  // Sort agents left-to-right by X position
  const sortedAgents = [...agentLayout.entries()]
    .sort((a, b) => a[1].x - b[1].x);

  for (const [agentId, layout] of sortedAgents) {
    const dbIds = agentDatabases.get(agentId);
    if (!dbIds || dbIds.length === 0) continue;

    // Place affiliated databases side-by-side under the agent
    let dbCursorX = layout.x;
    for (const dbId of dbIds) {
      dbPositions.set(dbId, { x: dbCursorX, y: dbTierY });
      const dbNode = result.find((n) => n.id === dbId);
      const dbWidth = dbNode ? getNodeDimensions(dbNode).width : orgChartNodeSizes.nodeWidth;
      dbCursorX += dbWidth + GAP;
    }
  }

  // Place unaffiliated databases side-by-side after the rightmost agent column
  if (unaffiliated.length > 0) {
    const rightmostX = sortedAgents.length > 0
      ? sortedAgents[sortedAgents.length - 1][1].x + sortedAgents[sortedAgents.length - 1][1].width + GAP
      : PADDING;

    let dbCursorX = rightmostX;
    for (const dbId of unaffiliated) {
      dbPositions.set(dbId, { x: dbCursorX, y: dbTierY });
      const dbNode = result.find((n) => n.id === dbId);
      const dbWidth = dbNode ? getNodeDimensions(dbNode).width : orgChartNodeSizes.nodeWidth;
      dbCursorX += dbWidth + GAP;
    }
  }

  // Apply database positions
  result = result.map((node) => {
    const pos = dbPositions.get(node.id);
    if (pos) {
      return { ...node, position: pos };
    }
    return node;
  });

  return result;
}
