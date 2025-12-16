// AIDEV-NOTE: Pipedream Connection Repository Implementation - handles all Pipedream API interactions
// Infrastructure layer - implements domain repository interface using Pipedream Connect API

import { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import { Connection, ConnectionStatus } from '@/ddd/domain/connections/entities/connection';
import { ConnectionId, AppName, ConnectionPaginationOptions, PaginatedResult } from '@/ddd/domain/connections/value-objects';
import { UserId } from '@/ddd/domain/shared/value-objects';
import { pipedreamClient, getExternalUserId } from '@/lib/pipedream/client';
import { PipedreamConnectionMapper } from './connection-mapper';

export class PipedreamConnectionRepository implements IConnectionRepository {
  
  async findByUserId(userId: UserId): Promise<Connection[]> {
    try {
      if (!pipedreamClient) {
        console.error('[ConnectionRepo] Pipedream client not available');
        return [];
      }
      
      const externalUserId = getExternalUserId(userId.value);
      console.log(`[ConnectionRepo] Fetching connections for user ${userId.value} (external: ${externalUserId})`);
      
      const response = await pipedreamClient.accounts.list({ 
        external_user_id: externalUserId 
      });
      
      // Handle different response structures from Pipedream SDK
      const accounts = Array.isArray(response) ? response : (response?.data || []);
      console.log(`[ConnectionRepo] Received ${accounts.length} accounts from Pipedream`);
      console.log(`[ConnectionRepo] Raw Pipedream accounts:`, accounts.map(a => ({
        id: a.id,
        app: a.app,
        appType: typeof a.app,
        appNameSlug: a.app?.name_slug,
        status: a.status
      })));

      // Debug Google services specifically
      const googleAccounts = accounts.filter(a =>
        (typeof a.app === 'string' && a.app.includes('google')) ||
        (typeof a.app === 'object' && a.app?.name_slug?.includes('google'))
      );
      if (googleAccounts.length > 0) {
        console.log(`[ConnectionRepo] 🔍 Found ${googleAccounts.length} Google service accounts:`,
          googleAccounts.map(a => ({
            id: a.id,
            app: a.app,
            name_slug: a.app?.name_slug,
            status: a.status
          }))
        );
      }
      
      return accounts
        .filter(account => {
          const isValid = PipedreamConnectionMapper.isValidPipedreamAccount(account);
          if (!isValid) {
            console.warn(`[ConnectionRepo] Skipping invalid account:`, account);
          }
          return isValid;
        })
        .map(account => {
          try {
            console.log(`[ConnectionRepo] Mapping account ${account.id} for app '${account.app}'`);
            const domainEntity = PipedreamConnectionMapper.toDomainEntity(userId, account);
            console.log(`[ConnectionRepo] Successfully mapped to domain entity: app='${domainEntity.appName.value}', status='${domainEntity.status}'`);
            return domainEntity;
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[ConnectionRepo] Failed to map account ${account.id} for app '${account.app}':`, errorMessage);
            console.error(`[ConnectionRepo] Raw account data:`, account);
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
      console.log(`[ConnectionRepo] Fetching paginated connections for user ${userId.value} (limit: ${options.limit}, after: ${options.after || 'none'})`);

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

      console.log(`[ConnectionRepo] Received ${accounts.length} accounts from Pipedream (hasMore: ${hasMore}, nextCursor: ${nextCursor || 'none'})`);

      // Map and filter accounts to domain entities
      const connections = accounts
        .filter(account => {
          const isValid = PipedreamConnectionMapper.isValidPipedreamAccount(account);
          if (!isValid) {
            console.warn(`[ConnectionRepo] Skipping invalid account:`, account);
          }
          return isValid;
        })
        .map(account => {
          try {
            return PipedreamConnectionMapper.toDomainEntity(userId, account);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[ConnectionRepo] Failed to map account ${account.id}:`, errorMessage);
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

    // Enhanced debugging for connection matching
    console.log(`[ConnectionRepo] Looking for ${appName.value} connection for user ${userId.value}`);
    console.log(`[ConnectionRepo] Available connections: [${connections.map(c => `${c.appName.value}:${c.status}`).join(', ')}]`);

    const connection = connections.find(conn => {
      const matches = conn.appName.value === appName.value;
      console.log(`[ConnectionRepo] Comparing '${conn.appName.value}' === '${appName.value}': ${matches}`);
      return matches;
    });

    if (connection) {
      console.log(`[ConnectionRepo] Found ${appName.value} connection for user ${userId.value}: ${connection.accountName} (status: ${connection.status})`);
    } else {
      console.log(`[ConnectionRepo] No ${appName.value} connection found for user ${userId.value}`);
    }

    return connection || null;
  }
  
  async generateConnectionUrl(userId: UserId, appName: AppName, redirectUrl?: string): Promise<string> {
    try {
      if (!pipedreamClient) {
        throw new Error('Pipedream client not available');
      }
      
      const externalUserId = getExternalUserId(userId.value);
      console.log(`[ConnectionRepo] Generating connection URL for user ${userId.value}, app ${appName.value}`);

      // Enhanced debug logging for Google Sheets issues
      if (appName.value === 'google-sheets') {
        console.log(`[ConnectionRepo] 🔍 GOOGLE SHEETS DEBUG - Starting token creation`);
        console.log(`[ConnectionRepo] 🔍 External user ID: ${externalUserId}`);
        console.log(`[ConnectionRepo] 🔍 Redirect URL: ${redirectUrl}`);
      }

      const tokenResult = await pipedreamClient.tokens.create({
        external_user_id: externalUserId,
        allowed_origins: ['http://localhost:3000', 'http://localhost:3002'],
        success_redirect_uri: redirectUrl,
      });

      // Enhanced debug logging for Google Sheets
      if (appName.value === 'google-sheets') {
        console.log(`[ConnectionRepo] 🔍 GOOGLE SHEETS DEBUG - Token result:`, JSON.stringify(tokenResult, null, 2));
      }
      
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

      const finalUrl = connectUrl.toString();

      // Enhanced debug logging for Google Sheets
      if (appName.value === 'google-sheets') {
        console.log(`[ConnectionRepo] 🔍 GOOGLE SHEETS DEBUG - Base URL: ${baseConnectUrl}`);
        console.log(`[ConnectionRepo] 🔍 GOOGLE SHEETS DEBUG - Final URL: ${finalUrl}`);
        console.log(`[ConnectionRepo] 🔍 GOOGLE SHEETS DEBUG - App param: ${appName.value}`);
      } else {
        console.log(`[ConnectionRepo] Generated connection URL: ${finalUrl.substring(0, 100)}...`);
      }

      return finalUrl;
      
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
      
      console.log(`[ConnectionRepo] Disconnecting connection ${connectionId.value}`);
      
      // Try SDK method first (preferred)
      try {
        const result = await (pipedreamClient.accounts as any).delete(connectionId.value);
        console.log(`[ConnectionRepo] Successfully disconnected ${connectionId.value} via SDK:`, result);
        return;
      } catch (sdkError) {
        console.warn(`[ConnectionRepo] SDK disconnect failed, trying direct API:`, sdkError);
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
      const isActive = connection?.status === ConnectionStatus.ACTIVE || 
                      connection?.status === ConnectionStatus.CONNECTED;
      
      console.log(`[ConnectionRepo] User ${userId.value} has active ${appName.value} connection: ${isActive}`);
      return isActive;
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
      
      console.log(`[ConnectionRepo] Direct API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ConnectionRepo] Direct API error response: ${errorText}`);
        throw new Error(`Direct API disconnect failed: ${response.status} ${errorText}`);
      }
      
      console.log(`[ConnectionRepo] Successfully disconnected ${accountId} via direct API`);
      
    } catch (error) {
      console.error(`[ConnectionRepo] Direct API disconnect error:`, error);
      throw error;
    }
  }
}