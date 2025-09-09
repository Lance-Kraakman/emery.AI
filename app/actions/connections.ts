'use server'

// AIDEV-NOTE: Connection Server Actions - DDD-based replacement for app/actions/pipedream.ts  
// Provides same interface for frontend components but uses new DDD architecture

import { requireAuth } from "./permissions";
import { getConnectionApplicationService } from "@/ddd/application/di/container";
import { UserId } from "@/ddd/domain/shared/value-objects";
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