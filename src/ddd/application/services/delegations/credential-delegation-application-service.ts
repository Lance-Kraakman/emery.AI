// AIDEV-NOTE: Credential Delegation Application Service - orchestrates OAuth delegation operations
// Application layer - coordinates credential delegation between agents and owners
// Critical security component - enforces permission checks for credential usage

import { IDelegationRepository } from '@/ddd/domain/delegations/repositories/delegation-repository';
import { CredentialDelegation, DelegationStatus } from '@/ddd/domain/delegations/entities/credential-delegation';
import { DelegationId, AgentId, UserId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('DelegationService');

export interface CreateDelegationDTO {
  ownerId: UserId;
  agentId: AgentId;
  services: AppName[];
  status?: DelegationStatus;
  expiresAt?: Date;
}

export class CredentialDelegationApplicationService {
  constructor(
    private readonly delegationRepository: IDelegationRepository
  ) {}

  /**
   * Create new credential delegation
   *
   * SECURITY: Delegations start as PENDING by default and require explicit approval
   * to prevent unauthorized credential access.
   */
  async createDelegation(dto: CreateDelegationDTO): Promise<Result<CredentialDelegation>> {
    try {
      logger.debug('Creating delegation', {
        ownerId: dto.ownerId.value,
        agentId: dto.agentId.value,
        services: dto.services.map(s => s.value)
      });

      // Check if delegation already exists
      const existing = await this.delegationRepository.findByAgent(dto.agentId);
      if (existing) {
        return {
          success: false,
          error: `Delegation already exists for agent ${dto.agentId.value}. Use update instead.`
        };
      }

      // SECURITY: Default to PENDING status - require explicit approval
      const status = dto.status ?? DelegationStatus.PENDING;
      const approvedAt = status === DelegationStatus.APPROVED ? new Date() : undefined;

      // Create delegation entity
      const delegation: CredentialDelegation = {
        id: DelegationId.newEntity(),
        ownerId: dto.ownerId,
        agentId: dto.agentId,
        services: dto.services,
        status,
        approvedAt,
        expiresAt: dto.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const created = await this.delegationRepository.create(delegation);

      logger.summary('Delegation created', {
        delegationId: created.id.value,
        agentId: created.agentId.value,
        status: created.status
      });

      return { success: true, data: created };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating delegation', error);
      return {
        success: false,
        error: `Failed to create delegation: ${errorMessage}`
      };
    }
  }

  /**
   * Approve a pending credential delegation
   *
   * SECURITY: Only the credential owner can approve delegations
   */
  async approveDelegation(delegationId: DelegationId): Promise<Result<CredentialDelegation>> {
    try {
      logger.debug('Approving delegation', { delegationId: delegationId.value });

      const delegation = await this.delegationRepository.findById(delegationId);
      if (!delegation) {
        return {
          success: false,
          error: `Delegation ${delegationId.value} not found`
        };
      }

      if (delegation.status === DelegationStatus.APPROVED) {
        return {
          success: false,
          error: 'Delegation is already approved'
        };
      }

      if (delegation.status === DelegationStatus.REVOKED) {
        return {
          success: false,
          error: 'Cannot approve a revoked delegation'
        };
      }

      // Update status to approved
      const approved: CredentialDelegation = {
        ...delegation,
        status: DelegationStatus.APPROVED,
        approvedAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.delegationRepository.update(approved);

      logger.summary('Delegation approved', {
        delegationId: delegationId.value,
        agentId: delegation.agentId.value
      });

      return { success: true, data: result };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error approving delegation', error);
      return {
        success: false,
        error: `Failed to approve delegation: ${errorMessage}`
      };
    }
  }

  /**
   * Check if agent has permission to use specific service
   * Critical security check called before OAuth credential usage
   */
  async checkDelegation(agentId: AgentId, service: AppName): Promise<boolean> {
    try {
      logger.debug('Checking delegation permission', {
        agentId: agentId.value,
        service: service.value
      });

      const hasPermission = await this.delegationRepository.hasPermission(agentId, service);

      logger.debug('Permission check result', {
        agentId: agentId.value,
        service: service.value,
        hasPermission
      });

      return hasPermission;

    } catch (error: unknown) {
      logger.error('Error checking delegation', error);
      return false; // Fail closed - deny access on error
    }
  }

  /**
   * Revoke credential delegation
   * Agent immediately loses access to owner's credentials
   */
  async revokeDelegation(delegationId: DelegationId): Promise<Result<void>> {
    try {
      logger.debug('Revoking delegation', { delegationId: delegationId.value });

      const delegation = await this.delegationRepository.findById(delegationId);
      if (!delegation) {
        return {
          success: false,
          error: `Delegation ${delegationId.value} not found`
        };
      }

      // Update status to revoked
      const revoked: CredentialDelegation = {
        ...delegation,
        status: DelegationStatus.REVOKED,
        updatedAt: new Date()
      };

      await this.delegationRepository.update(revoked);

      logger.summary('Delegation revoked', {
        delegationId: delegationId.value,
        agentId: delegation.agentId.value
      });

      return { success: true, data: undefined };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error revoking delegation', error);
      return {
        success: false,
        error: `Failed to revoke delegation: ${errorMessage}`
      };
    }
  }

  /**
   * Delete credential delegation completely
   */
  async deleteDelegation(delegationId: DelegationId): Promise<Result<void>> {
    try {
      logger.debug('Deleting delegation', { delegationId: delegationId.value });

      await this.delegationRepository.delete(delegationId);

      logger.summary('Delegation deleted', { delegationId: delegationId.value });

      return { success: true, data: undefined };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error deleting delegation', error);
      return {
        success: false,
        error: `Failed to delete delegation: ${errorMessage}`
      };
    }
  }

  /**
   * Get all delegations for an owner
   * Shows which agents are using the owner's credentials
   */
  async getDelegationsForOwner(ownerId: UserId): Promise<Result<CredentialDelegation[]>> {
    try {
      logger.debug('Getting delegations for owner', { ownerId: ownerId.value });

      const delegations = await this.delegationRepository.findByOwner(ownerId);

      logger.summary('Retrieved owner delegations', {
        ownerId: ownerId.value,
        count: delegations.length
      });

      return { success: true, data: delegations };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting owner delegations', error);
      return {
        success: false,
        error: `Failed to get delegations: ${errorMessage}`
      };
    }
  }

  /**
   * Get delegation for specific agent
   */
  async getDelegationForAgent(agentId: AgentId): Promise<Result<CredentialDelegation | null>> {
    try {
      logger.debug('Getting delegation for agent', { agentId: agentId.value });

      const delegation = await this.delegationRepository.findByAgent(agentId);

      logger.debug('Retrieved agent delegation', {
        agentId: agentId.value,
        found: !!delegation
      });

      return { success: true, data: delegation };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error getting agent delegation', error);
      return {
        success: false,
        error: `Failed to get delegation: ${errorMessage}`
      };
    }
  }

  /**
   * Update delegation services
   * Modify which OAuth services the agent can access
   */
  async updateDelegationServices(
    delegationId: DelegationId,
    services: AppName[]
  ): Promise<Result<CredentialDelegation>> {
    try {
      logger.debug('Updating delegation services', {
        delegationId: delegationId.value,
        services: services.map(s => s.value)
      });

      const delegation = await this.delegationRepository.findById(delegationId);
      if (!delegation) {
        return {
          success: false,
          error: `Delegation ${delegationId.value} not found`
        };
      }

      const updated: CredentialDelegation = {
        ...delegation,
        services,
        updatedAt: new Date()
      };

      const result = await this.delegationRepository.update(updated);

      logger.summary('Delegation services updated', {
        delegationId: delegationId.value,
        serviceCount: services.length
      });

      return { success: true, data: result };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error updating delegation services', error);
      return {
        success: false,
        error: `Failed to update delegation: ${errorMessage}`
      };
    }
  }
}
