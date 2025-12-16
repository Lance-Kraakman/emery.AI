'use server'

import { revalidatePath } from "next/cache";
import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission } from "./permissions";
import { container } from "@/ddd/application/di/container";
import type { CredentialDelegationApplicationService } from "@/ddd/application/services/delegations/credential-delegation-application-service";
import type { ConnectionApplicationService } from "@/ddd/application/services/connections/connection-application-service";
import { AgentId, UserId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';
import { DelegationId } from '@/ddd/domain/shared/value-objects';

// AIDEV-NOTE: Server actions for OAuth credential delegation management
// Used by AuthorizedConnectionsModal to manage which services agents can access

interface DelegationData {
  delegation: {
    id: number;
    services: string[];
    status: string;
    approvedAt?: Date | null;
    expiresAt?: Date | null;
  } | null;
  connections: Array<{
    appName: string;
    accountName: string;
    status: string;
  }>;
}

/**
 * Get agent's delegation and owner's Connections
 * Auto-creates delegation if owner has connections but no delegation exists
 */
export async function getAgentDelegation(agentId: number): Promise<{ success: boolean; data?: DelegationData; error?: string }> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:view");

      const delegationService = container.get('CredentialDelegationApplicationService') as CredentialDelegationApplicationService;
      const connectionService = container.get('ConnectionApplicationService') as ConnectionApplicationService;

      if (!delegationService || !connectionService) {
        return {
          success: false,
          error: "Delegation or connection service not available"
        };
      }

      // Get agent to find owner
      const agentRepository = container.get('IAgentRepository');
      const agent = await agentRepository?.findById(AgentId.fromNumber(agentId));

      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      // Get owner's Connections
      const connectionsResult = await connectionService.getUserConnections(agent.ownerId);

      if (!connectionsResult.success) {
        return {
          success: false,
          error: connectionsResult.error || "Failed to fetch connections"
        };
      }

      const connections = connectionsResult.data || [];

      // Get agent's current delegation
      let delegationResult = await delegationService.getDelegationForAgent(
        AgentId.fromNumber(agentId)
      );

      // Auto-create delegation if none exists but owner has connections
      if ((!delegationResult.success || !delegationResult.data) && connections.length > 0) {
        console.log(`[Delegation] Auto-creating delegation for agent ${agentId} with ${connections.length} owner connections`);

        const services = connections.map(conn => conn.appName);
        const createResult = await delegationService.createDelegation({
          ownerId: agent.ownerId,
          agentId: agent.id,
          services,
          status: 'approved' as any
        });

        if (createResult.success && createResult.data) {
          // Use the newly created delegation directly (no need to re-fetch)
          delegationResult = createResult;
        }
      }

      // Format delegation data
      const delegationData = delegationResult.success && delegationResult.data ? {
        id: delegationResult.data.id.value,
        services: delegationResult.data.services.map(s => s.value),
        status: delegationResult.data.status,
        approvedAt: delegationResult.data.approvedAt || null,
        expiresAt: delegationResult.data.expiresAt || null
      } : null;

      // Format connections data
      const connectionsData = connections.map(conn => ({
        appName: conn.appName.value,
        accountName: conn.accountName,
        status: conn.status
      }));

      return {
        success: true,
        data: {
          delegation: delegationData,
          connections: connectionsData
        }
      };
    } catch (error) {
      console.error("Error getting agent delegation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get delegation"
      };
    }
  });
}

/**
 * Update which OAuth services are delegated to an agent
 * Creates delegation if it doesn't exist
 */
export async function updateAgentDelegationServices(
  agentId: number,
  services: string[]
): Promise<{ success: boolean; error?: string }> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");

      const delegationService = container.get('CredentialDelegationApplicationService') as CredentialDelegationApplicationService;

      if (!delegationService) {
        return {
          success: false,
          error: "Delegation service not available"
        };
      }

      // Get current delegation
      let currentResult = await delegationService.getDelegationForAgent(
        AgentId.fromNumber(agentId)
      );

      let result;

      if (!currentResult.success || !currentResult.data) {
        // No delegation exists - create one
        console.log(`[Delegation] Creating new delegation for agent ${agentId} with ${services.length} services`);

        const agentRepository = container.get('IAgentRepository');
        const agent = await agentRepository?.findById(AgentId.fromNumber(agentId));

        if (!agent) {
          return {
            success: false,
            error: "Agent not found"
          };
        }

        // Create new delegation with specified services
        result = await delegationService.createDelegation({
          ownerId: agent.ownerId,
          agentId: agent.id,
          services: services.map(s => AppName.fromString(s)),
          status: 'approved' as any
        });
      } else {
        // Update existing delegation services
        console.log(`[Delegation] Updating delegation for agent ${agentId} to ${services.length} services`);

        result = await delegationService.updateDelegationServices(
          currentResult.data.id,
          services.map(s => AppName.fromString(s))
        );
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to update delegation"
        };
      }

      // Revalidate agent page
      revalidatePath(`/agents/${agentId}`);
      revalidatePath('/agents');

      return {
        success: true
      };
    } catch (error) {
      console.error("Error updating agent delegation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update delegation"
      };
    }
  });
}

/**
 * Revoke all OAuth delegations for an agent
 */
export async function revokeAgentDelegation(agentId: number): Promise<{ success: boolean; error?: string }> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");

      const delegationService = container.get('CredentialDelegationApplicationService') as CredentialDelegationApplicationService;

      if (!delegationService) {
        return {
          success: false,
          error: "Delegation service not available"
        };
      }

      // Get current delegation
      const currentResult = await delegationService.getDelegationForAgent(
        AgentId.fromNumber(agentId)
      );

      if (!currentResult.success || !currentResult.data) {
        // No delegation exists - nothing to revoke, consider it success
        console.log(`[Delegation] No delegation found for agent ${agentId}, nothing to revoke`);
        return {
          success: true
        };
      }

      // Revoke delegation
      console.log(`[Delegation] Revoking delegation for agent ${agentId}`);

      const result = await delegationService.revokeDelegation(
        currentResult.data.id
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to revoke delegation"
        };
      }

      // Revalidate agent page
      revalidatePath(`/agents/${agentId}`);
      revalidatePath('/agents');

      return {
        success: true
      };
    } catch (error) {
      console.error("Error revoking agent delegation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke delegation"
      };
    }
  });
}

/**
 * Get delegation count for agent (for status badge)
 */
export async function getAgentDelegationCount(agentId: number): Promise<number> {
  try {
    const delegationService = container.get('CredentialDelegationApplicationService') as CredentialDelegationApplicationService;

    if (!delegationService) {
      return 0;
    }

    const result = await delegationService.getDelegationForAgent(
      AgentId.fromNumber(agentId)
    );

    if (!result.success || !result.data) {
      return 0;
    }

    return result.data.services.length;
  } catch (error) {
    console.error("Error getting delegation count:", error);
    return 0;
  }
}
