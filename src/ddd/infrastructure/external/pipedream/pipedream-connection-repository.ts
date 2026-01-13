// AIDEV-NOTE: Pipedream Connection Repository Implementation - handles all Pipedream API interactions
// Infrastructure layer - implements domain repository interface using Pipedream Connect API

import { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import { Connection, ConnectionStatus } from '@/ddd/domain/connections/entities/connection';
import { ConnectionId, AppName, ConnectionPaginationOptions, PaginatedResult } from '@/ddd/domain/connections/value-objects';
import { UserId } from '@/ddd/domain/shared/value-objects';
import { pipedreamClient, getExternalUserId } from '@/ddd/infrastructure/external/pipedream/client';
import { PipedreamConnectionMapper } from './connection-mapper';

export class PipedreamConnectionRepository implements IConnectionRepository {
  
  async findByUserId(userId: UserId): Promise<Connection[]> {
    try {
      if (!pipedreamClient) {
        console.error('[ConnectionRepo] Pipedream client not available');
        return [];
      }
      
      const externalUserId = getExternalUserId(userId.value);

      const response = await pipedreamClient.accounts.list({
        external_user_id: externalUserId
      });

      // Handle different response structures from Pipedream SDK
      const accounts = Array.isArray(response) ? response : (response?.data || []);

      return accounts
        .filter(account => PipedreamConnectionMapper.isValidPipedreamAccount(account))
        .map(account => {
          try {
            return PipedreamConnectionMapper.toDomainEntity(userId, account);
          } catch (error: unknown) {
            console.error(`[ConnectionRepo] Failed to map account ${account.id}:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
          }
        })
        .filter((conn): conn is Connection => conn !== null);
        
    } catch (error) {
      console.error(`[ConnectionRepo] Failed to fetch connections for user ${userId.value}:`, error);
      return [];
    }
  }

  async findByUserIdPaginated(userId: UserId, options: ConnectionPaginationOptions): Promise<PaginatedResult<Connection>> {
    try {
      if (!pipedreamClient) {
        console.error('[ConnectionRepo] Pipedream client not available');
        return { data: [], hasMore: false };
      }

      const externalUserId = getExternalUserId(userId.value);

      // Build pagination parameters for Pipedream API
      const params: any = {
        external_user_id: externalUserId,
        limit: options.limit
      };

      if (options.after) {
        params.after = options.after;
      }

      if (options.before) {
        params.before = options.before;
      }

      const response = await pipedreamClient.accounts.list(params);

      // Handle different response structures from Pipedream SDK
      // Paginated responses may have { data: [], cursor: { next: string } } structure
      let accounts: any[];
      let nextCursor: string | undefined;
      let hasMore = false;

      if (Array.isArray(response)) {
        // Legacy response format - no pagination metadata
        accounts = response;
        hasMore = accounts.length >= options.limit;
      } else if (response && typeof response === 'object') {
        // Modern paginated response format
        accounts = (response as any).data || [];
        const cursor = (response as any).cursor || (response as any).page_info;
        nextCursor = cursor?.next || cursor?.next_cursor;
        hasMore = cursor?.has_more ?? (accounts.length >= options.limit);
      } else {
        accounts = [];
      }

      // Map and filter accounts to domain entities
      const connections = accounts
        .filter(account => PipedreamConnectionMapper.isValidPipedreamAccount(account))
        .map(account => {
          try {
            return PipedreamConnectionMapper.toDomainEntity(userId, account);
          } catch (error: unknown) {
            console.error(`[ConnectionRepo] Failed to map account ${account.id}:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
          }
        })
        .filter((conn): conn is Connection => conn !== null);

      return {
        data: connections,
        nextCursor,
        hasMore
      };

    } catch (error) {
      console.error(`[ConnectionRepo] Failed to fetch paginated connections for user ${userId.value}:`, error);
      return { data: [], hasMore: false };
    }
  }

  async findByUserAndApp(userId: UserId, appName: AppName): Promise<Connection | null> {
    const connections = await this.findByUserId(userId);
    const connection = connections.find(conn => conn.appName.value === appName.value);
    return connection || null;
  }
  
  async generateConnectionUrl(userId: UserId, appName: AppName, redirectUrl?: string): Promise<string> {
    try {
      if (!pipedreamClient) {
        throw new Error('Pipedream client not available');
      }
      
      const externalUserId = getExternalUserId(userId.value);

      const tokenResult = await pipedreamClient.tokens.create({
        external_user_id: externalUserId,
        allowed_origins: ['http://localhost:3000', 'http://localhost:3002'],
        success_redirect_uri: redirectUrl,
      });

      // Handle different response structures from Pipedream SDK
      const baseConnectUrl = tokenResult.connect_link_url || 
                            (tokenResult as any).connectUrl || 
                            (tokenResult as any).url ||
                            (tokenResult as any).connect_url;
      
      if (!baseConnectUrl) {
        console.error('[ConnectionRepo] No connect URL in token result:', tokenResult);
        throw new Error('No connect URL returned from Pipedream token creation');
      }
      
      // Build final connection URL with app parameter
      const connectUrl = new URL(baseConnectUrl);
      connectUrl.searchParams.set('app', appName.value);
      if (redirectUrl) {
        connectUrl.searchParams.set('success_redirect_uri', redirectUrl);
      }

      return connectUrl.toString();
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionRepo] Failed to generate connection URL for ${appName.value}:`, error);
      throw new Error(`Failed to generate connection URL for ${appName.value}: ${errorMessage}`);
    }
  }
  
  async disconnect(connectionId: ConnectionId): Promise<void> {
    try {
      if (!pipedreamClient) {
        throw new Error('Pipedream client not available');
      }
      
      // Try SDK method first (preferred)
      try {
        await (pipedreamClient.accounts as any).delete(connectionId.value);
        return;
      } catch (sdkError) {
        // Fallback to direct API call
        await this.directApiDisconnect(connectionId.value);
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ConnectionRepo] Failed to disconnect ${connectionId.value}:`, error);
      throw new Error(`Failed to disconnect connection: ${errorMessage}`);
    }
  }
  
  async hasActiveConnection(userId: UserId, appName: AppName): Promise<boolean> {
    try {
      const connection = await this.findByUserAndApp(userId, appName);
      return connection?.status === ConnectionStatus.ACTIVE ||
             connection?.status === ConnectionStatus.CONNECTED;
    } catch (error) {
      console.error(`[ConnectionRepo] Error checking active connection for ${appName.value}:`, error);
      return false;
    }
  }
  
  /**
   * Direct API fallback for disconnect when SDK method fails
   * Reuses logic from existing lib/pipedream/users.ts implementation
   */
  private async directApiDisconnect(accountId: string): Promise<void> {
    const { PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET } = process.env;
    
    if (!PIPEDREAM_PROJECT_ID || !PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET) {
      throw new Error('Missing Pipedream environment variables for direct API call');
    }
    
    try {
      const credentials = Buffer.from(`${PIPEDREAM_CLIENT_ID}:${PIPEDREAM_CLIENT_SECRET}`).toString('base64');
      
      const response = await fetch(`https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Direct API disconnect failed: ${response.status} ${errorText}`);
      }

    } catch (error) {
      throw error;
    }
  }
}