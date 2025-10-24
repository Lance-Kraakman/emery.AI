/**
 * OAuth Proxy Application Service
 *
 * Handles OAuth proxy operations for agent API calls to external services via Pipedream.
 * Orchestrates agent lookup, credential management, and OAuth execution.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';
import { PipedreamClient } from '@pipedream/sdk';

const logger = createDebugLogger('OAuthProxy');
import { getExternalUserIdForAgent } from '@/lib/pipedream/client';
import { ApiKey, UserId, AgentId } from '@/ddd/domain/shared/value-objects';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
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
    private pipedreamClient: PipedreamClient | null = null
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

      // 3. Update agent last used timestamp
      await this.agentRepository.updateLastUsed(agent.id);

      console.log(`[OAUTH-PROXY] Agent ${agent.id.value} (${agent.name}) calling ${request.service}.${request.action} for user ${agent.ownerId.value}`);

      // 4. Execute OAuth call using agent owner's credentials
      const result = await this.executeWithOwnerCredentials(
        agent.ownerId,
        request.service,
        request.action,
        request.params || {}
      );

      return ResultHelpers.success<OAuthProxyResult>({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('OAuth proxy error:', error);
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

    console.log(`[PIPEDREAM-DEBUG] Trying to execute action for user ${ownerId.value}`);
    console.log(`[PIPEDREAM-DEBUG] External user ID: ${externalUserId}`);
    console.log(`[PIPEDREAM-DEBUG] Service: ${service}, Action: ${action}`);
    console.log(`[PIPEDREAM-DEBUG] Params:`, JSON.stringify(params, null, 2));

    // Check if the user has OAuth connections and get account ID
    let accountId: string | undefined;
    try {
      const accounts = await this.pipedreamClient.accounts.list({
        external_user_id: externalUserId
      });
      console.log(`[PIPEDREAM-DEBUG] User accounts:`, JSON.stringify(accounts, null, 2));

      if (!accounts || !Array.isArray(accounts.data) || accounts.data.length === 0) {
        throw new Error(`No OAuth connections found for user. Please connect ${service} in the dashboard.`);
      }

      // Find the account for this service
      const account = accounts.data.find((acc: any) => acc.app?.name_slug === service);
      if (!account) {
        throw new Error(`No ${service} connection found for user. Available: ${accounts.data.map((a: any) => a.app?.name_slug).join(', ')}`);
      }

      accountId = account.id;
      console.log(`[PIPEDREAM-DEBUG] Using account ID: ${accountId} for service: ${service}`);
    } catch (accountError) {
      console.error(`[PIPEDREAM-DEBUG] Failed to list accounts:`, accountError);
      throw new Error(`Failed to check OAuth connections: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
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

      console.log(`[PIPEDREAM-DEBUG] Using action ID: ${actionId}`);
      console.log(`[PIPEDREAM-DEBUG] Full request payload:`, JSON.stringify({
        id: actionId,
        external_user_id: externalUserId,
        configured_props: configuredProps
      }, null, 2));

      const result = await this.pipedreamClient.actions.run({
        id: actionId,
        external_user_id: externalUserId,
        configured_props: configuredProps,
      });

      console.log(`[PIPEDREAM-DEBUG] Raw Pipedream result:`, JSON.stringify(result, null, 2));

      // Check if Pipedream returned an error in the response
      // Pipedream returns errors in os array with k: "error"
      if (result.os && Array.isArray(result.os)) {
        const errorEntry = result.os.find((entry: any) => entry.k === 'error');
        if (errorEntry && errorEntry.err) {
          console.log(`[PIPEDREAM-DEBUG] ❌ Pipedream action failed with error in response`);
          console.log(`[PIPEDREAM-DEBUG] Error name:`, errorEntry.err.name);
          console.log(`[PIPEDREAM-DEBUG] Error message:`, errorEntry.err.message);
          throw new Error(`Pipedream action failed: ${errorEntry.err.message}`);
        }
      }

      console.log(`[PIPEDREAM-DEBUG] ✅ Success with action ID: ${actionId}`);
      return result;

    } catch (error: any) {
      console.log(`[PIPEDREAM-DEBUG] ❌ Failed with action ID: ${actionId}`);
      console.log(`[PIPEDREAM-DEBUG] Error type:`, error.constructor.name);
      console.log(`[PIPEDREAM-DEBUG] Error message:`, error.message);
      console.log(`[PIPEDREAM-DEBUG] Error stack:`, error.stack);

      if (error.response) {
        console.log(`[PIPEDREAM-DEBUG] Response status:`, error.response.status);
        console.log(`[PIPEDREAM-DEBUG] Response headers:`, JSON.stringify(error.response.headers, null, 2));
        console.log(`[PIPEDREAM-DEBUG] Response data:`, JSON.stringify(error.response.data, null, 2));
      }

      if (error.data) {
        console.log(`[PIPEDREAM-DEBUG] Error data:`, JSON.stringify(error.data, null, 2));
      }

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

    console.log(`[PIPEDREAM-DEBUG] User ${userId.value} executing ${actionId}`);
    console.log(`[PIPEDREAM-DEBUG] External user ID: ${externalUserId}`);
    console.log(`[PIPEDREAM-DEBUG] Params:`, JSON.stringify(params, null, 2));

    // Check user's OAuth connections and get account ID
    let accountId: string | undefined;
    try {
      const accounts = await this.pipedreamClient.accounts.list({
        external_user_id: externalUserId
      });
      console.log(`[PIPEDREAM-DEBUG] User accounts:`, JSON.stringify(accounts, null, 2));

      if (!accounts || !Array.isArray(accounts.data) || accounts.data.length === 0) {
        throw new Error(`No OAuth connections found for user. Please connect ${service} in the dashboard.`);
      }

      // Find the account for this service
      const account = accounts.data.find((acc: any) => acc.app?.name_slug === service);
      if (!account) {
        throw new Error(`No ${service} connection found for user. Available: ${accounts.data.map((a: any) => a.app?.name_slug).join(', ')}`);
      }

      accountId = account.id;
      console.log(`[PIPEDREAM-DEBUG] Using account ID: ${accountId} for service: ${service}`);
    } catch (accountError) {
      console.error(`[PIPEDREAM-DEBUG] Failed to list user accounts:`, accountError);
      throw new Error(`Failed to check OAuth connections: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
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

      console.log(`[PIPEDREAM-DEBUG] Full user request payload:`, JSON.stringify({
        id: actionId,
        external_user_id: externalUserId,
        configured_props: configuredProps
      }, null, 2));

      const result = await this.pipedreamClient.actions.run({
        id: actionId,
        external_user_id: externalUserId,
        configured_props: configuredProps,
      });

      console.log(`[PIPEDREAM-DEBUG] Raw Pipedream result:`, JSON.stringify(result, null, 2));

      // Check if Pipedream returned an error in the response
      // Pipedream returns errors in os array with k: "error"
      if (result.os && Array.isArray(result.os)) {
        const errorEntry = result.os.find((entry: any) => entry.k === 'error');
        if (errorEntry && errorEntry.err) {
          console.log(`[PIPEDREAM-DEBUG] ❌ Pipedream action failed with error in response`);
          console.log(`[PIPEDREAM-DEBUG] Error name:`, errorEntry.err.name);
          console.log(`[PIPEDREAM-DEBUG] Error message:`, errorEntry.err.message);
          throw new Error(`Pipedream action failed: ${errorEntry.err.message}`);
        }
      }

      console.log(`[PIPEDREAM-DEBUG] ✅ User action succeeded`);
      return result;

    } catch (error: any) {
      console.log(`[PIPEDREAM-DEBUG] ❌ User action failed`);
      console.log(`[PIPEDREAM-DEBUG] Error type:`, error.constructor.name);
      console.log(`[PIPEDREAM-DEBUG] Error message:`, error.message);
      console.log(`[PIPEDREAM-DEBUG] Error stack:`, error.stack);

      if (error.response) {
        console.log(`[PIPEDREAM-DEBUG] Response status:`, error.response.status);
        console.log(`[PIPEDREAM-DEBUG] Response headers:`, JSON.stringify(error.response.headers, null, 2));
        console.log(`[PIPEDREAM-DEBUG] Response data:`, JSON.stringify(error.response.data, null, 2));
      }

      if (error.data) {
        console.log(`[PIPEDREAM-DEBUG] Error data:`, JSON.stringify(error.data, null, 2));
      }

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