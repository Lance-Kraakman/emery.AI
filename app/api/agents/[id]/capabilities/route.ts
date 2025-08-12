import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserConnections } from '@/lib/pipedream/users';
import { getAvailableActionsForAgent } from '@/lib/pipedream/agents';

export interface AgentCapabilities {
  agent_id: number;
  agent_name: string;
  owner_id: string;
  connected_services: ConnectedService[];
  available_actions: AvailableAction[];
  proxy_endpoints: Record<string, string[]>;
}

export interface ConnectedService {
  service: string;
  account_name: string;
  status: 'connected' | 'error' | 'disconnected';
  connected_at: string;
}

export interface AvailableAction {
  id: string;
  name: string;
  description: string;
  service: string;
  required_props: string[];
  optional_props: string[];
}

/**
 * Get agent capabilities including connected services and available actions
 * This helps Python apps understand what the agent can do
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const params = await context.params;
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }
    
    const userId = authResult.user.id;

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
        error: 'Access denied: You can only view capabilities for agents you own' 
      }, { status: 403 });
    }

    // Get owner's connected services
    const connections = await getUserConnections(agent.ownerId);
    const connectedServices: ConnectedService[] = connections.map(conn => ({
      service: (conn.app as any)?.key || (conn.app as any)?.name || 'unknown',
      account_name: conn.account_name || 'Unknown Account',
      status: conn.status as 'connected' | 'error' | 'disconnected',
      connected_at: conn.created_at,
    }));

    // Get available actions based on connected services
    const availableIntegrations = await getAvailableActionsForAgent(agent.ownerId);
    
    // Map to available actions (this would be enhanced with actual Pipedream action discovery)
    const availableActions: AvailableAction[] = [];
    
    // Add predefined actions based on connected services
    for (const service of connectedServices) {
      if (service.status === 'connected') {
        switch (service.service.toLowerCase()) {
          case 'gmail':
            availableActions.push(
              {
                id: 'gmail-send-email',
                name: 'Send Email',
                description: 'Send an email via Gmail',
                service: 'gmail',
                required_props: ['to', 'subject', 'body'],
                optional_props: ['cc', 'bcc', 'attachments'],
              },
              {
                id: 'gmail-get-messages',
                name: 'Get Messages',
                description: 'Retrieve Gmail messages',
                service: 'gmail',
                required_props: [],
                optional_props: ['query', 'maxResults', 'labelIds'],
              }
            );
            break;
          case 'slack':
            availableActions.push(
              {
                id: 'slack-send-message',
                name: 'Send Slack Message',
                description: 'Send a message to a Slack channel',
                service: 'slack',
                required_props: ['channel', 'text'],
                optional_props: ['username', 'icon_emoji', 'attachments'],
              },
              {
                id: 'slack-create-channel',
                name: 'Create Channel',
                description: 'Create a new Slack channel',
                service: 'slack',
                required_props: ['name'],
                optional_props: ['is_private', 'purpose', 'topic'],
              }
            );
            break;
          case 'github':
            availableActions.push(
              {
                id: 'github-create-issue',
                name: 'Create Issue',
                description: 'Create a GitHub issue',
                service: 'github',
                required_props: ['repo', 'title', 'body'],
                optional_props: ['labels', 'assignees', 'milestone'],
              }
            );
            break;
        }
      }
    }

    // Define proxy endpoints for each service
    const proxyEndpoints: Record<string, string[]> = {};
    for (const service of connectedServices) {
      if (service.status === 'connected') {
        switch (service.service.toLowerCase()) {
          case 'gmail':
            proxyEndpoints.gmail = [
              'GET /gmail/v1/users/me/profile',
              'GET /gmail/v1/users/me/messages',
              'POST /gmail/v1/users/me/messages/send',
              'GET /gmail/v1/users/me/labels',
              'GET /gmail/v1/users/me/threads',
            ];
            break;
          case 'slack':
            proxyEndpoints.slack = [
              'GET /api/users.info',
              'POST /api/chat.postMessage',
              'GET /api/conversations.list',
              'POST /api/conversations.create',
              'GET /api/team.info',
            ];
            break;
          case 'github':
            proxyEndpoints.github = [
              'GET /user',
              'GET /user/repos',
              'POST /user/repos',
              'GET /repos/{owner}/{repo}/issues',
              'POST /repos/{owner}/{repo}/issues',
            ];
            break;
        }
      }
    }

    const capabilities: AgentCapabilities = {
      agent_id: agentId,
      agent_name: agent.name,
      owner_id: agent.ownerId,
      connected_services: connectedServices,
      available_actions: availableActions,
      proxy_endpoints: proxyEndpoints,
    };

    return Response.json(capabilities);

  } catch (error) {
    console.error('Error getting agent capabilities:', error);
    return Response.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}