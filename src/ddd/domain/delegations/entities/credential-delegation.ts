// AIDEV-NOTE: CredentialDelegation Entity - represents permission for agents to use owner's OAuth credentials
// Entity because it has identity (delegationId) and lifecycle (can be approved/revoked)
// Critical security component - prevents unauthorized use of user credentials by agents

import { DelegationId, AgentId, UserId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';

export interface CredentialDelegation {
  readonly id: DelegationId;           // Unique delegation identifier
  readonly ownerId: UserId;            // User sharing their OAuth credentials
  readonly agentId: AgentId;           // Agent authorized to use the credentials
  readonly services: AppName[];        // Which OAuth services are delegated (gmail, slack, etc.)
  readonly status: DelegationStatus;   // Current delegation state
  readonly approvedAt?: Date;          // When the delegation was approved
  readonly expiresAt?: Date;           // Optional expiration date for time-limited access
  readonly createdAt: Date;            // When delegation request was created
  readonly updatedAt: Date;            // Last modification timestamp
}

export enum DelegationStatus {
  APPROVED = 'approved',   // Owner has approved - agent can use credentials
  PENDING = 'pending',     // Awaiting owner approval
  REVOKED = 'revoked'      // Owner revoked access - agent blocked
}
