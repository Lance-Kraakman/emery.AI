// AIDEV-NOTE: Connection Entity - represents OAuth connections between users and external services
// Entity because it has identity (connectionId) and lifecycle (can be connected/disconnected)
// Fetched from Pipedream API but represents a core business concept

import { UserId } from '@/src/ddd/domain/shared/value-objects';
import { ConnectionId, AppName } from '../value-objects';

export interface Connection {
  readonly connectionId: ConnectionId;     // Unique identifier (Pipedream account ID wrapped)
  readonly userId: UserId;                 // Which user owns this connection
  readonly appName: AppName;              // Which external service (gmail, slack, etc.)
  readonly accountName: string;           // Display name (john@gmail.com, @slackuser, etc.)
  readonly status: ConnectionStatus;      // Current connection state
  readonly connectedAt: Date;            // When the connection was established
}

export enum ConnectionStatus {
  ACTIVE = 'active',
  CONNECTED = 'connected',  
  ERROR = 'error',
  EXPIRED = 'expired'
}