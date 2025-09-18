import { NextRequest } from 'next/server';

// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Get worker health status for an agent's organization
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const params = await context.params;
  try {
    // Dynamic imports to prevent build-time database connections
    const { getUserIdFromRequest } = await import('@/src/lib/auth');
    const { db } = await import('@/src/lib/db/client');
    const { agents } = await import('@/src/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const { getAgentTaskApplicationService } = await import('@/src/ddd/application/di/container');
    
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
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

    // Get worker health for agent's organization using DDD service
    const agentTaskService = getAgentTaskApplicationService();
    const healthResult = await agentTaskService.getWorkerHealth(agent.organizationId);
    
    // Format response to match legacy format
    const formattedResult = {
      success: healthResult.healthy,
      worker_info: healthResult
    };

    return Response.json(formattedResult);

  } catch (error) {
    console.error('Error getting worker status:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}