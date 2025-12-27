/**
 * Pipedream Source Deployment Service
 *
 * Handles deployment of Pipedream event sources (triggers) via the Pipedream SDK.
 * Sources need to be deployed before they can send events to webhooks.
 *
 * AIDEV-NOTE: This is the key piece that was missing - without deploying sources,
 * External Event triggers won't work. Actions work automatically, but sources require deployment.
 */

import { pipedreamClient, getExternalUserId } from './client';

export interface DeploySourceResult {
  sourceId: string;
  webhookId: string;
  subscriptionId: string;
}

export interface DeploySourceOptions {
  userId: string;
  triggerId: string;           // Tool ID from tools table (e.g., "gmail-new-email-received")
  webhookUrl: string;          // Our webhook endpoint to receive events
  connectionId: string;        // User's OAuth connection ID (e.g., "apn_QPhBxVA")
  appSlug: string;             // App slug (e.g., "gmail", "slack") - needed for configured_props
  configuredProps?: Record<string, any>;  // Trigger-specific configuration
}

/**
 * Deploy a Pipedream event source for a user
 *
 * This creates an event source on Pipedream that will:
 * 1. Listen for events (e.g., new Gmail emails)
 * 2. Send those events to our webhookUrl
 *
 * @returns Deployment IDs to store in trigger config
 */
export async function deploySource(options: DeploySourceOptions): Promise<DeploySourceResult> {
  const { userId, triggerId, webhookUrl, connectionId, appSlug, configuredProps } = options;
  const externalUserId = getExternalUserId(userId);

  console.log(`[PipedreamSources] Deploying trigger:`, {
    triggerId,
    webhookUrl,
    connectionId,
    appSlug,
    externalUserId
  });

  if (!pipedreamClient) {
    throw new Error('Pipedream client is not configured. Check PIPEDREAM_PROJECT_ID, PIPEDREAM_CLIENT_ID, and PIPEDREAM_CLIENT_SECRET.');
  }

  // Build configured_props with the OAuth account
  // Pipedream requires the app slug (e.g., "gmail") with authProvisionId referencing the account
  // This is the same format used for actions - see oauth-proxy-application-service.ts
  const allConfiguredProps: Record<string, unknown> = {
    [appSlug]: {
      authProvisionId: connectionId  // e.g., { gmail: { authProvisionId: "apn_QPhBxVA" } }
    },
    ...configuredProps
  };

  console.log(`[PipedreamSources] Configured props:`, allConfiguredProps);

  try {
    // Deploy trigger via Pipedream SDK
    // See: https://pipedream.com/docs/connect/api#triggers
    const response = await pipedreamClient.triggers.deploy({
      id: triggerId,
      external_user_id: externalUserId,
      configured_props: allConfiguredProps,
      webhook_url: webhookUrl
    });

    const deployedComponent = response.data;
    console.log(`[PipedreamSources] Trigger deployed:`, {
      id: deployedComponent.id,
      componentId: deployedComponent.component_id,
      active: deployedComponent.active
    });

    return {
      sourceId: deployedComponent.id,
      webhookId: deployedComponent.id, // Use same ID - SDK doesn't return separate webhook ID
      subscriptionId: deployedComponent.id
    };
  } catch (error) {
    console.error(`[PipedreamSources] Deployment failed:`, error);
    throw new Error(`Failed to deploy Pipedream trigger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a deployed Pipedream source
 *
 * Use this when:
 * - User deletes an automation
 * - Source cleanup is needed
 */
export async function deleteSource(sourceId: string, userId: string): Promise<void> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client is not configured');
  }

  const externalUserId = getExternalUserId(userId);
  console.log(`[PipedreamSources] Deleting source: ${sourceId}`);

  try {
    await pipedreamClient.deployedTriggers.delete(sourceId, {
      external_user_id: externalUserId
    });
    console.log(`[PipedreamSources] Source deleted: ${sourceId}`);
  } catch (error) {
    console.error(`[PipedreamSources] Delete failed:`, error);
    throw new Error(`Failed to delete Pipedream source: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a source is already deployed for a user/trigger combination
 *
 * This can be used to avoid duplicate deployments
 */
export async function getExistingSource(
  userId: string,
  triggerId: string
): Promise<{ sourceId: string } | null> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client is not configured');
  }

  const externalUserId = getExternalUserId(userId);

  try {
    // List deployed triggers for this user
    const response = await pipedreamClient.deployedTriggers.list({
      external_user_id: externalUserId
    });

    // Find one matching the trigger component ID
    for await (const trigger of response) {
      if (trigger.component_id === triggerId) {
        return { sourceId: trigger.id };
      }
    }

    return null;
  } catch (error) {
    console.error(`[PipedreamSources] Failed to check existing source:`, error);
    // Return null instead of throwing - let caller handle missing sources
    return null;
  }
}
