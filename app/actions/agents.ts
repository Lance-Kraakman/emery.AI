'use server'

import { db } from "@/lib/db/client";
import { agents, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import type { ActionResult, CreateAgentData } from "./types";

// Simple API key generator
function generateApiKey(): string {
  return 'ag_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function createAgent(data: CreateAgentData): Promise<ActionResult> {
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

    revalidatePath('/mission-control');
    
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

  revalidatePath('/mission-control');
  return result;
}

export async function getAgents() {
  try {
    const currentOrg = await requireCurrentOrganization();
    
    const organizationAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, currentOrg.id));

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

export async function updateAgent(agentId: number, data: Partial<CreateAgentData>): Promise<ActionResult> {
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

    revalidatePath('/mission-control');
    
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

export async function deleteAgent(agentId: number): Promise<ActionResult> {
  try {
    if (!agentId) {
      return {
        success: false,
        error: "agentId is required",
      };
    }

    await db.delete(agents).where(eq(agents.id, agentId));

    revalidatePath('/mission-control');
    
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