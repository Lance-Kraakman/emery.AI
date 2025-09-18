// AIDEV-NOTE: Connection Repository Interface - defines contract for connection data access
// Domain layer interface - implementation details handled in infrastructure layer

import { Connection } from '../entities/connection';
import { ConnectionId, AppName } from '../value-objects';
import { UserId } from '@/src/ddd/domain/shared/value-objects';

export interface IConnectionRepository {
  /**
   * Get all active connections for a user (fetched live from external provider)
   */
  findByUserId(userId: UserId): Promise<Connection[]>;
  
  /**
   * Get connection for specific app (returns null if not connected)
   */
  findByUserAndApp(userId: UserId, appName: AppName): Promise<Connection | null>;
  
  /**
   * Generate OAuth connection URL for connecting an app
   */
  generateConnectionUrl(userId: UserId, appName: AppName, redirectUrl?: string): Promise<string>;
  
  /**
   * Disconnect specific connection by ID
   */
  disconnect(connectionId: ConnectionId): Promise<void>;
  
  /**
   * Check if user has active connection for app (used by agent validation)
   */
  hasActiveConnection(userId: UserId, appName: AppName): Promise<boolean>;
}