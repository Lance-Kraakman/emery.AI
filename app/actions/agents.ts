'use server'

import { db } from "@/lib/db/client";
import { agents, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import type { ActionResult, CreateAgentData } from "./types";

// Simple API key generator
function generateApiKey(): string {
  return 'ag_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function createAgent(data: CreateAgentData): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_agents");
    const { name, type, capabilities, status, roleId } = data;

    if (!name || !type) {
      return {
        success: false,
        error: "Agent name and type are required",
      };
    }

    const [newAgent] = await db.insert(agents).values({
      name,
      type,
      capabilities,
      status: status || "active",
      organizationId: session.user.organizationId,
      roleId: roleId || null,
      apiKey: generateApiKey(),
    }).returning();

    revalidatePath('/dashboard');
    
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
  const type = formData.get('type') as string;
  const status = formData.get('status') as string;
  const capabilitiesStr = formData.get('capabilities') as string;
  
  const capabilities = capabilitiesStr ? capabilitiesStr.split(',').map(c => c.trim()) : undefined;

  const result = await createAgent({ name, type, capabilities, status });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getAgents() {
  try {
    const allAgents = await db
      .select()
      .from(agents);

    return allAgents;
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

    revalidatePath('/dashboard');
    
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

    revalidatePath('/dashboard');
    
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