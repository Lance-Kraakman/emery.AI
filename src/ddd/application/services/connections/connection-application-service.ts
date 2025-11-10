// AIDEV-NOTE: Connection Application Service - orchestrates connection business operations
// Application layer - coordinates between domain entities and infrastructure repositories

import { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import { Connection, ConnectionStatus } from '@/ddd/domain/connections/entities/connection';
import { ConnectionId, AppName, ConnectionPaginationOptions, PaginatedResult } from '@/ddd/domain/connections/value-objects';
import { UserId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('ConnectionService');

export class ConnectionApplicationService {
  constructor(
    private readonly connectionRepository: IConnectionRepository
  ) {}

  /**
   * Get all connections for a user, sorted by most recent first
   * By default returns deduplicated connections (one per app+email)
   */
  async getUserConnections(
    userId: UserId,
    options: { showAllDuplicates?: boolean } = {}
  ): Promise<Result<Connection[]>> {
    try {
      logger.debug('Getting user connections', { userId: userId.value, showAllDuplicates: options.showAllDuplicates });

      const connections = await this.connectionRepository.findByUserId(userId);

      // Sort by most recent first
      const sortedConnections = connections.sort((a, b) =>
        b.connectedAt.getTime() - a.connectedAt.getTime()
      );

      // Apply deduplication unless explicitly requested to show all
      const finalConnections = options.showAllDuplicates
        ? sortedConnections
        : this.deduplicateConnections(sortedConnections);

      logger.summary('Retrieved connections', {
        userId: userId.value,
        total: connections.length,
        returned: finalConnections.length,
        duplicatesFiltered: !options.showAllDuplicates
      });

      return { success: true, data: finalConnections };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error fetching connections for user ${userId.value}`, error);
      return {
        success: false,
        error: `Failed to fetch connections: ${errorMessage}`
      };
    }
  }

  /**
   * Get paginated connections for a user with cursor-based navigation
   * Optimized for large connection lists with incremental loading
   *
   * @param userId - User to fetch connections for
   * @param options - Pagination options (limit, cursor)
   * @param deduplicateOptions - Deduplication settings
   */
  async getUserConnectionsPaginated(
    userId: UserId,
    options: ConnectionPaginationOptions,
    deduplicateOptions: { deduplicate?: boolean } = { deduplicate: true }
  ): Promise<Result<PaginatedResult<Connection>>> {
    try {
      logger.debug('Getting paginated user connections', {
        userId: userId.value,
        limit: options.limit,
        after: options.after,
        deduplicate: deduplicateOptions.deduplicate
      });

      const paginatedResult = await this.connectionRepository.findByUserIdPaginated(userId, options);

      // Sort by most recent first
      const sortedConnections = paginatedResult.data.sort((a, b) =>
        b.connectedAt.getTime() - a.connectedAt.getTime()
      );

      // Apply deduplication if requested
      const finalConnections = deduplicateOptions.deduplicate
        ? this.deduplicateConnections(sortedConnections)
        : sortedConnections;

      logger.summary('Retrieved paginated connections', {
        userId: userId.value,
        fetched: paginatedResult.data.length,
        returned: finalConnections.length,
        hasMore: paginatedResult.hasMore,
        nextCursor: paginatedResult.nextCursor,
        duplicatesFiltered: deduplicateOptions.deduplicate
      });

      return {
        success: true,
        data: {
          data: finalConnections,
          nextCursor: paginatedResult.nextCursor,
          hasMore: paginatedResult.hasMore,
          totalCount: paginatedResult.totalCount
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error fetching paginated connections for user ${userId.value}`, error);
      return {
        success: false,
        error: `Failed to fetch paginated connections: ${errorMessage}`
      };
    }
  }

  /**
   * Deduplicate connections by keeping only the most recent connection per app+email combination
   * AIDEV-NOTE: This solves the multiple Gmail connections issue by filtering duplicates
   */
  private deduplicateConnections(connections: Connection[]): Connection[] {
    const connectionMap = new Map<string, Connection>();

    for (const connection of connections) {
      // Create a unique key based on app name and account name (email)
      const deduplicationKey = `${connection.appName.value}:${connection.accountName}`.toLowerCase();

      const existing = connectionMap.get(deduplicationKey);
      if (!existing || connection.connectedAt > existing.connectedAt) {
        // Keep the most recent connection for this app+email combination
        connectionMap.set(deduplicationKey, connection);
      }
    }

    const deduplicatedConnections = Array.from(connectionMap.values());

    // Log deduplication stats for debugging
    const originalCount = connections.length;
    const deduplicatedCount = deduplicatedConnections.length;
    const duplicatesRemoved = originalCount - deduplicatedCount;

    if (duplicatesRemoved > 0) {
      logger.summary('Deduplicated connections', {
        original: originalCount,
        deduplicated: deduplicatedCount,
        removed: duplicatesRemoved
      });

      // Log details of duplicates for debugging
      const duplicateGroups = new Map<string, number>();
      for (const connection of connections) {
        const key = `${connection.appName.value}:${connection.accountName}`.toLowerCase();
        duplicateGroups.set(key, (duplicateGroups.get(key) || 0) + 1);
      }

      for (const [key, count] of duplicateGroups) {
        if (count > 1) {
          logger.debug('Duplicate group found', { key, count });
        }
      }
    }

    return deduplicatedConnections;
  }

  /**
   * Get all connections including duplicates (for debugging and power users)
   * AIDEV-NOTE: This allows viewing all Pipedream account instances when needed
   */
  async getAllConnectionsWithDuplicates(userId: UserId): Promise<Result<{
    connections: Connection[];
    duplicateCount: number;
    duplicateGroups: Array<{ key: string; count: number; connections: Connection[] }>;
  }>> {
    try {
      const result = await this.getUserConnections(userId, { showAllDuplicates: true });

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      const connections = result.data || [];

      // Analyze duplicate groups
      const groupMap = new Map<string, Connection[]>();
      for (const connection of connections) {
        const key = `${connection.appName.value}:${connection.accountName}`.toLowerCase();
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(connection);
      }

      // Count duplicates and create group details
      let duplicateCount = 0;
      const duplicateGroups: Array<{ key: string; count: number; connections: Connection[] }> = [];

      for (const [key, groupConnections] of groupMap) {
        if (groupConnections.length > 1) {
          duplicateCount += groupConnections.length - 1; // Count extras as duplicates
          duplicateGroups.push({
            key,
            count: groupConnections.length,
            connections: groupConnections.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime())
          });
        }
      }

      return {
        success: true,
        data: {
          connections,
          duplicateCount,
          duplicateGroups
        }
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching all connections', error);
      return {
        success: false,
        error: `Failed to fetch all connections: ${errorMessage}`
      };
    }
  }

  /**
   * Initiate OAuth connection flow for a specific app
   * Enhanced with duplicate prevention and reconnection options
   */
  async initiateConnection(
    userId: UserId,
    appName: AppName,
    redirectUrl?: string,
    options: { forceNew?: boolean; reconnectExisting?: boolean } = {}
  ): Promise<Result<{
    url: string;
    isReconnection?: boolean;
    existingConnection?: boolean;
    warningMessage?: string;
  }>> {
    try {
      logger.debug('Initiating connection', {
        userId: userId.value,
        appName: appName.value,
        forceNew: options.forceNew,
        reconnectExisting: options.reconnectExisting
      });

      // Business rule: Check if already connected and provide smart recommendations
      const existing = await this.connectionRepository.findByUserAndApp(userId, appName);
      const hasActiveConnection = existing?.status === ConnectionStatus.CONNECTED || existing?.status === ConnectionStatus.ACTIVE;

      if (hasActiveConnection && !options.forceNew) {
        logger.debug('Active connection exists', {
          userId: userId.value,
          appName: appName.value
        });

        // Check for duplicates to provide better messaging
        const allConnectionsResult = await this.getUserConnections(userId, { showAllDuplicates: true });
        const allConnections = allConnectionsResult.success ? allConnectionsResult.data || [] : [];
        const sameAppConnections = allConnections.filter(conn => conn.appName.value === appName.value);

        if (sameAppConnections.length > 1) {
          logger.debug('Multiple existing connections found', {
            appName: appName.value,
            count: sameAppConnections.length
          });
        }

        if (!options.reconnectExisting) {
          // Return existing connection info without creating new OAuth flow
          return {
            success: true,
            data: {
              url: '', // No URL needed since connection exists
              existingConnection: true,
              warningMessage: sameAppConnections.length > 1
                ? `You already have ${sameAppConnections.length} ${appName.value} connections. Consider managing duplicates instead of adding more.`
                : `You already have an active ${appName.value} connection. Do you want to reconnect or add a new account?`
            }
          };
        }
      }

      // Generate OAuth URL (for new connections or forced reconnections)
      const connectionUrl = await this.connectionRepository.generateConnectionUrl(
        userId,
        appName,
        redirectUrl
      );

      const isReconnection = hasActiveConnection && (options.reconnectExisting || options.forceNew);

      logger.summary('Generated connection URL', {
        appName: appName.value,
        type: isReconnection ? 'reconnection' : 'new'
      });

      return {
        success: true,
        data: {
          url: connectionUrl,
          isReconnection,
          existingConnection: false
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error initiating ${appName.value} connection`, error);
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
      logger.debug('Disconnecting connection', { connectionId: connectionId.value });

      await this.connectionRepository.disconnect(connectionId);

      logger.summary('Disconnected connection', { connectionId: connectionId.value });

      return { success: true, data: undefined };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error disconnecting ${connectionId.value}`, error);
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
      // First get all user connections for debugging
      const allConnections = await this.connectionRepository.findByUserId(userId);
      const activeConnections = allConnections
        .filter(conn => conn.status === ConnectionStatus.ACTIVE || conn.status === ConnectionStatus.CONNECTED)
        .map(conn => conn.appName.value);

      const hasConnection = await this.connectionRepository.hasActiveConnection(userId, appName);

      logger.debug('Checked app availability', {
        userId: userId.value,
        appName: appName.value,
        hasConnection,
        activeApps: activeConnections
      });

      return hasConnection;
    } catch (error) {
      logger.error(`Error checking app availability for ${appName.value}`, error);
      return false;
    }
  }

  /**
   * Business logic: Get list of missing connections for required apps
   * Used for agent validation and user notifications
   */
  async getMissingConnections(userId: UserId, requiredApps: string[]): Promise<AppName[]> {
    try {
      logger.debug('Checking missing connections', {
        userId: userId.value,
        requiredApps
      });

      const connections = await this.connectionRepository.findByUserId(userId);
      const connectedApps = connections
        .filter(conn => conn.status === ConnectionStatus.ACTIVE || conn.status === ConnectionStatus.CONNECTED)
        .map(conn => conn.appName.value);

      const missingApps = requiredApps
        .filter(app => {
          // Check if the required app is connected either directly or through normalization
          try {
            const normalizedRequired = AppName.fromString(app);
            const isConnected = connectedApps.some(connectedApp => {
              try {
                const normalizedConnected = AppName.fromString(connectedApp);
                return normalizedRequired.equals(normalizedConnected);
              } catch (normError) {
                logger.debug('Failed to normalize connected app', { connectedApp, error: normError });
                return false;
              }
            });
            return !isConnected; // Return true if missing (not connected)
          } catch (error) {
            logger.debug('Failed to normalize required app', { app, error });
            return true; // If normalization fails, consider it missing
          }
        })
        // AIDEV-NOTE: Removed hardcoded getAllSupported() filter - all apps from database are valid
        .map(app => {
          try {
            return AppName.fromString(app);
          } catch (error) {
            logger.debug('Failed to create AppName', { app, error });
            return null;
          }
        })
        .filter((app): app is AppName => app !== null);

      logger.summary('Missing connections check complete', {
        userId: userId.value,
        required: requiredApps.length,
        missing: missingApps.length,
        missingApps: missingApps.map(app => app.value)
      });

      return missingApps;

    } catch (error) {
      logger.error('Error checking missing connections', error);
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
      logger.error(`Error getting connection status for ${appName.value}`, error);
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
      logger.error('Error getting connection summary', error);
      return {
        success: false,
        error: `Failed to get connection summary: ${errorMessage}`
      };
    }
  }
}