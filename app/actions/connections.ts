'use server'

// AIDEV-NOTE: Connection Server Actions - DDD-based replacement for app/actions/pipedream.ts  
// Provides same interface for frontend components but uses new DDD architecture

import { requireAuth } from "./permissions";
import { getConnectionApplicationService } from "@/ddd/application/di/container";
import { UserId, OrganizationId } from "@/ddd/domain/shared/value-objects";
import { AppName, ConnectionId } from "@/ddd/domain/connections/value-objects";
import { ConnectionMapper, type ConnectionDTO } from "@/app/mappers/connection-mapper";
import type { Result } from "./types";

/**
 * Get user's OAuth connections - replaces getUserOAuthConnections from pipedream.ts
 * Returns connections sorted by most recent first
 */
export async function getUserOAuthConnections(): Promise<Result<ConnectionDTO[]>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();
    
    console.log(`[ConnectionActions] Getting OAuth connections for user ${session.user.id}`);
    
    const result = await connectionService.getUserConnections(
      UserId.fromString(session.user.id)
    );
    
    if (result.success && result.data) {
      console.log(`[ConnectionActions] Retrieved ${result.data.length} connections`);
      const connectionDTOs = ConnectionMapper.toDTOArray(result.data);
      return { success: true, data: connectionDTOs };
    } else {
      console.error(`[ConnectionActions] Failed to get connections:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error: unknown) {
    console.error('[ConnectionActions] Error getting user OAuth connections:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      error: errorMessage.includes('Authentication required') 
        ? 'Authentication required' 
        : 'Failed to fetch connections'
    };
  }
}

/**
 * Generate app connection URL - replaces getAppConnectionUrl from pipedream.ts
 * Creates OAuth flow URL for connecting external services
 */
export async function getAppConnectionUrl(data: {
  appName: string;
  redirectUrl?: string;
}): Promise<Result> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();
    
    console.log(`[ConnectionActions] Generating connection URL for app ${data.appName}`);
    
    // Validate app name using domain value object
    let appName: AppName;
    try {
      appName = AppName.fromString(data.appName);
    } catch (appError: unknown) {
      const errorMessage = appError instanceof Error ? appError.message : 'Invalid app name';
      console.error(`[ConnectionActions] Invalid app name: ${data.appName}`, errorMessage);
      return { 
        success: false, 
        error: errorMessage 
      };
    }
    
    const result = await connectionService.initiateConnection(
      UserId.fromString(session.user.id),
      appName,
      data.redirectUrl
    );
    
    if (result.success) {
      console.log(`[ConnectionActions] Generated connection URL for ${data.appName}`);
    } else {
      console.error(`[ConnectionActions] Failed to generate URL for ${data.appName}:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error('[ConnectionActions] Error generating connection URL:', error);
    return { 
      success: false, 
      error: 'Failed to generate connection URL'
    };
  }
}

/**
 * Disconnect OAuth account - replaces disconnectOAuthAccount from pipedream.ts
 * Removes connection between user and external service
 */
export async function disconnectOAuthAccount(data: {
  accountId: string;
}): Promise<Result> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();
    
    console.log(`[ConnectionActions] Disconnecting account ${data.accountId} for user ${session.user.id}`);
    
    // Validate and wrap account ID using domain value object
    let connectionId: ConnectionId;
    try {
      connectionId = ConnectionId.fromPipedreamId(data.accountId);
    } catch (idError: unknown) {
      const errorMessage = idError instanceof Error ? idError.message : 'Invalid account ID format';
      console.error(`[ConnectionActions] Invalid account ID: ${data.accountId}`, errorMessage);
      return { 
        success: false, 
        error: 'Invalid account ID format'
      };
    }
    
    const result = await connectionService.disconnectConnection(connectionId);
    
    if (result.success) {
      console.log(`[ConnectionActions] Successfully disconnected account ${data.accountId}`);
    } else {
      console.error(`[ConnectionActions] Failed to disconnect ${data.accountId}:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error('[ConnectionActions] Error disconnecting OAuth account:', error);
    return { 
      success: false, 
      error: 'Failed to disconnect account'
    };
  }
}

/**
 * Check if user has required connections (new utility function)
 * Useful for validating agent capabilities before execution
 */
export async function checkRequiredConnections(requiredApps: string[]): Promise<Result<string[]>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();
    
    console.log(`[ConnectionActions] Checking required connections for user ${session.user.id}:`, requiredApps);
    
    const missing = await connectionService.getMissingConnections(
      UserId.fromString(session.user.id),
      requiredApps
    );
    
    const missingAppNames = missing.map(app => app.value);
    console.log(`[ConnectionActions] Missing connections: ${missingAppNames.join(', ') || 'none'}`);
    
    return { 
      success: true, 
      data: missingAppNames
    };
  } catch (error) {
    console.error('[ConnectionActions] Error checking required connections:', error);
    return { 
      success: false, 
      error: 'Failed to check connections' 
    };
  }
}

/**
 * Get connection summary for dashboard display (new function)
 * Returns statistics about user's connections
 */
export async function getConnectionSummary(): Promise<Result<{
  totalConnections: number;
  activeConnections: number;
  errorConnections: number;
  connectedApps: string[];
}>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();
    
    const result = await connectionService.getConnectionSummary(
      UserId.fromString(session.user.id)
    );
    
    if (result.success && result.data) {
      console.log(`[ConnectionActions] Connection summary: ${result.data.activeConnections}/${result.data.totalConnections} active`);
    }
    
    return result;
  } catch (error) {
    console.error('[ConnectionActions] Error getting connection summary:', error);
    return { 
      success: false, 
      error: 'Failed to get connection summary' 
    };
  }
}

/**
 * Check if user can use a specific app (used by agent validation)
 * Returns boolean indicating if user has active connection for the app
 */
export async function canUseApp(appName: string): Promise<Result<boolean>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();

    const canUse = await connectionService.canUseApp(
      UserId.fromString(session.user.id),
      AppName.fromString(appName)
    );

    return { success: true, data: canUse };
  } catch (error) {
    console.error(`[ConnectionActions] Error checking app availability for ${appName}:`, error);
    return { success: false, error: 'Failed to check app availability' };
  }
}

// AIDEV-NOTE: Extended connection actions for UI connection status components

/**
 * Connection status for a specific tool
 */
export interface ToolConnectionStatus {
  toolName: string;
  displayName: string;
  isConnected: boolean;
  requiredApps: string[];
  missingApps: string[];
  warnings: string[];
  connectionType: 'oauth' | 'api_key' | 'none';
}

/**
 * Summary of connection health for an agent
 */
export interface AgentConnectionSummary {
  agentId: number;
  agentName: string;
  totalTools: number;
  connectedTools: number;
  disconnectedTools: number;
  missingApps: string[];
  connectionHealth: 'healthy' | 'warning' | 'critical';
}

/**
 * Connection validation result
 */
export interface ConnectionValidationResult {
  valid: boolean;
  warnings: string[];
  missingConnections: string[];
  toolStatuses: ToolConnectionStatus[];
}

/**
 * Get connection status for multiple tools
 */
export async function getToolConnectionStatus(
  tools: any[], // ToolConfig[]
  ownerId?: string
): Promise<Result<ToolConnectionStatus[]>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();

    const userId = ownerId ? UserId.fromString(ownerId) : UserId.fromString(session.user.id);
    const toolStatuses: ToolConnectionStatus[] = [];

    for (const tool of tools) {
      // Get tool metadata to check connection requirements
      const requiredApps = tool.requiredApps || [];

      let isConnected = true;
      let missingApps: string[] = [];
      let warnings: string[] = [];
      let connectionType: 'oauth' | 'api_key' | 'none' = 'none';

      if (requiredApps.length > 0) {
        // Check which connections are missing
        const missingConnections = await connectionService.getMissingConnections(userId, requiredApps);
        missingApps = missingConnections.map(app => app.value);
        isConnected = missingApps.length === 0;
        connectionType = 'oauth'; // Most tools use OAuth

        if (!isConnected) {
          warnings.push(`Missing connections: ${missingApps.join(', ')}`);
        }
      }

      toolStatuses.push({
        toolName: tool.name,
        displayName: tool.displayName || tool.name,
        isConnected,
        requiredApps,
        missingApps,
        warnings,
        connectionType
      });
    }

    return {
      success: true,
      data: toolStatuses
    };
  } catch (error) {
    console.error('Error getting tool connection status:', error);
    return {
      success: false,
      error: 'Failed to get connection status'
    };
  }
}

/**
 * Get agents owned by user that need connections
 */
export async function getAgentsNeedingConnections(): Promise<Result<AgentConnectionSummary[]>> {
  try {
    const session = await requireAuth();

    // Import agent services
    const { getAgentApplicationService } = await import('@/ddd/application/di/container');
    const agentService = getAgentApplicationService();
    const connectionService = getConnectionApplicationService();

    const userId = UserId.fromString(session.user.id);

    // Get agents in this organization
    const agents = await agentService.getAgents({
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId!)
    });

    const agentSummaries: AgentConnectionSummary[] = [];

    for (const agent of agents) {
      const tools = agent.tools || [];

      if (tools.length === 0) continue;

      // Get connection status for agent tools
      const toolStatusResult = await getToolConnectionStatus(tools, session.user.id);

      if (!toolStatusResult.success) continue;

      const toolStatuses = toolStatusResult.data || [];
      const connectedTools = toolStatuses.filter(t => t.isConnected).length;
      const disconnectedTools = toolStatuses.length - connectedTools;

      // Collect all missing apps
      const allMissingApps = new Set<string>();
      toolStatuses.forEach(tool => {
        tool.missingApps.forEach(app => allMissingApps.add(app));
      });

      // Determine connection health
      let connectionHealth: 'healthy' | 'warning' | 'critical';
      if (disconnectedTools === 0) {
        connectionHealth = 'healthy';
      } else if (connectedTools > disconnectedTools) {
        connectionHealth = 'warning';
      } else {
        connectionHealth = 'critical';
      }

      // Only include agents that need connections
      if (disconnectedTools > 0) {
        agentSummaries.push({
          agentId: agent.id.value,
          agentName: agent.name,
          totalTools: toolStatuses.length,
          connectedTools,
          disconnectedTools,
          missingApps: Array.from(allMissingApps),
          connectionHealth
        });
      }
    }

    return {
      success: true,
      data: agentSummaries
    };
  } catch (error) {
    console.error('Error getting agents needing connections:', error);
    return {
      success: false,
      error: 'Failed to get agent connection status'
    };
  }
}

/**
 * Generate OAuth setup URL for a specific app
 */
export async function getConnectionSetupUrl(
  appName: string,
  redirectPath: string = '/connections'
): Promise<Result<string>> {
  try {
    await requireAuth();

    // Use existing getAppConnectionUrl function
    const result = await getAppConnectionUrl({
      appName,
      redirectUrl: redirectPath
    });

    return result;
  } catch (error) {
    console.error('Error generating connection setup URL:', error);
    return {
      success: false,
      error: 'Failed to generate setup URL'
    };
  }
}

/**
 * Validate connections for a specific agent
 */
export async function validateAgentConnections(
  agentId: number
): Promise<Result<ConnectionValidationResult>> {
  try {
    const session = await requireAuth();

    const { getAgentApplicationService } = await import('@/ddd/application/di/container');
    const agentService = getAgentApplicationService();

    // Get agent details
    const agent = await agentService.getAgent({ value: agentId } as any);

    if (!agent) {
      return {
        success: false,
        error: 'Agent not found'
      };
    }

    const tools = agent.tools || [];

    if (tools.length === 0) {
      return {
        success: true,
        data: {
          valid: true,
          warnings: [],
          missingConnections: [],
          toolStatuses: []
        }
      };
    }

    // Get tool connection status
    const toolStatusResult = await getToolConnectionStatus(tools, session.user.id);

    if (!toolStatusResult.success) {
      return {
        success: false,
        error: toolStatusResult.error
      };
    }

    const toolStatuses = toolStatusResult.data || [];
    const allMissingApps = new Set<string>();
    const warnings: string[] = [];

    toolStatuses.forEach(tool => {
      tool.missingApps.forEach(app => allMissingApps.add(app));
      warnings.push(...tool.warnings);
    });

    const valid = allMissingApps.size === 0;

    return {
      success: true,
      data: {
        valid,
        warnings,
        missingConnections: Array.from(allMissingApps),
        toolStatuses
      }
    };
  } catch (error) {
    console.error('Error validating agent connections:', error);
    return {
      success: false,
      error: 'Failed to validate connections'
    };
  }
}

/**
 * Get connection health summary for current user's agents
 */
export async function getConnectionHealthSummary(): Promise<Result<{
  totalAgentsWithTools: number;
  agentsNeedingConnections: number;
  totalMissingConnections: number;
  mostNeededApps: Array<{ app: string; count: number }>;
}>> {
  try {
    const agentsResult = await getAgentsNeedingConnections();

    if (!agentsResult.success) {
      return {
        success: false,
        error: agentsResult.error
      };
    }

    const agents = agentsResult.data || [];
    const appCounts = new Map<string, number>();

    // Count missing app occurrences
    agents.forEach(agent => {
      agent.missingApps.forEach(app => {
        appCounts.set(app, (appCounts.get(app) || 0) + 1);
      });
    });

    const mostNeededApps = Array.from(appCounts.entries())
      .map(([app, count]) => ({ app, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      success: true,
      data: {
        totalAgentsWithTools: agents.length, // Simplified for now
        agentsNeedingConnections: agents.length,
        totalMissingConnections: appCounts.size,
        mostNeededApps
      }
    };
  } catch (error) {
    console.error('Error getting connection health summary:', error);
    return {
      success: false,
      error: 'Failed to get connection health summary'
    };
  }
}