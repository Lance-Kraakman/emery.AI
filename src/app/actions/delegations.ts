'use server'

import { revalidatePath } from "next/cache";
import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission, requireAuth } from "./permissions";
import { container, getAuditApplicationService } from "@/ddd/application/di/container";
import type { CredentialDelegationApplicationService } from "@/ddd/application/services/delegations/credential-delegation-application-service";
import type { ConnectionApplicationService } from "@/ddd/application/services/connections/connection-application-service";
import { AgentId, UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';
import { DelegationId } from '@/ddd/domain/shared/value-objects';
import { getResourceAccessList, type AccessEntry } from "./resource-permissions";
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';

// Re-export AccessEntry for use in components
export type { AccessEntry };

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
      // SECURITY: Delegations must be explicitly created by the owner - no auto-creation
      const delegationResult = await delegationService.getDelegationForAgent(
        AgentId.fromNumber(agentId)
      );

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
 *
 * SECURITY: Only the agent owner (whose credentials will be used) can create/update delegations
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

      // Get the agent to verify ownership
      const agentRepository = container.get('IAgentRepository');
      const agent = await agentRepository?.findById(AgentId.fromNumber(agentId));

      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      // SECURITY: Only the agent owner can delegate their OAuth credentials
      if (agent.ownerId.value !== session.user.id) {
        console.warn(`[Delegation] User ${session.user.id} attempted to update delegation for agent ${agentId} owned by ${agent.ownerId.value}`);
        return {
          success: false,
          error: "Only the agent owner can update OAuth delegations"
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

      // Audit log the delegation update
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        agent.organizationId,
        {
          eventType: 'security',
          eventCategory: 'delegation_crud',
          eventAction: currentResult.success && currentResult.data ? 'update' : 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'delegation',
          resourceId: result.data ? String(result.data.id.value) : 'unknown',
          resourceName: agent.name,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: {
            services,
            agentId,
            agentName: agent.name,
          },
          success: true,
        }
      );

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
 *
 * SECURITY: Only the agent owner can revoke their OAuth delegations
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

      // Get the agent to verify ownership
      const agentRepository = container.get('IAgentRepository');
      const agent = await agentRepository?.findById(AgentId.fromNumber(agentId));

      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      // SECURITY: Only the agent owner can revoke their OAuth delegations
      if (agent.ownerId.value !== session.user.id) {
        console.warn(`[Delegation] User ${session.user.id} attempted to revoke delegation for agent ${agentId} owned by ${agent.ownerId.value}`);
        return {
          success: false,
          error: "Only the agent owner can revoke OAuth delegations"
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

      // Capture services before revocation for audit log
      const revokedServices = currentResult.data.services.map(s => s.value);
      const delegationId = currentResult.data.id.value;

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

      // Audit log the revocation
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        agent.organizationId,
        {
          eventType: 'security',
          eventCategory: 'delegation_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'delegation',
          resourceId: String(delegationId),
          resourceName: agent.name,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: {
            action: 'revoked_all',
            services: revokedServices,
            agentId,
            agentName: agent.name,
          },
          success: true,
        }
      );

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
 * Approve a pending delegation for an agent
 *
 * SECURITY: Only the agent owner (credential owner) can approve delegations
 */
export async function approveAgentDelegation(agentId: number): Promise<{ success: boolean; error?: string }> {
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

      // Get the agent to verify ownership
      const agentRepository = container.get('IAgentRepository');
      const agent = await agentRepository?.findById(AgentId.fromNumber(agentId));

      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      // SECURITY: Only the agent owner can approve their OAuth delegations
      if (agent.ownerId.value !== session.user.id) {
        console.warn(`[Delegation] User ${session.user.id} attempted to approve delegation for agent ${agentId} owned by ${agent.ownerId.value}`);
        return {
          success: false,
          error: "Only the agent owner can approve OAuth delegations"
        };
      }

      // Get current delegation
      const currentResult = await delegationService.getDelegationForAgent(
        AgentId.fromNumber(agentId)
      );

      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: "No delegation found for this agent"
        };
      }

      if (currentResult.data.status === 'approved') {
        return {
          success: true // Already approved
        };
      }

      // Approve delegation
      console.log(`[Delegation] Approving delegation for agent ${agentId}`);

      const result = await delegationService.approveDelegation(
        currentResult.data.id
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to approve delegation"
        };
      }

      // Audit log the approval
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        agent.organizationId,
        {
          eventType: 'security',
          eventCategory: 'delegation_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'delegation',
          resourceId: String(currentResult.data.id.value),
          resourceName: agent.name,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: {
            action: 'approved',
            services: currentResult.data.services.map(s => s.value),
            agentId,
            agentName: agent.name,
          },
          success: true,
        }
      );

      // Revalidate agent page
      revalidatePath(`/agents/${agentId}`);
      revalidatePath('/agents');

      return {
        success: true
      };
    } catch (error) {
      console.error("Error approving agent delegation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve delegation"
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

/**
 * Get RBAC access count for an agent
 * Returns the number of users/teams that have been granted access to this agent
 */
export async function getAgentAccessCount(agentId: number): Promise<{ success: boolean; count: number; error?: string }> {
  return withAuthContext(async () => {
    try {
      await requirePermission("agents:view");

      const result = await getResourceAccessList('agent', agentId);

      if (!result.success) {
        return {
          success: false,
          count: 0,
          error: result.error || "Failed to get access list"
        };
      }

      return {
        success: true,
        count: result.data?.length || 0
      };
    } catch (error) {
      console.error("Error getting agent access count:", error);
      return {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : "Failed to get access count"
      };
    }
  });
}

/**
 * Get owner's delegation summary grouped by service
 * Used by Connections page to show which agents are using which credentials
 */
export interface AgentWithAccess {
  id: number;
  name: string;
  accessList: AccessEntry[];
}

export interface DelegationSummaryItem {
  service: string;
  accountName: string;
  agents: AgentWithAccess[];
}

export async function getOwnerDelegationsSummary(): Promise<{
  success: boolean;
  data?: DelegationSummaryItem[];
  error?: string
}> {
  return withAuthContext(async () => {
    try {
      const session = await requireAuth();
      const userId = session.user.id;

      const delegationService = container.get('CredentialDelegationApplicationService') as CredentialDelegationApplicationService;
      const connectionService = container.get('ConnectionApplicationService') as ConnectionApplicationService;
      const agentRepository = container.get('IAgentRepository') as IAgentRepository;

      if (!delegationService || !connectionService) {
        return {
          success: false,
          error: "Required services not available"
        };
      }

      // Get owner's connections to get account names
      const connectionsResult = await connectionService.getUserConnections(UserId.fromString(userId));
      const connections = connectionsResult.success ? (connectionsResult.data || []) : [];

      // Create a map of service -> accountName
      const serviceAccountMap = new Map<string, string>();
      for (const conn of connections) {
        serviceAccountMap.set(conn.appName.value, conn.accountName);
      }

      // Get all delegations for this owner
      const delegationsResult = await delegationService.getDelegationsForOwner(UserId.fromString(userId));

      if (!delegationsResult.success) {
        return {
          success: false,
          error: delegationsResult.error || "Failed to get delegations"
        };
      }

      const delegations = delegationsResult.data || [];

      // Collect unique agent IDs to fetch access lists
      const agentIds = new Set<number>();
      for (const delegation of delegations) {
        if (delegation.status === 'approved') {
          agentIds.add(delegation.agentId.value);
        }
      }

      // Fetch access lists for all agents in parallel
      const accessListPromises = Array.from(agentIds).map(async (agentId) => {
        try {
          const result = await getResourceAccessList('agent', agentId);
          return { agentId, accessList: result.success ? (result.data || []) : [] };
        } catch {
          return { agentId, accessList: [] };
        }
      });
      const accessResults = await Promise.all(accessListPromises);
      const agentAccessMap = new Map(accessResults.map(r => [r.agentId, r.accessList]));

      // Group by service, collecting agents for each
      const serviceAgentsMap = new Map<string, AgentWithAccess[]>();

      for (const delegation of delegations) {
        // Skip non-approved delegations
        if (delegation.status !== 'approved') continue;

        // Get agent name and access list
        const agent = await agentRepository.findById(delegation.agentId);
        const agentInfo: AgentWithAccess = {
          id: delegation.agentId.value,
          name: agent?.name || `Agent ${delegation.agentId.value}`,
          accessList: agentAccessMap.get(delegation.agentId.value) || []
        };

        // Add to each service this delegation covers
        for (const service of delegation.services) {
          const serviceName = service.value;
          const existing = serviceAgentsMap.get(serviceName) || [];
          existing.push(agentInfo);
          serviceAgentsMap.set(serviceName, existing);
        }
      }

      // Build result array - include all connected services, even those without agents
      const result: DelegationSummaryItem[] = [];

      // Add all connected services
      for (const conn of connections) {
        const serviceName = conn.appName.value;
        result.push({
          service: serviceName,
          accountName: conn.accountName,
          agents: serviceAgentsMap.get(serviceName) || []
        });
      }

      // Sort by service name
      result.sort((a, b) => a.service.localeCompare(b.service));

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error("Error getting owner delegations summary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get delegations summary"
      };
    }
  });
}

/**
 * Revoke a specific service delegation from an agent
 * Removes just one service from the agent's delegation
 */
export async function revokeServiceFromAgent(
  agentId: number,
  service: string
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

      // Get the agent to verify ownership
      const agentRepository = container.get('IAgentRepository') as IAgentRepository;
      const agent = await agentRepository?.findById(AgentId.fromNumber(agentId));

      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      // SECURITY: Only the agent owner can modify their OAuth delegations
      if (agent.ownerId.value !== session.user.id) {
        console.warn(`[Delegation] User ${session.user.id} attempted to revoke service from agent ${agentId} owned by ${agent.ownerId.value}`);
        return {
          success: false,
          error: "Only the agent owner can modify OAuth delegations"
        };
      }

      // Get current delegation
      const currentResult = await delegationService.getDelegationForAgent(
        AgentId.fromNumber(agentId)
      );

      if (!currentResult.success || !currentResult.data) {
        // No delegation exists - nothing to revoke
        return {
          success: true
        };
      }

      // Remove the service from the list
      const updatedServices = currentResult.data.services
        .filter(s => s.value !== service)
        .map(s => AppName.fromString(s.value));

      if (updatedServices.length === 0) {
        // No services left - revoke the entire delegation
        const result = await delegationService.revokeDelegation(currentResult.data.id);
        if (!result.success) {
          return {
            success: false,
            error: result.error || "Failed to revoke delegation"
          };
        }
      } else {
        // Update with remaining services
        const result = await delegationService.updateDelegationServices(
          currentResult.data.id,
          updatedServices
        );
        if (!result.success) {
          return {
            success: false,
            error: result.error || "Failed to update delegation"
          };
        }
      }

      // Audit log the service revocation
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        agent.organizationId,
        {
          eventType: 'security',
          eventCategory: 'delegation_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'delegation',
          resourceId: String(currentResult.data.id.value),
          resourceName: agent.name,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: {
            action: 'revoked_service',
            service,
            remainingServices: updatedServices.map(s => s.value),
            agentId,
            agentName: agent.name,
          },
          success: true,
        }
      );

      // Revalidate
      revalidatePath('/connections');
      revalidatePath(`/agents/${agentId}`);

      return {
        success: true
      };
    } catch (error) {
      console.error("Error revoking service from agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke service"
      };
    }
  });
}
