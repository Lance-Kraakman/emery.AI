/**
 * Org Chart Utility Functions
 *
 * Barrel export for all org chart utilities.
 * Also contains the main buildOrgChartFromData orchestration function.
 */

import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartEdgeData,
  OrgChartCanvasMetadata,
  AgentContainerNodeData,
  SkillNodeData,
  DatabaseNodeData,
  StickyNoteData,
  PersistedOrgChartStickyNote,
  PersistedOrgChartEdge,
} from './types';
import { orgChartNodeSizes } from './theme';

// Re-export all utilities from modules
export * from './nodeId';
export * from './layout';
export * from './edgeUtils';
export * from './nodeFactory';

// Import from modules for internal use
import { calculateGridPosition, getNodeDimensions, LAYOUT_PADDING, LAYOUT_GAP, COLUMNS } from './layout';
import { extractSkillEdges } from './edgeUtils';
import { createAgentNode, createSkillNode, createDatabaseNode, type Agent, type Skill, type Database } from './nodeFactory';

// Re-export entity types for backwards compatibility
export type { Agent, Skill, Database };

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
    const defaultPos = calculateGridPosition(index, LAYOUT_PADDING, orgChartNodeSizes.nodeWidth, orgChartNodeSizes.nodeHeight);
    nodes.push(createSkillNode(skill, skillPositions[skill.id] ?? defaultPos, canvasMetadata));
  });

  // Add org-level databases
  const skillRows = Math.ceil(orgSkills.length / COLUMNS);
  const dbStartY = LAYOUT_PADDING + skillRows * (orgChartNodeSizes.nodeHeight + LAYOUT_GAP) + (skillRows > 0 ? LAYOUT_GAP : 0);
  orgDatabases.forEach((db, index) => {
    const defaultPos = calculateGridPosition(index, dbStartY, orgChartNodeSizes.nodeWidth, orgChartNodeSizes.nodeHeight);
    nodes.push(createDatabaseNode(db, databasePositions[db.id] ?? defaultPos, canvasMetadata));
  });

  // Calculate starting Y for agents (below org resources)
  const dbRows = Math.ceil(orgDatabases.length / COLUMNS);
  const totalOrgRows = skillRows + dbRows;
  const agentStartY = LAYOUT_PADDING + totalOrgRows * (orgChartNodeSizes.nodeHeight + LAYOUT_GAP) + (totalOrgRows > 0 ? LAYOUT_GAP * 2 : 0);

  // Create agent nodes (compact cards with inline skill/database lists)
  agents.forEach((agent, agentIndex) => {
    const defaultPos = calculateGridPosition(
      agentIndex,
      agentStartY,
      orgChartNodeSizes.containerMinWidth,
      orgChartNodeSizes.containerMinHeight,
      3 // agents in 3-column grid for better horizontal layout
    );

    // Agent node now contains skills/databases as inline lists (no separate child nodes)
    nodes.push(createAgentNode(
      agent,
      agentPositions[agent.id] ?? defaultPos,
      canvasMetadata,
      skills,
      databases
    ));
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
            tableId: savedEdge.tableId,
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
      // No longer tracking expanded states - agents always show content inline
      agentDimensions[data.agentId] = getNodeDimensions(node);
    } else if (node.type === 'skill') {
      const data = node.data as SkillNodeData;
      if (data.skillId > 0) {
        skillPositions[data.skillId] = { x: node.position.x, y: node.position.y };
      }
    } else if (node.type === 'database') {
      const data = node.data as DatabaseNodeData;
      if (data.databaseId > 0) {
        databasePositions[data.databaseId] = { x: node.position.x, y: node.position.y };
      }
    } else if (node.type === 'sticky') {
      const data = node.data as StickyNoteData;
      stickyNotes.push({
        id: node.id,
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
            tableId: edgeData.tableId,
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
