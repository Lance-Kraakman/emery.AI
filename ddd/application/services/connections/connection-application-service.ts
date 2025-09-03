// AIDEV-NOTE: Connection Application Service - orchestrates connection business operations
// Application layer - coordinates between domain entities and infrastructure repositories

import { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import { Connection, ConnectionStatus } from '@/ddd/domain/connections/entities/connection';
import { ConnectionId, AppName } from '@/ddd/domain/connections/value-objects';
import { UserId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';

export class ConnectionApplicationService {
  constructor(
    private readonly connectionRepository: IConnectionRepository
  ) {}

  /**
   * Get all connections for a user, sorted by most recent first
   */
  async getUserConnections(userId: UserId): Promise<Result<Connection[]>> {
    try {
      console.log(`[ConnectionService] Getting connections for user ${userId.value}`);
      const connections = await this.connectionRepository.findByUserId(userId);
      
      // Sort by most recent first
      const sortedConnections = connections.sort((a, b) => 
        b.connectedAt.getTime() - a.connectedAt.getTime()
      );
      
      console.log(`[ConnectionService] Found ${sortedConnections.length} connections`);
      return { success: true, data: sortedConnections };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionService] Error fetching connections for user ${userId.value}:`, error);
      return { 
        success: false, 
        error: `Failed to fetch connections: ${errorMessage}` 
      };
    }
  }

  /**
   * Initiate OAuth connection flow for a specific app
   */
  async initiateConnection(
    userId: UserId, 
    appName: AppName, 
    redirectUrl?: string
  ): Promise<Result<{ url: string }>> {
    try {
      console.log(`[ConnectionService] Initiating ${appName.value} connection for user ${userId.value}`);
      
      // Business rule: Check if already connected (log but allow reconnection)
      const existing = await this.connectionRepository.findByUserAndApp(userId, appName);
      if (existing?.status === ConnectionStatus.CONNECTED || existing?.status === ConnectionStatus.ACTIVE) {
        console.log(`[ConnectionService] User ${userId.value} already has active ${appName.value} connection, allowing reconnect`);
      }
      
      const connectionUrl = await this.connectionRepository.generateConnectionUrl(
        userId, 
        appName, 
        redirectUrl
      );
      
      console.log(`[ConnectionService] Generated connection URL for ${appName.value}`);
      return { success: true, data: { url: connectionUrl } };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionService] Error initiating ${appName.value} connection:`, error);
      return { 
        success: false, 
        error: `Failed to generate connection URL: ${errorMessage}` 
      };
    }
  }

  /**
   * Disconnect a specific connection
   */
  async disconnectConnection(connectionId: ConnectionId): Promise<Result<void>> {
    try {
      console.log(`[ConnectionService] Disconnecting connection ${connectionId.value}`);
      await this.connectionRepository.disconnect(connectionId);
      console.log(`[ConnectionService] Successfully disconnected ${connectionId.value}`);
      return { success: true, data: undefined };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionService] Error disconnecting ${connectionId.value}:`, error);
      return { 
        success: false, 
        error: `Failed to disconnect: ${errorMessage}` 
      };
    }
  }

  /**
   * Business logic: Check if user can use a specific app (for agent validation)
   */
  async canUseApp(userId: UserId, appName: AppName): Promise<boolean> {
    try {
      const hasConnection = await this.connectionRepository.hasActiveConnection(userId, appName);
      console.log(`[ConnectionService] User ${userId.value} can use ${appName.value}: ${hasConnection}`);
      return hasConnection;
    } catch (error) {
      console.error(`[ConnectionService] Error checking app availability for ${appName.value}:`, error);
      return false;
    }
  }

  /**
   * Business logic: Get list of missing connections for required apps
   * Used for agent validation and user notifications
   */
  async getMissingConnections(userId: UserId, requiredApps: string[]): Promise<AppName[]> {
    try {
      console.log(`[ConnectionService] Checking missing connections for user ${userId.value}:`, requiredApps);
      
      const connections = await this.connectionRepository.findByUserId(userId);
      const connectedApps = connections
        .filter(conn => conn.status === ConnectionStatus.ACTIVE || conn.status === ConnectionStatus.CONNECTED)
        .map(conn => conn.appName.value);
      
      const missingApps = requiredApps
        .filter(app => !connectedApps.includes(app))
        .filter(app => AppName.getAllSupported().includes(app)) // Only supported apps
        .map(app => {
          try {
            return AppName.fromString(app);
          } catch (error) {
            console.warn(`[ConnectionService] Skipping unsupported app: ${app}`);
            return null;
          }
        })
        .filter((app): app is AppName => app !== null);
      
      console.log(`[ConnectionService] Missing connections: ${missingApps.map(app => app.value).join(', ')}`);
      return missingApps;
      
    } catch (error) {
      console.error('[ConnectionService] Error checking missing connections:', error);
      return [];
    }
  }

  /**
   * Get connection status for a specific app (useful for UI feedback)
   */
  async getConnectionStatus(userId: UserId, appName: AppName): Promise<Result<Connection | null>> {
    try {
      const connection = await this.connectionRepository.findByUserAndApp(userId, appName);
      return { success: true, data: connection };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionService] Error getting connection status for ${appName.value}:`, error);
      return { 
        success: false, 
        error: `Failed to get connection status: ${errorMessage}` 
      };
    }
  }

  /**
   * Get summary of user's connection status (useful for dashboards)
   */
  async getConnectionSummary(userId: UserId): Promise<Result<{
    totalConnections: number;
    activeConnections: number;
    errorConnections: number;
    connectedApps: string[];
  }>> {
    try {
      const connections = await this.connectionRepository.findByUserId(userId);
      
      const summary = {
        totalConnections: connections.length,
        activeConnections: connections.filter(conn => 
          conn.status === ConnectionStatus.ACTIVE || conn.status === ConnectionStatus.CONNECTED
        ).length,
        errorConnections: connections.filter(conn => 
          conn.status === ConnectionStatus.ERROR
        ).length,
        connectedApps: connections
          .filter(conn => conn.status === ConnectionStatus.ACTIVE || conn.status === ConnectionStatus.CONNECTED)
          .map(conn => conn.appName.value)
      };
      
      return { success: true, data: summary };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionService] Error getting connection summary:`, error);
      return { 
        success: false, 
        error: `Failed to get connection summary: ${errorMessage}` 
      };
    }
  }
}