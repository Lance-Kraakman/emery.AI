/**
 * useOrgChartExport Hook
 *
 * Handles exporting selected org chart entities as a BrainTemplate.
 * Supports exporting agents (with their skills/databases), skills, and databases.
 */

import { useCallback, useMemo } from 'react';
import type { OrgChartNode, OrgChartNodeType, AgentContainerNodeData, SkillNodeData, DatabaseNodeData } from '../types';
import type { BrainTemplate, OrgSectionTemplateData, AgentTemplateData, SkillTemplateData, DatabaseTemplateData } from '@/ddd/domain/templates/types';

// =============================================================================
// Types
// =============================================================================

export interface ExportableEntity {
  nodeId: string;
  type: OrgChartNodeType;
  entityId: number;
  name: string;
  /** For skills/databases, which agent they belong to (if any) */
  agentId?: number | null;
  /** Whether this entity's parent agent is also being exported */
  parentIncluded?: boolean;
}

export interface ExportPreview {
  /** Agents being exported (with their children) */
  agents: Array<{
    id: number;
    name: string;
    skillCount: number;
    databaseCount: number;
  }>;
  /** Standalone skills (not part of an exported agent) */
  standaloneSkills: Array<{
    id: number;
    name: string;
    agentId?: number | null;
  }>;
  /** Standalone databases (not part of an exported agent) */
  standaloneDatabases: Array<{
    id: number;
    name: string;
    agentId?: number | null;
  }>;
  /** Total count of all items */
  totalCount: number;
}

export interface UseOrgChartExportReturn {
  /** List of exportable entities from selection */
  exportableEntities: ExportableEntity[];
  /** Preview summary for UI display */
  exportPreview: ExportPreview;
  /** Check if export is possible (has exportable selection) */
  canExport: boolean;
  /** Build export preview from selected nodes */
  getExportPreview: () => ExportPreview;
}

// =============================================================================
// Hook
// =============================================================================

export function useOrgChartExport(
  nodes: OrgChartNode[],
  selectedNodeIds: Set<string>,
  skills: Array<{ id: number; name: string; agentId?: number | null }>,
  databases: Array<{ id: number; name: string; agentId?: number | null }>
): UseOrgChartExportReturn {

  // Build list of exportable entities from selection
  const exportableEntities = useMemo((): ExportableEntity[] => {
    const entities: ExportableEntity[] = [];
    const selectedAgentIds = new Set<number>();

    // First pass: identify selected agents
    for (const nodeId of selectedNodeIds) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      if (node.type === 'agent') {
        const data = node.data as AgentContainerNodeData;
        selectedAgentIds.add(data.agentId);
      }
    }

    // Second pass: build entity list
    for (const nodeId of selectedNodeIds) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Skip non-exportable types
      if (node.type === 'sticky' || node.type === 'org_resources') continue;

      // Skip child nodes if parent agent is selected
      if (node.parentId && selectedNodeIds.has(node.parentId)) continue;

      switch (node.type) {
        case 'agent': {
          const data = node.data as AgentContainerNodeData;
          entities.push({
            nodeId: node.id,
            type: 'agent',
            entityId: data.agentId,
            name: data.name,
          });
          break;
        }
        case 'skill': {
          const data = node.data as SkillNodeData;
          const parentIncluded = data.agentId ? selectedAgentIds.has(data.agentId) : false;
          if (!parentIncluded) {
            entities.push({
              nodeId: node.id,
              type: 'skill',
              entityId: data.skillId,
              name: data.name,
              agentId: data.agentId,
              parentIncluded,
            });
          }
          break;
        }
        case 'database': {
          const data = node.data as DatabaseNodeData;
          const parentIncluded = data.agentId ? selectedAgentIds.has(data.agentId) : false;
          if (!parentIncluded) {
            entities.push({
              nodeId: node.id,
              type: 'database',
              entityId: data.databaseId,
              name: data.name,
              agentId: data.agentId,
              parentIncluded,
            });
          }
          break;
        }
      }
    }

    return entities;
  }, [nodes, selectedNodeIds]);

  // Build export preview for UI
  const exportPreview = useMemo((): ExportPreview => {
    const preview: ExportPreview = {
      agents: [],
      standaloneSkills: [],
      standaloneDatabases: [],
      totalCount: 0,
    };

    const selectedAgentIds = new Set<number>();

    // Identify agents and their IDs
    for (const entity of exportableEntities) {
      if (entity.type === 'agent') {
        selectedAgentIds.add(entity.entityId);

        // Count skills and databases for this agent
        const agentSkills = skills.filter(s => s.agentId === entity.entityId);
        const agentDatabases = databases.filter(d => d.agentId === entity.entityId);

        preview.agents.push({
          id: entity.entityId,
          name: entity.name,
          skillCount: agentSkills.length,
          databaseCount: agentDatabases.length,
        });
      }
    }

    // Add standalone skills (not part of exported agents)
    for (const entity of exportableEntities) {
      if (entity.type === 'skill' && !entity.parentIncluded) {
        preview.standaloneSkills.push({
          id: entity.entityId,
          name: entity.name,
          agentId: entity.agentId,
        });
      }
    }

    // Add standalone databases
    for (const entity of exportableEntities) {
      if (entity.type === 'database' && !entity.parentIncluded) {
        preview.standaloneDatabases.push({
          id: entity.entityId,
          name: entity.name,
          agentId: entity.agentId,
        });
      }
    }

    // Calculate totals (agents count their children)
    let total = 0;
    for (const agent of preview.agents) {
      total += 1 + agent.skillCount + agent.databaseCount;
    }
    total += preview.standaloneSkills.length;
    total += preview.standaloneDatabases.length;
    preview.totalCount = total;

    return preview;
  }, [exportableEntities, skills, databases]);

  const canExport = exportableEntities.length > 0;

  const getExportPreview = useCallback(() => exportPreview, [exportPreview]);

  return {
    exportableEntities,
    exportPreview,
    canExport,
    getExportPreview,
  };
}

// =============================================================================
// Helper Functions for Building Templates
// =============================================================================

/**
 * Build a BrainTemplate from full entity data
 * Called after fetching complete entity data from server
 */
export function buildOrgSectionTemplate(
  templateName: string,
  templateDescription: string,
  agents: AgentTemplateData[],
  agentSkillsMap: Map<string, SkillTemplateData[]>,
  agentDatabasesMap: Map<string, DatabaseTemplateData[]>,
  standaloneSkills: SkillTemplateData[],
  standaloneDatabases: DatabaseTemplateData[],
  category?: string,
  tags?: string[]
): BrainTemplate {
  const orgSectionData: OrgSectionTemplateData = {
    agents: agents.map(agent => ({
      agent,
      skills: agentSkillsMap.get(agent.name) || [],
      databases: agentDatabasesMap.get(agent.name) || [],
    })),
    orgSkills: standaloneSkills.length > 0 ? standaloneSkills : undefined,
    orgDatabases: standaloneDatabases.length > 0 ? standaloneDatabases : undefined,
  };

  return {
    $format: 'brain-template',
    $version: 1,
    metadata: {
      name: templateName,
      description: templateDescription,
      category,
      tags,
      version: '1.0.0',
    },
    template: {
      type: 'org_section',
      data: orgSectionData,
    },
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Build a single-skill BrainTemplate
 */
export function buildSkillTemplate(
  skill: SkillTemplateData,
  category?: string,
  tags?: string[]
): BrainTemplate {
  return {
    $format: 'brain-template',
    $version: 1,
    metadata: {
      name: skill.name,
      description: skill.description,
      category,
      tags,
      version: '1.0.0',
    },
    template: {
      type: 'skill',
      data: skill,
    },
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Build a single-database BrainTemplate
 */
export function buildDatabaseTemplate(
  database: DatabaseTemplateData,
  category?: string,
  tags?: string[]
): BrainTemplate {
  return {
    $format: 'brain-template',
    $version: 1,
    metadata: {
      name: database.name,
      description: database.description || '',
      category,
      tags,
      version: '1.0.0',
    },
    template: {
      type: 'database',
      data: database,
    },
    exportedAt: new Date().toISOString(),
  };
}

export default useOrgChartExport;
