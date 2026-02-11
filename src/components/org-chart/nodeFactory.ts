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
  InlineTableDisplay,
} from './types';
import { orgChartNodeSizes } from './theme';
import { makeNodeId } from './nodeId';

// =============================================================================
// Entity Input Types (data coming into the org chart from the app)
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
  tables?: InlineTableDisplay[];
}

// =============================================================================
// Node Creation Functions
// =============================================================================

/**
 * Create an agent node (compact card with inline skill/database lists)
 */
export function createAgentNode(
  agent: Agent,
  position?: XYPosition | null,
  metadata?: OrgChartCanvasMetadata,
  skills?: Skill[],
  databases?: Database[]
): OrgChartNode {
  const savedPosition = metadata?.agentPositions?.[agent.id];

  const agentSkills = skills?.filter((s) => s.agentId === agent.id) ?? [];
  const agentDatabases = databases?.filter((d) => d.agentId === agent.id) ?? [];

  return {
    id: makeNodeId('agent', agent.id),
    type: 'agent',
    position: position ?? savedPosition ?? { x: 50, y: 50 },
    // No fixed dimensions - node auto-sizes based on content
    data: {
      name: agent.name,
      agentId: agent.id,
      role: agent.role,
      status: agent.status,
      skillCount: agentSkills.length,
      databaseCount: agentDatabases.length,
      automationCount: 0,
      // Pass full skill/database arrays for inline rendering
      skills: agentSkills.map(s => ({ id: s.id, name: s.name, executionType: s.executionType })),
      databases: agentDatabases.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        tables: d.tables?.map(t => ({ id: t.id, name: t.name }))
      })),
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
      tables: db.tables?.map(t => ({ id: t.id, name: t.name })),
    } as DatabaseNodeData,
  };
}
