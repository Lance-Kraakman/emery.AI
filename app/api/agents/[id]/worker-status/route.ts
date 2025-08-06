import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getWorkerHealthForOrganization } from '@/lib/agents/grpc-executor';

/**
 * Get worker health status for an agent's organization
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const params = await context.params;
  try {
    const session = await auth();
    
    // AIDEV-NOTE: Development bypass for testing - remove in production
    let userId = session?.user?.id;
    if (!session?.user && process.env.NODE_ENV === 'development') {
      const testUserId = request.headers.get('x-test-user-id');
      if (testUserId === '550e8400-e29b-41d4-a716-446655440000') {
        userId = testUserId;
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

    // Verify agent ownership
    if (agent.ownerId !== userId) {
      return Response.json({ 
        error: 'Access denied: You can only check worker status for agents you own' 
      }, { status: 403 });
    }

    // Get worker health for agent's organization
    const organizationId = agent.organizationId?.toString() || 'default';
    const healthResult = await getWorkerHealthForOrganization(organizationId);

    return Response.json(healthResult);

  } catch (error) {
    console.error('Error getting worker status:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}