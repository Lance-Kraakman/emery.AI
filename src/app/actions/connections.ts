'use server'

// AIDEV-NOTE: Connection Server Actions - DDD-based replacement for app/actions/pipedream.ts  
// Provides same interface for frontend components but uses new DDD architecture

import { requireAuth } from "./permissions";
import { getConnectionApplicationService } from "@/ddd/application/di/container";
import { UserId, OrganizationId } from "@/ddd/domain/shared/value-objects";
import { AppName, ConnectionId, createDefaultPaginationOptions } from "@/ddd/domain/connections/value-objects";
import { ConnectionMapper, type ConnectionDTO } from "@/app/mappers/connection-mapper";
import type { Result } from "./types";

/**
 * Get user's Connections (paginated) - optimized for large connection lists
 * Returns connections sorted by most recent first with cursor-based pagination
 *
 * @param options - Pagination options { limit, cursor }
 * @returns Paginated result with connections, nextCursor, and hasMore flag
 */
export async function getUserOAuthConnectionsPaginated(options?: {
  limit?: number;
  cursor?: string;
}): Promise<Result<{
  connections: ConnectionDTO[];
  nextCursor?: string;
  hasMore: boolean;
}>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();

    const limit = options?.limit || 50;
    const cursor = options?.cursor;

    console.log(`[ConnectionActions] Getting paginated Connections for user ${session.user.id} (limit: ${limit}, cursor: ${cursor || 'none'})`);

    const paginationOptions = cursor
      ? { limit, after: cursor }
      : createDefaultPaginationOptions(limit);

    const result = await connectionService.getUserConnectionsPaginated(
      UserId.fromString(session.user.id),
      paginationOptions
    );

    if (result.success && result.data) {
      console.log(`[ConnectionActions] Retrieved ${result.data.data.length} connections (hasMore: ${result.data.hasMore})`);

      const connectionDTOs = ConnectionMapper.toDTOArray(result.data.data);

      return {
        success: true,
        data: {
          connections: connectionDTOs,
          nextCursor: result.data.nextCursor,
          hasMore: result.data.hasMore
        }
      };
    } else {
      console.error(`[ConnectionActions] Failed to get paginated connections:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error: unknown) {
    console.error('[ConnectionActions] Error getting paginated Connections:', error);
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
 * Get user's Connections - replaces getUserOAuthConnections from pipedream.ts
 * Returns connections sorted by most recent first
 * @deprecated Use getUserOAuthConnectionsPaginated for better performance with large lists
 */
export async function getUserOAuthConnections(): Promise<Result<ConnectionDTO[]>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();
    
    console.log(`[ConnectionActions] Getting Connections for user ${session.user.id}`);
    
    const result = await connectionService.getUserConnections(
      UserId.fromString(session.user.id)
    );
    
    if (result.success && result.data) {
      console.log(`[ConnectionActions] Retrieved ${result.data.length} connections`);

      // Enhanced debugging for connection consistency
      const connectionDetails = result.data.map(conn => ({
        app: conn.appName.value,
        status: conn.status,
        accountName: conn.accountName
      }));
      console.log(`[ConnectionActions] Connection details:`, connectionDetails);

      const connectionDTOs = ConnectionMapper.toDTOArray(result.data);
      console.log(`[ConnectionActions] Mapped to ${connectionDTOs.length} DTOs`);

      return { success: true, data: connectionDTOs };
    } else {
      console.error(`[ConnectionActions] Failed to get connections:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error: unknown) {
    console.error('[ConnectionActions] Error getting user Connections:', error);
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
 * Generate app connection URL - enhanced with duplicate prevention
 * Creates OAuth flow URL for connecting external services with smart duplicate handling
 */
export async function getAppConnectionUrl(data: {
  appName: string;
  redirectUrl?: string;
  forceNew?: boolean;
  reconnectExisting?: boolean;
}): Promise<Result<{
  url?: string;
  isReconnection?: boolean;
  existingConnection?: boolean;
  warningMessage?: string;
}>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();

    console.log(`[ConnectionActions] Generating connection URL for app ${data.appName}`, {
      forceNew: data.forceNew,
      reconnectExisting: data.reconnectExisting
    });

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
      OrganizationId.fromNumber(session.user.currentOrganizationId),
      appName,
      data.redirectUrl,
      {
        forceNew: data.forceNew,
        reconnectExisting: data.reconnectExisting
      }
    );

    if (result.success) {
      const resultData = result.data!;
      if (resultData.existingConnection) {
        console.log(`[ConnectionActions] Existing connection found for ${data.appName}: ${resultData.warningMessage}`);
      } else {
        console.log(`[ConnectionActions] Generated connection URL for ${data.appName} (${resultData.isReconnection ? 'reconnection' : 'new connection'})`);
      }
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
 * Get all user connections including duplicates (for debugging and power users)
 * Returns detailed information about duplicate groups
 */
export async function getUserConnectionsWithDuplicates(): Promise<Result<{
  connections: ConnectionDTO[];
  duplicateCount: number;
  duplicateGroups: Array<{ key: string; count: number; connections: ConnectionDTO[] }>;
}>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();

    console.log(`[ConnectionActions] Getting all connections with duplicates for user ${session.user.id}`);

    const result = await connectionService.getAllConnectionsWithDuplicates(
      UserId.fromString(session.user.id)
    );

    if (result.success && result.data) {
      console.log(`[ConnectionActions] Retrieved ${result.data.connections.length} total connections, ${result.data.duplicateCount} duplicates in ${result.data.duplicateGroups.length} groups`);

      // Map domain entities to DTOs
      const connectionDTOs = ConnectionMapper.toDTOArray(result.data.connections);
      const duplicateGroupDTOs = result.data.duplicateGroups.map(group => ({
        ...group,
        connections: ConnectionMapper.toDTOArray(group.connections)
      }));

      return {
        success: true,
        data: {
          connections: connectionDTOs,
          duplicateCount: result.data.duplicateCount,
          duplicateGroups: duplicateGroupDTOs
        }
      };
    } else {
      console.error(`[ConnectionActions] Failed to get connections with duplicates:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error: unknown) {
    console.error('[ConnectionActions] Error getting connections with duplicates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to fetch connections with duplicates: ${errorMessage}`
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

    console.log(`[ConnectionActions] Checking if user ${session.user.id} can use app '${appName}'`);

    const canUse = await connectionService.canUseApp(
      UserId.fromString(session.user.id),
      AppName.fromString(appName)
    );

    console.log(`[ConnectionActions] canUseApp result for '${appName}': ${canUse}`);
    return { success: true, data: canUse };
  } catch (error) {
    console.error(`[ConnectionActions] Error checking app availability for ${appName}:`, error);
    return { success: false, error: 'Failed to check app availability' };
  }
}

// AIDEV-NOTE: Extended connection actions for UI connection status components

/**
 * Unified connection check that both OAuth page and toolbar can use
 * This ensures consistency between different UI components
 */
export async function getUnifiedConnectionStatus(appName: string): Promise<Result<{
  isConnected: boolean;
  rawConnection: ConnectionDTO | null;
  connectionDetails: string;
}>> {
  try {
    const session = await requireAuth();
    const userId = UserId.fromString(session.user.id);
    const connectionService = getConnectionApplicationService();

    console.log(`[UnifiedConnectionStatus] Checking ${appName} for user ${session.user.id}`);

    // Get raw connections (same as OAuth page)
    const rawConnections = await connectionService.getUserConnections(userId);
    const matchingConnection = rawConnections.success && rawConnections.data
      ? rawConnections.data.find(conn => conn.appName.value.toLowerCase() === appName.toLowerCase())
      : null;

    // Check via canUseApp (same as toolbar)
    const canUse = await connectionService.canUseApp(userId, AppName.fromString(appName));

    const connectionDTO = matchingConnection ? ConnectionMapper.toDTO(matchingConnection) : null;

    console.log(`[UnifiedConnectionStatus] Results for ${appName}:`);
    console.log(`  - Raw connection found: ${!!matchingConnection} (status: ${matchingConnection?.status || 'none'})`);
    console.log(`  - canUseApp result: ${canUse}`);
    console.log(`  - Connection match: ${!!connectionDTO}`);

    return {
      success: true,
      data: {
        isConnected: canUse,
        rawConnection: connectionDTO,
        connectionDetails: matchingConnection
          ? `${matchingConnection.accountName} (${matchingConnection.status})`
          : 'No connection'
      }
    };
  } catch (error) {
    console.error(`[UnifiedConnectionStatus] Error checking ${appName}:`, error);
    return {
      success: false,
      error: `Failed to check connection status for ${appName}`
    };
  }
}

/**
 * Handle OAuth redirect and provide user feedback
 * Call this in useEffect to detect successful connections and refresh data
 */
export async function handleOAuthRedirect(): Promise<Result<{
  isRedirect: boolean;
  connectedApp?: string;
  message?: string;
}>> {
  try {
    if (typeof window === 'undefined') {
      return { success: true, data: { isRedirect: false } };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const connectedApp = urlParams.get('connected');

    if (connectedApp) {
      // Clean up the URL to prevent re-triggers
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      console.log(`[OAuthRedirect] Successfully connected ${connectedApp}`);

      // Verify the connection was actually created
      const verification = await getUnifiedConnectionStatus(connectedApp);
      const isActuallyConnected = verification.success && verification.data?.isConnected;

      return {
        success: true,
        data: {
          isRedirect: true,
          connectedApp,
          message: isActuallyConnected
            ? `Successfully connected to ${connectedApp}!`
            : `Connection to ${connectedApp} may need verification`
        }
      };
    }

    return { success: true, data: { isRedirect: false } };
  } catch (error) {
    console.error('[OAuthRedirect] Error handling OAuth redirect:', error);
    return {
      success: false,
      error: 'Failed to process connection redirect'
    };
  }
}

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
      let requiredApps = tool.requiredApps || [];

      // Fallback: infer required apps from tool name if not explicitly set
      if (requiredApps.length === 0) {
        const toolName = tool.name.toLowerCase();
        if (toolName.includes('slack')) {
          requiredApps = ['slack'];
        } else if (toolName.includes('gmail') || toolName.includes('google-gmail') || (toolName.includes('google') && toolName.includes('mail'))) {
          requiredApps = ['gmail'];
        } else if (toolName.includes('google') && toolName.includes('sheet')) {
          requiredApps = ['google-sheets'];
        } else if (toolName.includes('github')) {
          requiredApps = ['github'];
        } else if (toolName.includes('notion')) {
          requiredApps = ['notion'];
        }
      }

      let isConnected = true;
      let missingApps: string[] = [];
      let warnings: string[] = [];
      let connectionType: 'oauth' | 'api_key' | 'none' = 'none';

      if (requiredApps.length > 0) {
        try {
          // Check which connections are missing
          const missingConnections = await connectionService.getMissingConnections(userId, requiredApps);
          missingApps = missingConnections.map(app => app.value);
          isConnected = missingApps.length === 0;
          connectionType = 'oauth'; // Most tools use OAuth

          // Get user's actual connections for debugging
          const allConnections = await connectionService.getUserConnections(userId);
          const actualAppNames = allConnections.success && allConnections.data
            ? allConnections.data.map(conn => conn.appName.value)
            : [];

          console.log(`[ConnectionStatus] Tool ${tool.name}: required=${requiredApps}, missing=${missingApps}, connected=${isConnected}`);
          console.log(`[ConnectionStatus] User's actual connections: ${actualAppNames.join(', ')}`);
          console.log(`[ConnectionStatus] Checking against: ${requiredApps.join(', ')}`);

          if (!isConnected) {
            warnings.push(`Missing connections: ${missingApps.join(', ')}`);
          }
        } catch (error) {
          console.error(`[ConnectionStatus] Error checking connections for ${tool.name}:`, error);
          // Default to showing as disconnected if we can't check
          isConnected = false;
          missingApps = requiredApps;
          connectionType = 'oauth';
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
      organizationId: session.user.currentOrganizationId!
    });

    // AIDEV-NOTE: Agents no longer have tools at agent-level
    // Tools are defined per-task (in skills and schedules)
    // This function now returns empty array - connection management
    // should be done at user/organization level, not agent level
    const agentSummaries: AgentConnectionSummary[] = [];

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

    console.log(`[ConnectionSetupUrl] Setting up connection for ${appName}, redirect: ${redirectPath}`);

    // AIDEV-NOTE: Removed hardcoded validation - apps are validated against database
    // If app doesn't exist in database, the connection will fail gracefully later

    // Use existing getAppConnectionUrl function
    const result = await getAppConnectionUrl({
      appName,
      redirectUrl: redirectPath
    });

    if (result.success && result.data) {
      console.log(`[ConnectionSetupUrl] Successfully generated URL for ${appName}`);
      return {
        success: true,
        data: (result.data as { url: string }).url
      };
    } else {
      console.error(`[ConnectionSetupUrl] Failed to generate URL for ${appName}:`, result.error);

      // Provide more user-friendly error messages
      const userFriendlyError = result.error?.includes('Unsupported app')
        ? `${appName} connections are not available right now. Please try again later.`
        : result.error?.includes('Authentication required')
        ? 'Please sign in to connect your accounts.'
        : result.error || `Failed to set up ${appName} connection`;

      return {
        success: false,
        error: userFriendlyError
      };
    }
  } catch (error) {
    console.error('Error generating connection setup URL:', error);
    const userFriendlyError = error instanceof Error && error.message.includes('Authentication required')
      ? 'Please sign in to connect your accounts.'
      : `Unable to connect to ${appName} right now. Please try again later.`;
    return {
      success: false,
      error: userFriendlyError
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

    // AIDEV-NOTE: Agents no longer have tools at agent-level
    // Tools are defined per-task (in skills and schedules)
    // Always return valid since connection validation is per-task now
    return {
      success: true,
      data: {
        valid: true,
        warnings: [],
        missingConnections: [],
        toolStatuses: []
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

/**
 * Get available apps from database for connection management (paginated)
 * Returns OAuth-enabled apps that users can connect to
 */
export async function getAvailableAppsPaginated(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<Result<{
  apps: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
  }>;
  total: number;
  hasMore: boolean;
}>> {
  try {
    // Import here to avoid circular dependencies
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { appTypes } = await import('@/lib/db/schema');
    const { eq, sql, ilike, or } = await import('drizzle-orm');
    const { parseConnectionString } = await import('@/lib/db/client-parser');

    const rawConnectionString = process.env.DATABASE_URL;
    if (!rawConnectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Parse AWS RDS secret JSON into connection string if needed
    const connectionString = parseConnectionString(rawConnectionString);
    const client = postgres(connectionString, { max: 1 });
    const db = drizzle(client);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const search = options?.search;

    console.log(`[ConnectionActions] Loading available apps from database (limit: ${limit}, offset: ${offset}, search: ${search || 'none'})`);

    // Build query conditions
    let conditions = eq(appTypes.supportsOAuth, true);

    // Add search filter if provided
    if (search) {
      conditions = sql`${appTypes.supportsOAuth} = true AND (${ilike(appTypes.name, `%${search}%`)} OR ${ilike(appTypes.description, `%${search}%`)})`;
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(appTypes)
      .where(conditions);

    const total = Number(countResult[0]?.count || 0);

    // Get paginated apps
    const apps = await db
      .select({
        id: appTypes.id,
        name: appTypes.name,
        description: appTypes.description,
        category: appTypes.category,
        iconUrl: appTypes.iconUrl,
      })
      .from(appTypes)
      .where(conditions)
      .orderBy(appTypes.name)
      .limit(limit)
      .offset(offset);

    console.log(`[ConnectionActions] Found ${apps.length} of ${total} available apps`);

    // Map to expected format
    const availableApps = apps.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description || `Connect to ${app.name}`,
      category: app.category || 'other',
      icon: app.iconUrl || `/icons/${app.id}.svg`,
    }));

    await client.end();

    return {
      success: true,
      data: {
        apps: availableApps,
        total,
        hasMore: offset + apps.length < total
      }
    };

  } catch (error) {
    console.error('[ConnectionActions] Error getting available apps:', error);
    return {
      success: false,
      error: 'Failed to get available apps'
    };
  }
}

/**
 * Get available apps from database for connection management
 * Returns OAuth-enabled apps that users can connect to
 * @deprecated Use getAvailableAppsPaginated for better performance with large app lists
 */
export async function getAvailableApps(): Promise<Result<Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}>>> {
  try {
    // Import here to avoid circular dependencies
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { appTypes } = await import('@/lib/db/schema');
    const { eq, or } = await import('drizzle-orm');
    const { parseConnectionString } = await import('@/lib/db/client-parser');

    const rawConnectionString = process.env.DATABASE_URL;
    if (!rawConnectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Parse AWS RDS secret JSON into connection string if needed
    const connectionString = parseConnectionString(rawConnectionString);
    const client = postgres(connectionString, { max: 1 });
    const db = drizzle(client);

    console.log('[ConnectionActions] Loading available apps from database...');

    // Get OAuth-enabled apps AND system apps (like "emery")
    const apps = await db
      .select({
        id: appTypes.id,
        name: appTypes.name,
        description: appTypes.description,
        category: appTypes.category,
        iconUrl: appTypes.iconUrl,
      })
      .from(appTypes)
      .where(or(eq(appTypes.supportsOAuth, true), eq(appTypes.category, 'system')))
      .orderBy(appTypes.name);

    console.log(`[ConnectionActions] Found ${apps.length} available apps`);

    // Map to expected format
    const availableApps = apps.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description || `Connect to ${app.name}`,
      category: app.category || 'other',
      icon: app.iconUrl || `/icons/${app.id}.svg`,
    }));

    await client.end();

    return {
      success: true,
      data: availableApps
    };

  } catch (error) {
    console.error('[ConnectionActions] Error getting available apps:', error);
    return {
      success: false,
      error: 'Failed to get available apps'
    };
  }
}