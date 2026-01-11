/**
 * Edge Utilities
 *
 * Functions for creating and normalizing org chart edges.
 */

import type { OrgChartEdge } from './types';
import { makeNodeId } from './nodeId';

// =============================================================================
// Types
// =============================================================================

export type EdgeType = 'skill_ref' | 'skill_table';
export type HandleSide = 'left' | 'right';

export interface NormalizedConnection {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  edgeType: EdgeType;
  label: string;
}

// =============================================================================
// Edge Connection Utilities
// =============================================================================

/**
 * Normalize an edge connection so skill is always the source.
 * Returns null if the connection type is not supported.
 */
export function normalizeEdgeConnection(
  sourceId: string,
  targetId: string,
  sourceType: string,
  targetType: string,
  sourceSide: HandleSide,
  targetSide: HandleSide
): NormalizedConnection | null {
  // skill → skill
  if (sourceType === 'skill' && targetType === 'skill') {
    return {
      source: sourceId,
      target: targetId,
      sourceHandle: `${sourceSide}-source`,
      targetHandle: `${targetSide}-target`,
      edgeType: 'skill_ref',
      label: 'references',
    };
  }

  // skill → database
  if (sourceType === 'skill' && targetType === 'database') {
    return {
      source: sourceId,
      target: targetId,
      sourceHandle: `${sourceSide}-source`,
      targetHandle: `${targetSide}-target`,
      edgeType: 'skill_table',
      label: 'uses',
    };
  }

  // database → skill (swap to skill → database)
  if (sourceType === 'database' && targetType === 'skill') {
    return {
      source: targetId,
      target: sourceId,
      sourceHandle: `${targetSide}-source`,
      targetHandle: `${sourceSide}-target`,
      edgeType: 'skill_table',
      label: 'uses',
    };
  }

  return null;
}

/**
 * Create an edge object for skill connections.
 */
export function createSkillEdge(
  id: string,
  skillId: number,
  targetType: 'skill' | 'database',
  targetId: number,
  edgeType: EdgeType,
  label: string
): OrgChartEdge {
  return {
    id,
    source: makeNodeId('skill', skillId),
    target: makeNodeId(targetType, targetId),
    sourceHandle: 'right-source',
    targetHandle: 'left-target',
    type: 'reference',
    data: { edgeType, label },
  };
}

// =============================================================================
// Edge Extraction from Skills
// =============================================================================

export interface SkillWithSteps {
  id: number;
  steps?: Array<{
    id: string;
    skillId?: number;
    readConfig?: { sourceTableId?: number };
    writeConfig?: { targetTableId?: number };
  }>;
}

export interface DatabaseWithTables {
  id: number;
  tables?: Array<{ id: number }>;
}

/**
 * Build a lookup map from table ID to database ID.
 */
export function buildTableToDatabaseMap(databases: DatabaseWithTables[]): Map<number, number> {
  const map = new Map<number, number>();
  databases.forEach((db) => {
    db.tables?.forEach((table) => map.set(table.id, db.id));
  });
  return map;
}

/**
 * Extract edges from skill configurations.
 * Parses skill steps to find database reads/writes and skill references.
 */
export function extractSkillEdges(
  skills: SkillWithSteps[],
  databases: DatabaseWithTables[]
): OrgChartEdge[] {
  const edges: OrgChartEdge[] = [];
  const tableToDatabase = buildTableToDatabaseMap(databases);
  const seen = new Set<string>();

  const addEdge = (key: string, edge: OrgChartEdge) => {
    if (!seen.has(key)) {
      seen.add(key);
      edges.push(edge);
    }
  };

  skills.forEach((skill) => {
    skill.steps?.forEach((step) => {
      // Skill references another skill
      if (step.skillId) {
        addEdge(
          `ref:${skill.id}-${step.skillId}`,
          createSkillEdge(`skill-${skill.id}-ref-${step.skillId}`, skill.id, 'skill', step.skillId, 'skill_ref', 'references')
        );
      }

      // Skill reads from a table
      if (step.readConfig?.sourceTableId) {
        const dbId = tableToDatabase.get(step.readConfig.sourceTableId);
        if (dbId) {
          addEdge(
            `read:${skill.id}-${dbId}`,
            createSkillEdge(`skill-${skill.id}-reads-db-${dbId}`, skill.id, 'database', dbId, 'skill_table', 'reads')
          );
        }
      }

      // Skill writes to a table
      if (step.writeConfig?.targetTableId) {
        const dbId = tableToDatabase.get(step.writeConfig.targetTableId);
        if (dbId) {
          addEdge(
            `write:${skill.id}-${dbId}`,
            createSkillEdge(`skill-${skill.id}-writes-db-${dbId}`, skill.id, 'database', dbId, 'skill_table', 'writes')
          );
        }
      }
    });
  });

  return edges;
}
