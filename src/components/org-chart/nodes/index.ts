/**
 * Org Chart Nodes Index
 *
 * Export all org chart node components.
 */

export { BaseOrgChartNode, IconBadge } from './BaseOrgChartNode';
export { AgentContainerNode } from './AgentContainerNode';
export { SkillNode } from './SkillNode';
export { DatabaseNode } from './DatabaseNode';
export { OrgResourcesNode } from './OrgResourcesNode';

// Re-export StickyNode from workflow-canvas (same component)
export { StickyNode } from '@/components/workflow-canvas/nodes/StickyNode';

/**
 * Node types map for React Flow
 */
import { AgentContainerNode } from './AgentContainerNode';
import { SkillNode } from './SkillNode';
import { DatabaseNode } from './DatabaseNode';
import { OrgResourcesNode } from './OrgResourcesNode';
import { StickyNode } from '@/components/workflow-canvas/nodes/StickyNode';

export const orgChartNodeTypes = {
  agent: AgentContainerNode,
  skill: SkillNode,
  database: DatabaseNode,
  org_resources: OrgResourcesNode,
  sticky: StickyNode,
} as const;
