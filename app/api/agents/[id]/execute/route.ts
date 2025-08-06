import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { agents, taskExecutions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { runActionForAgent } from '@/lib/pipedream/agents';
import { executeAgentCapability } from '@/lib/agents/executor';

export interface AgentExecuteRequest {
  // New capability execution (main approach)
  capability_name: string;
  trigger_data?: Record<string, any>;
  step_overrides?: Array<Record<string, any>>;
  
  // Common options
  webhook_url?: string;
  timeout?: number;
}

export interface AgentExecuteResponse {
  success: boolean;
  result?: any;
  error?: string;
  execution_id?: string;
}

/**
 * Execute an agent capability via emery-agents package
 * This is the secure endpoint for triggering specific agent capabilities
 * with multi-step workflows and context persistence
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
        console.log('⚠️  Using development test user bypass for execute');
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

    // Verify agent ownership (agents can only be used by their owners)
    if (agent.ownerId !== userId) {
      return Response.json({ 
        error: 'Access denied: You can only execute actions for agents you own' 
      }, { status: 403 });
    }

    const body: AgentExecuteRequest = await request.json();
    const { capability_name, trigger_data, step_overrides, webhook_url, timeout = 30000 } = body;

    if (!capability_name) {
      return Response.json({ 
        error: 'capability_name is required' 
      }, { status: 400 });
    }

    // Generate execution ID for tracking
    const executionId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Execute agent capability via emery-agents package
    console.log(`[CAPABILITY-EXEC] ${executionId}: Agent ${agentId} executing capability '${capability_name}' for user ${userId}`);
    
    const result = await executeAgentCapability({
      agent,
      capabilityName: capability_name,
      triggerData: trigger_data || {},
      stepOverrides: step_overrides,
      executionId,
    });

    // If webhook URL provided, send result asynchronously
    if (webhook_url && result.success) {
      // Fire and forget webhook - don't wait for it
      setImmediate(async () => {
        try {
          const webhookPayload = {
            execution_id: executionId,
            agent_id: agentId,
            capability_name,
            result: result.output_data,
            timestamp: new Date().toISOString(),
          };

          const response = await fetch(webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Emery-Signature': await generateWebhookSignature(webhookPayload),
            },
            body: JSON.stringify(webhookPayload),
            signal: AbortSignal.timeout(timeout),
          });

          if (!response.ok) {
            console.error(`[WEBHOOK-ERROR] ${executionId}: Failed to deliver to ${webhook_url}:`, response.status);
          } else {
            console.log(`[WEBHOOK-SUCCESS] ${executionId}: Delivered to ${webhook_url}`);
          }
        } catch (error) {
          console.error(`[WEBHOOK-ERROR] ${executionId}: Failed to deliver to ${webhook_url}:`, error);
        }
      });
    }

    const response: AgentExecuteResponse = {
      success: result.success,
      result: result.output_data,
      error: result.error,
      execution_id: executionId,
    };

    return Response.json(response);

  } catch (error) {
    console.error('Error executing agent action:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Generate HMAC signature for webhook verification
 */
async function generateWebhookSignature(payload: any): Promise<string> {
  const secret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
  const message = JSON.stringify(payload);
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}