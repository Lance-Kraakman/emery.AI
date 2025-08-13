import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { executeAgentCapabilityViaGRPC as executeAgentViaGRPC } from '@/lib/agents/grpc-executor';
import crypto from 'crypto';

export interface AgentExecuteRequest {
  // Capability execution approaches
  capability_name?: string; // Optional - for direct capability execution
  instructions?: string; // Optional - for instruction-based execution with auto-routing
  tools?: Array<{name: string, version?: string, config?: Record<string, any>}>; // Optional tools for instruction-based execution
  servers?: Array<{name: string, endpoint?: string, config?: Record<string, any>}>; // Optional servers for instruction-based execution
  
  // Legacy support
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

    // Verify agent ownership (agents can only be used by their owners)
    if (agent.ownerId !== userId) {
      return Response.json({ 
        error: 'Access denied: You can only execute actions for agents you own' 
      }, { status: 403 });
    }

    const body: AgentExecuteRequest = await request.json();
    const { capability_name, instructions, tools, servers, trigger_data, step_overrides, webhook_url, timeout = 30000 } = body;

    if (!capability_name && !instructions) {
      return Response.json({ 
        error: 'Either capability_name or instructions is required' 
      }, { status: 400 });
    }

    // Generate execution ID for tracking (UUID format for database compatibility)
    const executionId = crypto.randomUUID();

    // Execute agent capability or instruction-based task via gRPC worker
    if (capability_name) {
      console.log(`[GRPC-CAPABILITY-EXEC] ${executionId}: Agent ${agentId} executing capability '${capability_name}' for user ${userId}`);
    } else {
      console.log(`[GRPC-INSTRUCTION-EXEC] ${executionId}: Agent ${agentId} executing instruction-based task for user ${userId}`);
    }
    
    const result = await executeAgentViaGRPC({
      agentId: agentId,
      capabilityName: capability_name,
      instructionConfig: instructions ? {
        instructions,
        tools: tools || [],
        servers: servers || [],
      } : undefined,
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