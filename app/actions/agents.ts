'use server'

import { db } from "@/lib/db/client";
import { agents, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { autoReindexService } from "@/lib/rag/auto-reindex";
import type { ActionResult, CreateAgentData } from "./types";

// AIDEV-NOTE: Simple API key generator for agent authentication - use more secure method in production
function generateApiKey(): string {
  return 'ag_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function createAgent(data: CreateAgentData, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_agents");
    const { 
      name, 
      role, 
      description, 
      persona, 
      tools, 
      servers, 
      trigger, 
      capabilities, 
      status, 
      roleId 
    } = data;

    if (!name) {
      return {
        success: false,
        error: "Agent name is required",
      };
    }

    const [newAgent] = await db.insert(agents).values({
      name,
      role: role || 'assistant',
      description,
      persona,
      ownerId: session.user.id, // Agent is owned by the creating user
      tools: tools ? tools as any : null, // JSONB field - rich tool configuration
      servers: servers ? servers as any : null, // JSONB field - rich server configuration
      trigger: trigger ? trigger as any : null, // JSONB field
      capabilities: capabilities ? capabilities as any : null, // JSONB field
      status: status || "active",
      organizationId: session.user.currentOrganizationId,
      roleId: roleId || null,
      apiKey: generateApiKey(),
    }).returning();

    // Trigger RAG reindexing for agents domain in this organization
    if (session.user.currentOrganizationId) {
      autoReindexService.debouncedReindex(session.user.currentOrganizationId, 'agents').catch(console.error);
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/manage'); // Default path for agent operations
    }
    
    return {
      success: true,
      data: newAgent,
    };
  } catch (error) {
    console.error("Error creating agent:", error);
    return {
      success: false,
      error: "Failed to create agent",
    };
  }
}

export async function addCapabilityToAgent(agentId: number, capability: { name: string; description: string; tools: string[]; servers: any[] }) {
  'use server';
  const agent = await db.select().from(agents).where(eq(agents.id, agentId));
  if (agent.length === 0) {
    throw new Error("Agent not found");
  }
  const existingCapabilities = (agent[0].capabilities as any[]) || [];
  const newCapabilities = [...existingCapabilities, capability];
  await db.update(agents).set({ capabilities: newCapabilities }).where(eq(agents.id, agentId));
}

export async function createAgentAction(formData: FormData) {
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const description = formData.get('description') as string;
  const persona = formData.get('persona') as string;
  const status = formData.get('status') as string;
  const toolsStr = formData.get('tools') as string;
  const serversStr = formData.get('servers') as string;
  
  // Parse tools into ToolConfig[] format
  const tools = toolsStr 
    ? toolsStr.split(',')
        .map(t => t.trim())
        .filter(t => t)
        .map(toolName => ({ name: toolName })) // Simple format, can be enhanced later
    : undefined;
  
  // Parse servers into ServerConfig[] format  
  const servers = serversStr 
    ? serversStr.split(',')
        .map(s => s.trim())
        .filter(s => s)
        .map(serverName => ({ name: serverName })) // Simple format, can be enhanced later
    : undefined;

  const result = await createAgent({ 
    name, 
    role, 
    description, 
    persona, 
    tools, 
    servers, 
    status 
  });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main createAgent function
  return result;
}

import { and, like, sql, desc } from "drizzle-orm";
import { teams } from "@/lib/db/schema";

export async function getAgents(filters: { teamId?: number | string, searchQuery?: string } = {}) {
  try {
    const currentOrg = await requireCurrentOrganization();
    const { teamId, searchQuery } = filters;

    const conditions = [eq(agents.organizationId, currentOrg.id)];

    if (searchQuery) {
      conditions.push(like(agents.name, `%${searchQuery}%`));
    }

    if (teamId && teamId !== 'all') {
      const teamIdNumber = Number(teamId);
      if (isNaN(teamIdNumber)) {
        console.warn(`Invalid teamId provided: ${teamId}`);
        return [];
      }
      
      const team = await db.select({ agentIds: teams.agentIds }).from(teams).where(eq(teams.id, teamIdNumber));
      if (team.length > 0 && team[0].agentIds) {
        const agentIdsAsNumbers = team[0].agentIds.map(id => Number(id));
        if(agentIdsAsNumbers.length > 0) {
          conditions.push(sql`${agents.id} IN ${agentIdsAsNumbers}`);
        } else {
          // No agents in this team, return empty
          return [];
        }
      } else {
        // Team not found or has no agents, return empty
        return [];
      }
    }

    const organizationAgents = await db
      .select()
      .from(agents)
      .where(and(...conditions))
      .orderBy(desc(agents.createdAt));

    return organizationAgents;
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw new Error("Failed to fetch agents");
  }
}

export async function getAgent(agentId: number) {
  try {
    if (!agentId) {
      throw new Error("agentId is required");
    }

    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId));

    return agent;
  } catch (error) {
    console.error("Error fetching agent:", error);
    throw new Error("Failed to fetch agent");
  }
}

export async function updateAgent(agentId: number, data: Partial<CreateAgentData>, revalidateUrl?: string): Promise<ActionResult> {
  try {
    if (!agentId) {
      return {
        success: false,
        error: "agentId is required",
      };
    }

    const [updatedAgent] = await db
      .update(agents)
      .set(data)
      .where(eq(agents.id, agentId))
      .returning();

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/manage'); // Default path for agent operations
    }
    
    return {
      success: true,
      data: updatedAgent,
    };
  } catch (error) {
    console.error("Error updating agent:", error);
    return {
      success: false,
      error: "Failed to update agent",
    };
  }
}

export async function deleteAgent(agentId: number, revalidateUrl?: string): Promise<ActionResult> {
  try {
    if (!agentId) {
      return {
        success: false,
        error: "agentId is required",
      };
    }

    await db.delete(agents).where(eq(agents.id, agentId));

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/manage'); // Default path for agent operations
    }
    
    return {
      success: true,
      data: { message: "Agent deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting agent:", error);
    return {
      success: false,
      error: "Failed to delete agent",
    };
  }
}
