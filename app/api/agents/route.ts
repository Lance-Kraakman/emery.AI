/**
 * Agent management API endpoint
 * Supports REST API access for agent operations
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Agent API key generator
function generateAgentApiKey(): string {
  return 'ag_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create a new agent
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    const body = await request.json();
    const { 
      name, 
      role, 
      description, 
      persona, 
      organizationId,
      trigger,
      capabilities,
      tools,
      servers 
    } = body;

    if (!name || !organizationId) {
      return Response.json({ 
        error: 'Missing required fields: name, organizationId' 
      }, { status: 400 });
    }


    // Create agent
    const [newAgent] = await db.insert(agents).values({
      name,
      role,
      description,
      persona,
      ownerId: userId,
      organizationId: parseInt(organizationId),
      trigger: trigger || { type: 'MANUAL' },
      capabilities: capabilities || [],
      tools: tools || [],
      servers: servers || [],
      status: 'active',
      apiKey: generateAgentApiKey(),
    }).returning();

    return Response.json({
      success: true,
      message: 'Agent created successfully',
      agent: newAgent,
      id: newAgent.id, // For compatibility with tests
    });

  } catch (error) {
    console.error('Error creating agent:', error);
    return Response.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Get agents list
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Get agents for user - this will return empty if userId doesn't match any ownerId
    const userAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.ownerId, userId));

    return Response.json({
      success: true,
      agents: userAgents,
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}