/**
 * OAuth Proxy Application Service
 *
 * Handles OAuth proxy operations for agent API calls to external services via Pipedream.
 * Orchestrates agent lookup, credential management, and OAuth execution.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';
import { PipedreamClient } from '@pipedream/sdk';
import { oauthAuditLogger } from '@/lib/audit/oauth-audit-logger';

const logger = createDebugLogger('OAuthProxy');
import { getExternalUserIdForAgent } from '@/lib/pipedream/client';
import { ApiKey, UserId, AgentId } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { CredentialDelegationApplicationService } from '@/ddd/application/services/delegations/credential-delegation-application-service';
import { UnauthorizedCredentialUsageError } from '@/ddd/domain/delegations/errors';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export interface OAuthProxyRequest {
  service: string;
  action: string;
  params: Record<string, any>;
  api_key_mode?: 'agent' | 'user';
}

export interface OAuthProxyResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class OAuthProxyApplicationService {
  constructor(
    private agentRepository: IAgentRepository,
    private pipedreamClient: PipedreamClient | null = null,
    private delegationService?: CredentialDelegationApplicationService
  ) {}

  /**
   * Execute an OAuth API call on behalf of an agent using the agent owner's credentials
   */
  async executeAgentOAuthCall(
    agentApiKey: ApiKey,
    request: OAuthProxyRequest
  ): Promise<Result<OAuthProxyResult>> {
    try {
      // 1. Find agent by API key
      const agent = await this.agentRepository.findByApiKey(agentApiKey);
      if (!agent) {
        return ResultHelpers.failure<OAuthProxyResult>('Invalid API key');
      }

      // 2. Validate request
      if (!request.service || !request.action) {
        return ResultHelpers.failure<OAuthProxyResult>('Missing required fields: service, action');
      }

      // 3. SECURITY: Check credential delegation permission (MANDATORY)
      if (!this.delegationService) {
        logger.error('Delegation service not configured - denying OAuth call for security');
        return ResultHelpers.failure<OAuthProxyResult>('OAuth proxy requires delegation service to be configured');
      }

      const serviceAppName = AppName.fromString(request.service);
      const hasPermission = await this.delegationService.checkDelegation(
        agent.id,
        serviceAppName
      );

      if (!hasPermission) {
        const error = new UnauthorizedCredentialUsageError(
          agent.id.value,
          agent.name,
          request.service,
          agent.ownerId.value
        );
        logger.error('Unauthorized credential usage attempt', {
          agentId: agent.id.value,
          agentName: agent.name,
          service: request.service,
          ownerId: agent.ownerId.value
        });

        // AUDIT: Log unauthorized attempt
        oauthAuditLogger.logUnauthorizedAttempt({
          agentId: agent.id.value,
          agentName: agent.name,
          credentialOwnerId: agent.ownerId.value,
          service: request.service,
          reason: 'No delegation permission for this service'
        });

        return ResultHelpers.failure<OAuthProxyResult>(error.message);
      }

      logger.debug('Delegation check passed', {
        agentId: agent.id.value,
        service: request.service
      });

      // 4. Update agent last used timestamp
      await this.agentRepository.updateLastUsed(agent.id);

      console.log(`[OAUTH-PROXY] Agent ${agent.id.value} (${agent.name}) calling ${request.service}.${request.action} for user ${agent.ownerId.value}`);

      // 5. Execute OAuth call using agent owner's credentials
      const result = await this.executeWithOwnerCredentials(
        agent.ownerId,
        request.service,
        request.action,
        request.params || {}
      );

      // AUDIT: Log successful OAuth call
      oauthAuditLogger.logOAuthCall({
        agentId: agent.id.value,
        agentName: agent.name,
        credentialOwnerId: agent.ownerId.value,
        service: request.service,
        action: request.action,
        success: true
      });

      return ResultHelpers.success<OAuthProxyResult>({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('OAuth proxy error:', error);

      // AUDIT: Log failed OAuth call (if we have agent context)
      // Note: Error may occur before agent is loaded, so we can't always log agent details

      return ResultHelpers.failure<OAuthProxyResult>(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }


  /**
   * Execute an OAuth API call on behalf of a user using the user's own credentials
   */
  async executeUserOAuthCall(
    userId: UserId,
    request: OAuthProxyRequest
  ): Promise<Result<OAuthProxyResult>> {
    try {
      // 1. Validate request
      if (!request.service || !request.action) {
        return ResultHelpers.failure<OAuthProxyResult>('Missing required fields: service, action');
      }

      console.log(`[OAUTH-PROXY] User ${userId.value} calling ${request.service}.${request.action}`);

      // 2. Execute OAuth call using user's own credentials
      const result = await this.executeWithUserCredentials(
        userId,
        request.service,
        request.action,
        request.params || {}
      );

      return ResultHelpers.success<OAuthProxyResult>({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('OAuth proxy error (user mode):', error);
      return ResultHelpers.failure<OAuthProxyResult>(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Execute OAuth call using agent owner's credentials via Pipedream
   */
  private async executeWithOwnerCredentials(
    ownerId: UserId,
    service: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    if (!this.pipedreamClient) {
      throw new Error('Pipedream client not available');
    }

    const externalUserId = getExternalUserIdForAgent(ownerId.value);

    // Map service+action to correct Pipedream action ID
    const actionId = this.mapServiceActionToPipedreamId(service, action);

    if (!actionId) {
      throw new Error(`Unsupported action: ${service}.${action}`);
    }

    // Check if the user has Connections and get account ID
    let accountId: string | undefined;
    try {
      const accounts = await this.pipedreamClient.accounts.list({
        external_user_id: externalUserId
      });

      if (!accounts || !Array.isArray(accounts.data) || accounts.data.length === 0) {
        throw new Error(`No Connections found for user. Please connect ${service} in the dashboard.`);
      }

      // Find the account for this service
      const account = accounts.data.find((acc: any) => acc.app?.name_slug === service);
      if (!account) {
        throw new Error(`No ${service} connection found for user. Available: ${accounts.data.map((a: any) => a.app?.name_slug).join(', ')}`);
      }

      accountId = account.id;
    } catch (accountError) {
      console.error('[OAUTH-PROXY] Failed to list accounts:', accountError instanceof Error ? accountError.message : 'Unknown error');
      throw new Error(`Failed to check Connections: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
    }

    // Execute the action with correct Pipedream action ID
    // AIDEV-NOTE: Pipedream actions require the app connection prop (e.g., 'gmail') to be passed
    // with authProvisionId referencing the connected account
    try {
      const configuredProps = {
        ...params,
        [service]: {
          authProvisionId: accountId
        }
      };

      const result = await this.pipedreamClient.actions.run({
        id: actionId,
        external_user_id: externalUserId,
        configured_props: configuredProps,
      });

      // Check if Pipedream returned an error in the response
      // Pipedream returns errors in os array with k: "error"
      if (result.os && Array.isArray(result.os)) {
        const errorEntry = result.os.find((entry: any) => entry.k === 'error');
        if (errorEntry && errorEntry.err) {
          throw new Error(`Pipedream action failed: ${errorEntry.err.message}`);
        }
      }

      return result;

    } catch (error: any) {
      throw new Error(`${service} ${action} failed: ${error.message}`);
    }
  }

  /**
   * Execute OAuth call using user's own credentials via Pipedream
   */
  private async executeWithUserCredentials(
    userId: UserId,
    service: string,
    action: string,
    params: Record<string, any>
  ): Promise<any> {
    if (!this.pipedreamClient) {
      throw new Error('Pipedream client not available');
    }

    const externalUserId = getExternalUserIdForAgent(userId.value);

    // Map service+action to correct Pipedream action ID
    const actionId = this.mapServiceActionToPipedreamId(service, action);

    if (!actionId) {
      throw new Error(`Unsupported action: ${service}.${action}`);
    }

    // Check user's Connections and get account ID
    let accountId: string | undefined;
    try {
      const accounts = await this.pipedreamClient.accounts.list({
        external_user_id: externalUserId
      });

      if (!accounts || !Array.isArray(accounts.data) || accounts.data.length === 0) {
        throw new Error(`No Connections found for user. Please connect ${service} in the dashboard.`);
      }

      // Find the account for this service
      const account = accounts.data.find((acc: any) => acc.app?.name_slug === service);
      if (!account) {
        throw new Error(`No ${service} connection found for user. Available: ${accounts.data.map((a: any) => a.app?.name_slug).join(', ')}`);
      }

      accountId = account.id;
    } catch (accountError) {
      console.error('[OAUTH-PROXY] Failed to list user accounts:', accountError instanceof Error ? accountError.message : 'Unknown error');
      throw new Error(`Failed to check Connections: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
    }

    // Execute the action with user's credentials
    // AIDEV-NOTE: Pipedream actions require the app connection prop (e.g., 'gmail') to be passed
    // with authProvisionId referencing the connected account
    try {
      const configuredProps = {
        ...params,
        [service]: {
          authProvisionId: accountId
        }
      };

      const result = await this.pipedreamClient.actions.run({
        id: actionId,
        external_user_id: externalUserId,
        configured_props: configuredProps,
      });

      // Check if Pipedream returned an error in the response
      // Pipedream returns errors in os array with k: "error"
      if (result.os && Array.isArray(result.os)) {
        const errorEntry = result.os.find((entry: any) => entry.k === 'error');
        if (errorEntry && errorEntry.err) {
          throw new Error(`Pipedream action failed: ${errorEntry.err.message}`);
        }
      }

      return result;

    } catch (error: any) {
      throw new Error(`${service} ${action} failed: ${error.message}`);
    }
  }

  /**
   * Map service+action combinations to correct Pipedream action IDs
   */
  private mapServiceActionToPipedreamId(service: string, action: string): string | null {
    const actionMap: Record<string, Record<string, string>> = {
      gmail: {
        'send_email': 'gmail-send-email',
        'send-email': 'gmail-send-email',
        'sendEmail': 'gmail-send-email',
        'create_draft': 'gmail-create-draft',
        'create-draft': 'gmail-create-draft',
        'createDraft': 'gmail-create-draft',
        'get_messages': 'gmail-find-email', // Note: find-email is closest to get_messages
        'find_email': 'gmail-find-email',
        'search_messages': 'gmail-find-email',
      },
      slack: {
        'post_message': 'slack-send-message-to-channel',
        'send_message': 'slack-send-message-to-channel',
        'create_channel': 'slack-create-channel',
      },
      github: {
        'create_issue': 'github-create-issue',
        'create_repo': 'github-create-repo',
      }
    };

    return actionMap[service]?.[action] || null;
  }
}