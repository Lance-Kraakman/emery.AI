// AIDEV-NOTE: Pipedream Connection Mapper - converts Pipedream API responses to domain entities
// Infrastructure layer component - knows about Pipedream API structure and maps to clean domain objects

import { Connection, ConnectionStatus } from '@/ddd/domain/connections/entities/connection';
import { ConnectionId, AppName } from '@/ddd/domain/connections/value-objects';
import { UserId } from '@/ddd/domain/shared/value-objects';

export class PipedreamConnectionMapper {
  /**
   * Convert Pipedream account response to domain Connection entity
   */
  static toDomainEntity(userId: UserId, pipedreamAccount: any): Connection {
    return {
      connectionId: ConnectionId.fromPipedreamId(pipedreamAccount.id),
      userId,
      appName: AppName.fromString(pipedreamAccount.app),
      status: this.mapStatus(pipedreamAccount.status),
      accountName: this.extractAccountName(pipedreamAccount),
      connectedAt: new Date(pipedreamAccount.created_at || Date.now())
    };
  }
  
  /**
   * Map Pipedream status strings to domain enum
   */
  private static mapStatus(pipedreamStatus: string): ConnectionStatus {
    if (!pipedreamStatus) {
      return ConnectionStatus.ERROR;
    }
    
    const statusMap: Record<string, ConnectionStatus> = {
      'connected': ConnectionStatus.CONNECTED,
      'active': ConnectionStatus.ACTIVE,
      'error': ConnectionStatus.ERROR,
      'expired': ConnectionStatus.EXPIRED
    };
    
    const normalizedStatus = pipedreamStatus.toLowerCase();
    return statusMap[normalizedStatus] || ConnectionStatus.ERROR;
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
   */
  static isValidPipedreamAccount(account: any): boolean {
    return !!(
      account &&
      typeof account === 'object' &&
      account.id &&
      typeof account.id === 'string' &&
      account.app &&
      typeof account.app === 'string'
    );
  }
  
  /**
   * Check if account status indicates an active/usable connection
   */
  static isActiveConnection(pipedreamAccount: any): boolean {
    const status = pipedreamAccount?.status?.toLowerCase();
    return status === 'connected' || status === 'active';
  }
}