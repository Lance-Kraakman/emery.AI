import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { executeCustomRequestForAgent } from '@/lib/pipedream/agents';

export interface AgentProxyRequest {
  service: string; // e.g., 'gmail', 'slack', 'github'
  endpoint: string; // e.g., '/v1/users/me/messages'
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, string>;
}

export interface AgentProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Proxy authenticated API requests through agent's OAuth credentials
 * This allows Python apps to make API calls without handling OAuth tokens
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const session = await auth();
    
    // AIDEV-NOTE: Development bypass for testing - remove in production
    let userId = session?.user?.id;
    if (!session?.user && process.env.NODE_ENV === 'development') {
      // Allow testing with test user ID via header
      const testUserId = request.headers.get('x-test-user-id');
      if (testUserId === '550e8400-e29b-41d4-a716-446655440000') {
        userId = testUserId;
        console.log('⚠️  Using development test user bypass for proxy');
      } else {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = parseInt(params.id);
    if (isNaN(agentId)) {
      return Response.json({ error: 'Invalid agent ID' }, { status: 400 });
    }

    // Get agent and verify ownership
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.ownerId !== userId) {
      return Response.json({ 
        error: 'Access denied: You can only proxy requests for agents you own' 
      }, { status: 403 });
    }

    const body: AgentProxyRequest = await request.json();
    const { service, endpoint, method, headers = {}, data, params } = body;

    if (!service || !endpoint || !method) {
      return Response.json({ 
        error: 'service, endpoint, and method are required' 
      }, { status: 400 });
    }

    // Build the full URL with params
    let url = endpoint;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += (url.includes('?') ? '&' : '?') + searchParams.toString();
    }

    console.log(`[AGENT-PROXY] Agent ${agentId} proxying ${method} ${service}${url} for user ${userId}`);

    // Execute the proxied request using agent's owner credentials
    const result = await executeCustomRequestForAgent(
      agent.ownerId,
      service,
      {
        method,
        url,
        headers,
        data,
      }
    );

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error,
        status: 400,
      } as AgentProxyResponse);
    }

    // Extract response data and metadata
    const responseData = result.data;
    let status = 200;
    let responseHeaders: Record<string, string> = {};

    // If the result contains HTTP response metadata
    if (responseData && typeof responseData === 'object') {
      if ('status' in responseData) status = responseData.status;
      if ('headers' in responseData) responseHeaders = responseData.headers;
    }

    const response: AgentProxyResponse = {
      success: true,
      data: responseData,
      status,
      headers: responseHeaders,
    };

    return Response.json(response);

  } catch (error) {
    console.error('Error proxying agent request:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error',
      status: 500,
    } as AgentProxyResponse, { status: 500 });
  }
}

/**
 * Get available proxy endpoints for debugging
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentId = parseInt(params.id);
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent || agent.ownerId !== userId) {
      return Response.json({ error: 'Agent not found or access denied' }, { status: 403 });
    }

    // Return available proxy endpoints for each service
    const availableEndpoints = {
      gmail: [
        'GET /gmail/v1/users/me/profile',
        'GET /gmail/v1/users/me/messages',
        'POST /gmail/v1/users/me/messages/send',
        'GET /gmail/v1/users/me/labels',
      ],
      slack: [
        'GET /api/users.info',
        'POST /api/chat.postMessage',
        'GET /api/conversations.list',
        'POST /api/conversations.create',
      ],
      github: [
        'GET /user',
        'GET /user/repos',
        'POST /user/repos',
        'GET /repos/{owner}/{repo}/issues',
      ],
    };

    return Response.json({
      agent_id: agentId,
      available_endpoints: availableEndpoints,
    });

  } catch (error) {
    console.error('Error getting proxy endpoints:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}