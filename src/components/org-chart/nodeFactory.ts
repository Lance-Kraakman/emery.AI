/**
 * Node Factory
 *
 * Functions for creating org chart nodes.
 */

import type { XYPosition } from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartCanvasMetadata,
  AgentContainerNodeData,
  SkillNodeData,
  DatabaseNodeData,
} from './types';
import { orgChartNodeSizes } from './theme';
import { makeNodeId } from './nodeId';

// =============================================================================
// Entity Types
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
  tables?: Array<{ id: number; name: string }>;
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

  let finalPosition: XYPosition;
  if (position) {
    finalPosition = position;
  } else if (savedPosition) {
    finalPosition = savedPosition;
  } else if (parentId && indexInParent !== undefined) {
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

  let finalPosition: XYPosition;
  if (position) {
    finalPosition = position;
  } else if (savedPosition) {
    finalPosition = savedPosition;
  } else if (parentId && indexInParent !== undefined) {
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
      tables: db.tables?.slice(0, 5).map(t => ({ id: t.id, name: t.name })),
    } as DatabaseNodeData,
  };
}
