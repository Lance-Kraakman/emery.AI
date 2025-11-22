/**
 * Connection Domain Registration Module
 *
 * Registers services for connection domain:
 * - Connection repository (Pipedream)
 * - Connection application service
 * - OAuth proxy application service
 *
 * NOTE: These services are optional and only available when Pipedream is configured.
 * During build time or when environment variables are not set, null services are returned.
 */

import type { IConnectionRepository } from '@/ddd/domain/connections/repositories/connection-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { CredentialDelegationApplicationService } from '@/ddd/application/services/delegations/credential-delegation-application-service';

import { PipedreamConnectionRepository } from '@/ddd/infrastructure/external/pipedream/pipedream-connection-repository';
import { ConnectionApplicationService } from '@/ddd/application/services/connections/connection-application-service';
import { OAuthProxyApplicationService } from '@/ddd/application/services/connections/oauth-proxy-application-service';
import { pipedreamClient } from '@/lib/pipedream/client';

export interface ConnectionServices {
  connectionRepository: IConnectionRepository | null;
  connectionApplicationService: ConnectionApplicationService | null;
  oauthProxyApplicationService: OAuthProxyApplicationService | null;
}

export interface ConnectionDependencies {
  agentRepository: IAgentRepository;
  organizationRepository: IOrganizationRepository;
  delegationApplicationService?: CredentialDelegationApplicationService;
}

export function registerConnectionServices(deps: ConnectionDependencies): ConnectionServices {
  const { agentRepository, organizationRepository, delegationApplicationService } = deps;

  // Check if Pipedream client is available
  if (!pipedreamClient) {
    console.warn('⚠️ Pipedream client not configured, skipping connection services registration. Set PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET for full functionality.');

    // Return null services for graceful degradation
    return {
      connectionRepository: null,
      connectionApplicationService: null,
      oauthProxyApplicationService: null
    };
  }

  // Register connection services with Pipedream
  const connectionRepository = new PipedreamConnectionRepository();
  const connectionApplicationService = new ConnectionApplicationService(connectionRepository, organizationRepository);
  const oauthProxyApplicationService = new OAuthProxyApplicationService(
    agentRepository,
    pipedreamClient,
    delegationApplicationService
  );

  console.log('✅ Connection services registered with Pipedream client' +
    (delegationApplicationService ? ' (with delegation enforcement)' : ''));

  return {
    connectionRepository,
    connectionApplicationService,
    oauthProxyApplicationService
  };
}
