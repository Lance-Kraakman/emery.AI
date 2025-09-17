// AIDEV-NOTE: Pipedream Connection Mapper - converts Pipedream API responses to domain entities
// Infrastructure layer component - knows about Pipedream API structure and maps to clean domain objects

import { Connection, ConnectionStatus } from '@/ddd/domain/connections/entities/connection';
import { ConnectionId, AppName } from '@/ddd/domain/connections/value-objects';
import { UserId } from '@/ddd/domain/shared/value-objects';

export class PipedreamConnectionMapper {
  /**
   * Convert Pipedream account response to domain Connection entity
   * AIDEV-NOTE: Updated to extract app name from account.app.name_slug structure
   */
  static toDomainEntity(userId: UserId, pipedreamAccount: any): Connection {
    // Extract app name from the actual Pipedream structure
    const appName = pipedreamAccount.app?.name_slug || pipedreamAccount.app;

    return {
      connectionId: ConnectionId.fromPipedreamId(pipedreamAccount.id),
      userId,
      appName: AppName.fromString(appName),
      status: this.mapStatus(pipedreamAccount.status),
      accountName: this.extractAccountName(pipedreamAccount),
      connectedAt: new Date(pipedreamAccount.created_at || Date.now())
    };
  }
  
  /**
   * Map Pipedream status strings to domain enum
   * AIDEV-NOTE: Updated to handle undefined status fields - treat as CONNECTED for existing accounts
   */
  private static mapStatus(pipedreamStatus: string | undefined): ConnectionStatus {
    // If status is undefined, assume it's a connected account (common for established connections)
    if (!pipedreamStatus || pipedreamStatus === undefined) {
      return ConnectionStatus.CONNECTED;
    }

    const statusMap: Record<string, ConnectionStatus> = {
      'connected': ConnectionStatus.CONNECTED,
      'active': ConnectionStatus.ACTIVE,
      'error': ConnectionStatus.ERROR,
      'expired': ConnectionStatus.EXPIRED
    };

    const normalizedStatus = pipedreamStatus.toLowerCase();
    return statusMap[normalizedStatus] || ConnectionStatus.CONNECTED;
  }
  
  /**
   * Extract display name from various Pipedream account fields
   * Pipedream accounts can have different field names depending on the service
   */
  private static extractAccountName(pipedreamAccount: any): string {
    // Try various common field names that Pipedream uses
    const possibleNames = [
      pipedreamAccount.account_name,
      pipedreamAccount.email,
      pipedreamAccount.username, 
      pipedreamAccount.name,
      pipedreamAccount.display_name,
      pipedreamAccount.user_name
    ];
    
    for (const name of possibleNames) {
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
    
    // Fallback to account ID if no display name found
    return pipedreamAccount.id || 'Unknown Account';
  }
  
  /**
   * Validate if Pipedream account has required fields for domain entity creation
   * AIDEV-NOTE: Updated to handle actual Pipedream API structure where app is an object with name_slug
   */
  static isValidPipedreamAccount(account: any): boolean {
    return !!(
      account &&
      typeof account === 'object' &&
      account.id &&
      typeof account.id === 'string' &&
      account.app &&
      typeof account.app === 'object' &&
      account.app.name_slug &&
      typeof account.app.name_slug === 'string'
    );
  }
  
  /**
   * Check if account status indicates an active/usable connection
   * AIDEV-NOTE: Updated to treat undefined status as active (for existing connections)
   */
  static isActiveConnection(pipedreamAccount: any): boolean {
    const status = pipedreamAccount?.status;

    // If status is undefined, treat as active (common for established connections)
    if (!status || status === undefined) {
      return true;
    }

    const normalizedStatus = status.toLowerCase();
    return normalizedStatus === 'connected' || normalizedStatus === 'active';
  }
}