/**
 * Layout Utilities
 *
 * Functions for calculating node positions and container dimensions.
 */

import type { XYPosition } from '@xyflow/react';
import type { OrgChartNode } from './types';
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

  const col = existingCount % 2;
  const row = Math.floor(existingCount / 2);
  const x = containerPadding + col * (nodeWidth + childNodeGap);

  if (entityType === 'skill') {
    const y = containerHeaderHeight + sectionLabelHeight + row * (nodeHeight + childNodeGap);
    return { x, y };
  } else {
    const skillRows = 1;
    const skillSectionEnd = containerHeaderHeight + sectionLabelHeight + skillRows * (nodeHeight + childNodeGap);
    const databaseSectionStart = skillSectionEnd + sectionGap + sectionLabelHeight;
    const y = databaseSectionStart + row * (nodeHeight + childNodeGap);
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

  const skillRows = Math.ceil(skillCount / 2);
  const skillSectionHeight = skillRows > 0
    ? skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap)
    : 0;

  const sectionGap = (skillCount > 0 && databaseCount > 0) ? orgChartNodeSizes.sectionGap : 0;

  const databaseRows = Math.ceil(databaseCount / 2);
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
  const width = orgChartNodeSizes.containerMinWidth;
  const height = Math.max(
    orgChartNodeSizes.containerMinHeight,
    calculateAgentContentHeight(skillCount, databaseCount)
  );
  return { width, height };
}

/**
 * Calculate section layout info for an agent container.
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

  const skillRows = Math.ceil(Math.max(skillCount, 1) / 2);
  const skillSectionHeight = skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const skillsStartY = contentStartY;
  const skillsEndY = contentStartY + skillSectionHeight;

  const databaseStartY = skillsEndY + (skillCount > 0 ? orgChartNodeSizes.sectionGap : 0);
  const databaseRows = Math.ceil(Math.max(databaseCount, 1) / 2);
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

  const skillPositions = new Map<string, { x: number; y: number }>();
  skills.forEach((node, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = orgChartNodeSizes.containerPadding + col * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = contentStartY + row * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
    skillPositions.set(node.id, { x, y });
  });

  const skillRows = Math.ceil(skills.length / 2);
  const skillSectionHeight = skillRows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
  const databaseStartY = contentStartY +
    (skills.length > 0 ? skillSectionHeight + orgChartNodeSizes.sectionGap : 0);

  const databasePositions = new Map<string, { x: number; y: number }>();
  databases.forEach((node, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = orgChartNodeSizes.containerPadding + col * (orgChartNodeSizes.nodeWidth + orgChartNodeSizes.childNodeGap);
    const y = databaseStartY + row * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);
    databasePositions.set(node.id, { x, y });
  });

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
