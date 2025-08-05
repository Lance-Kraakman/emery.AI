'use server'

import { requireAuth } from "./permissions";
import { createOrGetPipedreamUser, getUserConnections, generateConnectionUrl, disconnectUserAccount } from "@/lib/pipedream/users";
import { runActionForAgent } from "@/lib/pipedream/agents";
import { db } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ActionResult } from "./types";

export interface ConnectAppData {
  appName: string;
  redirectUrl?: string;
}

export interface RunAgentActionData {
  agentId: number;
  actionId: string;
  configuredProps: Record<string, any>;
}

export interface DisconnectAccountData {
  accountId: string;
}

/**
 * Initialize Pipedream user for the current user
 */
export async function initializePipedreamUser(): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    
    const pipedreamUser = await createOrGetPipedreamUser({
      userId: session.user.id,
      email: session.user.email || undefined,
      name: session.user.name || undefined,
    });
    
    return {
      success: true,
      data: pipedreamUser,
    };
  } catch (error) {
    console.error("Error initializing Pipedream user:", error);
    
    // Check if it's a configuration error
    if (error instanceof Error && error.message.includes('not available')) {
      return {
        success: false,
        error: "Pipedream is not configured. Please set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET environment variables.",
      };
    }
    
    return {
      success: false,
      error: "Failed to initialize Pipedream user",
    };
  }
}

/**
 * Get user's OAuth connections
 */
export async function getUserOAuthConnections(): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    
    // Ensure Pipedream user exists
    await createOrGetPipedreamUser({
      userId: session.user.id,
      email: session.user.email || undefined,
      name: session.user.name || undefined,
    });
    
    const connections = await getUserConnections(session.user.id);
    
    return {
      success: true,
      data: connections,
    };
  } catch (error) {
    console.error("Error getting user OAuth connections:", error);
    return {
      success: false,
      error: "Failed to get OAuth connections",
    };
  }
}

/**
 * Generate connection URL for connecting an app
 */
export async function getAppConnectionUrl(data: ConnectAppData): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    
    // Ensure Pipedream user exists
    await createOrGetPipedreamUser({
      userId: session.user.id,
      email: session.user.email || undefined,
      name: session.user.name || undefined,
    });
    
    const connectionUrl = await generateConnectionUrl(
      session.user.id, 
      data.appName,
      data.redirectUrl
    );
    
    return {
      success: true,
      data: { url: connectionUrl },
    };
  } catch (error) {
    console.error("Error generating connection URL:", error);
    return {
      success: false,
      error: "Failed to generate connection URL",
    };
  }
}

/**
 * Run an action on behalf of an agent (using owner's credentials)
 */
export async function runAgentAction(data: RunAgentActionData): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    
    // Get the agent and verify ownership or permissions
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, data.agentId))
      .limit(1);
    
    if (!agent) {
      return {
        success: false,
        error: "Agent not found",
      };
    }
    
    // Check if user owns the agent or has manage_agents permission
    if (agent.ownerId !== session.user.id) {
      // TODO: Add permission check for manage_agents
      return {
        success: false,
        error: "Access denied: You don't own this agent",
      };
    }
    
    // Run the action using the agent owner's credentials
    const result = await runActionForAgent({
      agentId: data.agentId,
      ownerUserId: agent.ownerId,
      actionId: data.actionId,
      configuredProps: data.configuredProps,
    });
    
    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  } catch (error) {
    console.error("Error running agent action:", error);
    return {
      success: false,
      error: "Failed to run agent action",
    };
  }
}

/**
 * Disconnect an OAuth account for the current user
 */
export async function disconnectOAuthAccount(data: DisconnectAccountData): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    
    await disconnectUserAccount(session.user.id, data.accountId);
    
    return {
      success: true,
      data: { message: "Account disconnected successfully" },
    };
  } catch (error) {
    console.error("Error disconnecting OAuth account:", error);
    return {
      success: false,
      error: "Failed to disconnect account",
    };
  }
}