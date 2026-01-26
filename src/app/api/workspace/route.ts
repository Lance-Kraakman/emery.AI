/**
 * Unified Workspace API - Single endpoint for all workspace resources
 *
 * AIDEV-NOTE: This endpoint provides complete workspace context for the planner/agents.
 * Returns apps (with pages), agents, skills, databases (with tables), and views in one call.
 * Mirrors the sidebar data structure for consistency.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import {
  getAppApplicationService,
  getAgentApplicationService,
  getSkillApplicationService,
  getDatabaseApplicationService,
  getTableApplicationService,
  getViewApplicationService,
} from '@/ddd/application/di/getters';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';

// Response types for workspace data
interface WorkspacePageDTO {
  id: number;
  name: string;
  slug: string;
}

interface WorkspaceAppDTO {
  id: number;
  name: string;
  slug: string;
  description?: string;
  pages: WorkspacePageDTO[];
}

interface WorkspaceAgentDTO {
  id: number;
  name: string;
  description?: string;
}

interface WorkspaceSkillDTO {
  id: number;
  name: string;
  description?: string;
  agentId?: number;
  agentName?: string;
}

interface WorkspaceTableDTO {
  id: number;
  name: string;
  fieldCount: number;
}

interface WorkspaceDatabaseDTO {
  id: number;
  name: string;
  tables: WorkspaceTableDTO[];
}

interface WorkspaceViewDTO {
  id: number;
  name: string;
  tableId: number;
  viewType: string;
}

interface WorkspaceResponse {
  apps: WorkspaceAppDTO[];
  agents: WorkspaceAgentDTO[];
  skills: WorkspaceSkillDTO[];
  databases: WorkspaceDatabaseDTO[];
  views: WorkspaceViewDTO[];
}

/**
 * GET /api/workspace
 *
 * Returns all workspace resources for the planner/agents.
 * Single call replaces 6+ separate API calls.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'User has no current organization', status: 400 };
    }

    const startTime = Date.now();
    const orgId = OrganizationId.fromNumber(user.organizationId);

    // Fetch all workspace data in parallel (same pattern as sidebar)
    const [
      appsWithPages,
      agentsResult,
      skillsResult,
      databasesResult,
      tablesResult,
      viewsResult,
    ] = await Promise.all([
      getAppApplicationService().getAppsWithPagesForOrganization(orgId),
      getAgentApplicationService().getAgents({ organizationId: user.organizationId }),
      getSkillApplicationService().getSkillsByOrganization(user.organizationId),
      getDatabaseApplicationService().getDatabases({ organizationId: user.organizationId }),
      getTableApplicationService().getTablesForOrganization(orgId),
      getViewApplicationService().getViewsByOrganization(orgId),
    ]);

    console.log(`[PERF] Workspace API fetch: ${Date.now() - startTime}ms`);

    // Build agent lookup for enriching skills
    const agentLookup = new Map<number, string>();
    for (const agent of agentsResult || []) {
      agentLookup.set(agent.id, agent.name);
    }

    // Group tables by database (tablesResult is DynamicTable[] domain entities)
    const tablesByDatabase = new Map<number, WorkspaceTableDTO[]>();
    for (const table of tablesResult || []) {
      const dbId = table.databaseId.value;
      if (!tablesByDatabase.has(dbId)) {
        tablesByDatabase.set(dbId, []);
      }
      tablesByDatabase.get(dbId)!.push({
        id: table.id.value,
        name: table.name,
        fieldCount: table.fields?.length || 0,
      });
    }

    // Build response matching sidebar structure
    const response: WorkspaceResponse = {
      apps: appsWithPages.map(app => ({
        id: app.id,
        name: app.name,
        slug: app.slug,
        pages: app.pages.map(page => ({
          id: page.id,
          name: page.name,
          slug: page.slug,
        })),
      })),

      agents: (agentsResult || []).map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
      })),

      skills: (skillsResult?.success && skillsResult?.data ? skillsResult.data : []).map(skill => ({
        id: skill.id.value,
        name: skill.name,
        description: skill.description,
        agentId: skill.agentId?.value,
        agentName: skill.agentId ? agentLookup.get(skill.agentId.value) : undefined,
      })),

      // databasesResult is DatabaseDTO[] from getDatabases
      databases: (databasesResult || []).map(db => ({
        id: db.id,
        name: db.name,
        tables: tablesByDatabase.get(db.id) || [],
      })),

      views: (viewsResult?.success && viewsResult?.data ? viewsResult.data : []).map(view => ({
        id: view.id.value,
        name: view.name,
        tableId: view.tableId.value,
        viewType: view.viewType.value,
      })),
    };

    return { success: true, data: response };
  });
}
