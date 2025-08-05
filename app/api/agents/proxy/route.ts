import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { pipedreamClient, getExternalUserIdForAgent } from '@/lib/pipedream/client';

/**
 * Universal OAuth Proxy - Single endpoint for all agent OAuth calls
 * 
 * Usage: POST /api/agents/proxy
 * Headers: Authorization: Bearer {agent_api_key}
 * Body: { "service": "gmail", "action": "send_email", "params": {...} }
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (!apiKey) {
      return Response.json({ error: 'Missing API key' }, { status: 401 });
    }
    
    // Find agent by API key
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.apiKey, apiKey))
      .limit(1);
      
    if (!agent) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    
    // Parse request body
    const { service, action, params } = await request.json();
    
    if (!service || !action) {
      return Response.json({ 
        error: 'Missing required fields: service, action' 
      }, { status: 400 });
    }
    
    // Update agent last used timestamp
    await db
      .update(agents)
      .set({ lastUsedAt: new Date() })
      .where(eq(agents.id, agent.id));
    
    console.log(`[OAUTH-PROXY] Agent ${agent.id} (${agent.name}) calling ${service}.${action} for user ${agent.ownerId}`);
    
    // Execute action using agent owner's OAuth credentials
    const result = await executeWithOwnerCredentials(
      agent.ownerId,
      service,
      action, 
      params || {}
    );
    
    return Response.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('OAuth proxy error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Execute action using agent owner's OAuth credentials via Pipedream
 */
async function executeWithOwnerCredentials(
  ownerId: string,
  service: string, 
  action: string,
  params: Record<string, any>
): Promise<any> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available');
  }
  
  const externalUserId = getExternalUserIdForAgent(ownerId);
  
  // Map service+action to correct Pipedream action IDs
  const actionId = mapToCorrectActionId(service, action);
  
  if (!actionId) {
    throw new Error(`Unsupported action: ${service}.${action}`);
  }
  
  console.log(`[PIPEDREAM-DEBUG] Trying to execute action for user ${ownerId}`);
  console.log(`[PIPEDREAM-DEBUG] External user ID: ${externalUserId}`);
  console.log(`[PIPEDREAM-DEBUG] Service: ${service}, Action: ${action}`);
  console.log(`[PIPEDREAM-DEBUG] Params:`, JSON.stringify(params, null, 2));
  
  // First, let's check if the user has any OAuth connections
  try {
    const accounts = await pipedreamClient.accounts.list({ 
      external_user_id: externalUserId 
    });
    console.log(`[PIPEDREAM-DEBUG] User accounts:`, JSON.stringify(accounts, null, 2));
    
    if (!accounts || accounts.length === 0) {
      throw new Error(`No OAuth connections found for user. Please connect ${service} in the dashboard.`);
    }
  } catch (accountError) {
    console.error(`[PIPEDREAM-DEBUG] Failed to list accounts:`, accountError);
    throw new Error(`Failed to check OAuth connections: ${accountError instanceof Error ? accountError.message : 'Unknown error'}`);
  }
  
  // Execute the action with correct Pipedream action ID
  try {
    console.log(`[PIPEDREAM-DEBUG] Using action ID: ${actionId}`);
    
    const result = await pipedreamClient.actions.run({
      id: actionId,
      external_user_id: externalUserId,
      configured_props: params,
    });
    
    console.log(`[PIPEDREAM-DEBUG] ✅ Success with action ID: ${actionId}`);
    console.log(`[PIPEDREAM-DEBUG] Result:`, JSON.stringify(result, null, 2));
    return result;
    
  } catch (error: any) {
    console.log(`[PIPEDREAM-DEBUG] ❌ Failed with action ID: ${actionId}`);
    console.log(`[PIPEDREAM-DEBUG] Error:`, error.message);
    
    if (error.response) {
      console.log(`[PIPEDREAM-DEBUG] Response status:`, error.response.status);
      console.log(`[PIPEDREAM-DEBUG] Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    
    throw new Error(`${service} ${action} failed: ${error.message}`);
  }
}

/**
 * Map service+action combinations to correct Pipedream action IDs
 */
function mapToCorrectActionId(service: string, action: string): string | null {
  const actionMap: Record<string, Record<string, string>> = {
    gmail: {
      'send_email': 'gmail-send-email',
      'send-email': 'gmail-send-email',
      'sendEmail': 'gmail-send-email',
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