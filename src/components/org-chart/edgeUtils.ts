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

export type EdgeType = 'skill_ref' | 'skill_table' | 'data_source';
export type HandleSide = 'left' | 'right';

export interface NormalizedConnection {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  edgeType: EdgeType;
  label: string;
  /** Table ID when connecting to a specific table */
  tableId?: number;
}

// =============================================================================
// Edge Connection Utilities
// =============================================================================

/**
 * Normalize an edge connection so skill is always the source.
 * Returns null if the connection type is not supported.
 *
 * @param targetHandle - Optional handle ID (e.g., "table-123" for table connections)
 */
export function normalizeEdgeConnection(
  sourceId: string,
  targetId: string,
  sourceType: string,
  targetType: string,
  sourceSide: HandleSide,
  targetSide: HandleSide,
  targetHandle?: string | null
): NormalizedConnection | null {
  // Parse table ID from handle if present (e.g., "table-123")
  const parseTableId = (handle?: string | null): number | undefined => {
    if (!handle?.startsWith('table-')) return undefined;
    const id = parseInt(handle.split('-')[1], 10);
    return isNaN(id) ? undefined : id;
  };

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

  // skill → database (or skill → table)
  if (sourceType === 'skill' && targetType === 'database') {
    const tableId = parseTableId(targetHandle);
    return {
      source: sourceId,
      target: targetId,
      sourceHandle: `${sourceSide}-source`,
      targetHandle: targetHandle || `${targetSide}-target`,
      edgeType: 'skill_table',
      label: tableId ? 'uses table' : 'uses',
      tableId,
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
 *
 * @param tableId - Optional table ID for table-level targeting (uses table-{id} handle)
 */
export function createSkillEdge(
  id: string,
  skillId: number,
  targetType: 'skill' | 'database',
  targetId: number,
  edgeType: EdgeType,
  label: string,
  tableId?: number
): OrgChartEdge {
  return {
    id,
    source: makeNodeId('skill', skillId),
    target: makeNodeId(targetType, targetId),
    sourceHandle: 'right-source',
    targetHandle: tableId ? `table-${tableId}` : 'left-target',
    type: 'reference',
    data: { edgeType, label, tableId },
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
  /** Skill-level input mappings (reads FROM tables) */
  inputs?: Array<{
    name: string;
    inputMapping?: { source?: { tableId?: number } };
  }>;
  /** Skill-level output mappings (writes TO tables) */
  outputs?: Array<{
    name: string;
    outputMapping?: { tableMappings?: Array<{ targetTableId: number }> };
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
        const tableId = step.readConfig.sourceTableId;
        const dbId = tableToDatabase.get(tableId);
        if (dbId) {
          addEdge(
            `read:${skill.id}-${tableId}`,
            createSkillEdge(
              `skill-${skill.id}-reads-table-${tableId}`,
              skill.id,
              'database',
              dbId,
              'skill_table',
              'reads',
              tableId
            )
          );
        }
      }

      // Skill writes to a table
      if (step.writeConfig?.targetTableId) {
        const tableId = step.writeConfig.targetTableId;
        const dbId = tableToDatabase.get(tableId);
        if (dbId) {
          addEdge(
            `write:${skill.id}-${tableId}`,
            createSkillEdge(
              `skill-${skill.id}-writes-table-${tableId}`,
              skill.id,
              'database',
              dbId,
              'skill_table',
              'writes',
              tableId
            )
          );
        }
      }
    });

    // Skill-level INPUT mappings (reads FROM tables)
    // These are more important than step-level readConfig
    skill.inputs?.forEach((input) => {
      const tableId = input.inputMapping?.source?.tableId;
      if (tableId) {
        const dbId = tableToDatabase.get(tableId);
        if (dbId) {
          addEdge(
            `input:${skill.id}-${tableId}`,
            createSkillEdge(
              `skill-${skill.id}-input-${tableId}`,
              skill.id,
              'database',
              dbId,
              'skill_table',
              'reads',
              tableId
            )
          );
        }
      }
    });

    // Skill-level OUTPUT mappings (writes TO tables)
    // These are more important than step-level writeConfig
    skill.outputs?.forEach((output) => {
      output.outputMapping?.tableMappings?.forEach((tableMapping) => {
        const tableId = tableMapping.targetTableId;
        const dbId = tableToDatabase.get(tableId);
        if (dbId) {
          addEdge(
            `output:${skill.id}-${tableId}`,
            createSkillEdge(
              `skill-${skill.id}-output-${tableId}`,
              skill.id,
              'database',
              dbId,
              'skill_table',
              'writes',
              tableId
            )
          );
        }
      });
    });
  });

  return edges;
}

// =============================================================================
// Data Source Edge Extraction
// =============================================================================

/**
 * Data source mapping from context_mappings table
 */
export interface DataSourceMapping {
  id: number;
  targetType: 'agent' | 'skill' | 'skill_step';
  targetId: string;
  tableId: number;
  tableName: string;
  accessMode: 'read' | 'write' | 'readwrite';
}

/**
 * Create an edge for data source connections.
 * Source is agent or skill, target is database with specific table handle.
 */
export function createDataSourceEdge(
  sourceType: 'agent' | 'skill',
  sourceId: number,
  databaseId: number,
  tableId: number,
  accessMode: string
): OrgChartEdge {
  return {
    id: `${sourceType}-${sourceId}-datasource-${tableId}`,
    source: makeNodeId(sourceType, sourceId),
    target: makeNodeId('database', databaseId),
    sourceHandle: 'right-source',
    targetHandle: `table-${tableId}`,
    type: 'reference',
    data: {
      edgeType: 'data_source',
      label: accessMode,
      tableId,
    },
  };
}

/**
 * Extract edges from data source mappings (context_mappings).
 * Creates green dashed edges from agents/skills to database tables.
 */
export function extractDataSourceEdges(
  dataSources: DataSourceMapping[],
  databases: DatabaseWithTables[]
): OrgChartEdge[] {
  const edges: OrgChartEdge[] = [];
  const tableToDatabase = buildTableToDatabaseMap(databases);
  const seen = new Set<string>();

  dataSources.forEach((ds) => {
    // Only handle agent and skill level mappings (not skill_step for now)
    if (ds.targetType !== 'agent' && ds.targetType !== 'skill') {
      return;
    }

    const dbId = tableToDatabase.get(ds.tableId);
    if (!dbId) return;

    const sourceType = ds.targetType as 'agent' | 'skill';
    const sourceId = parseInt(ds.targetId, 10);
    if (isNaN(sourceId)) return;

    const key = `datasource:${sourceType}-${sourceId}-${ds.tableId}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push(createDataSourceEdge(sourceType, sourceId, dbId, ds.tableId, ds.accessMode));
    }
  });

  return edges;
}
