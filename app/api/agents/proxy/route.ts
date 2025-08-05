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
  const actionId = `${service}-${action}`;
  
  try {
    const result = await pipedreamClient.actions.run({
      id: actionId,
      external_user_id: externalUserId,
      configured_props: params,
    });
    
    return result;
  } catch (error) {
    console.error(`Failed to execute ${actionId} for user ${ownerId}:`, error);
    throw new Error(`${service} ${action} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}