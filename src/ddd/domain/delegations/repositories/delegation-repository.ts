// AIDEV-NOTE: Delegation Repository Interface - defines contract for credential delegation data access
// Domain layer interface - implementation details handled in infrastructure layer
// Critical for OAuth security - controls which agents can use which credentials

import { CredentialDelegation } from '../entities/credential-delegation';
import { DelegationId, AgentId, UserId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';

export interface IDelegationRepository {
  /**
   * Find delegation by unique ID
   */
  findById(id: DelegationId): Promise<CredentialDelegation | null>;

  /**
   * Find delegation for specific agent
   * Returns null if no delegation exists (agent has no credential access)
   */
  findByAgent(agentId: AgentId): Promise<CredentialDelegation | null>;

  /**
   * Find all delegations owned by a user (for dashboard view)
   * Shows which agents are using the user's credentials
   */
  findByOwner(ownerId: UserId): Promise<CredentialDelegation[]>;

  /**
   * Check if agent has permission to use specific service
   * Critical security check before OAuth credential usage
   */
  hasPermission(agentId: AgentId, service: AppName): Promise<boolean>;

  /**
   * Create new delegation
   */
  create(delegation: CredentialDelegation): Promise<CredentialDelegation>;

  /**
   * Update existing delegation (e.g., approve, revoke, add services)
   */
  update(delegation: CredentialDelegation): Promise<CredentialDelegation>;

  /**
   * Delete delegation (revokes all access)
   */
  delete(id: DelegationId): Promise<void>;
}
