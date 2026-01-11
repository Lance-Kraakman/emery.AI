/**
 * Node ID Utilities
 *
 * Functions for creating and parsing org chart node IDs.
 */

import type { OrgChartNodeType } from './types';

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

/**
 * Check if an agentId represents org-level (null/undefined)
 */
export function isOrgLevel(agentId: number | null | undefined): boolean {
  return agentId === null || agentId === undefined;
}
