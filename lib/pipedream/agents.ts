import { pipedreamClient, getExternalUserIdForAgent } from './client';

export interface AgentActionRequest {
  agentId: number;
  ownerUserId: string;
  actionId: string;
  configuredProps: Record<string, any>;
}

export interface AgentActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Run a Pipedream action on behalf of an agent (using owner's credentials)
 */
export async function runActionForAgent(request: AgentActionRequest): Promise<AgentActionResult> {
  if (!pipedreamClient) {
    return {
      success: false,
      error: 'Pipedream client not available (server-side only)',
    };
  }
  
  const { ownerUserId, actionId, configuredProps } = request;
  const externalUserId = getExternalUserIdForAgent(ownerUserId);
  
  try {
    const result = await pipedreamClient.actions.run({
      id: actionId,
      external_user_id: externalUserId,
      configured_props: configuredProps,
    });
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Failed to run action for agent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available actions for an agent (based on owner's connections)
 */
export async function getAvailableActionsForAgent(ownerUserId: string) {
  if (!pipedreamClient) {
    console.error('Pipedream client not available (server-side only)');
    return [];
  }
  
  const externalUserId = getExternalUserIdForAgent(ownerUserId);
  
  try {
    // Get user's connections to determine available actions
    const connections = await pipedreamClient.users.getConnections({ 
      external_user_id: externalUserId 
    });
    
    // This would need to be enhanced to map connections to available actions
    // For now, return the connections as available integrations
    return connections;
  } catch (error) {
    console.error('Failed to get available actions for agent:', error);
    return [];
  }
}

/**
 * Execute a custom API request on behalf of an agent
 */
export async function executeCustomRequestForAgent(
  ownerUserId: string,
  appName: string,
  requestConfig: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    data?: any;
  }
): Promise<AgentActionResult> {
  if (!pipedreamClient) {
    return {
      success: false,
      error: 'Pipedream client not available (server-side only)',
    };
  }
  
  const externalUserId = getExternalUserIdForAgent(ownerUserId);
  
  try {
    const result = await pipedreamClient.users.makeRequest({
      external_user_id: externalUserId,
      app: appName,
      ...requestConfig,
    });
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Failed to execute custom request for agent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}