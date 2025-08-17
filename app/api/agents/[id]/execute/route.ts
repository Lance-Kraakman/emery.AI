// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { executeAgentViaGRPC } from '@/lib/agents/grpc-executor';
import crypto from 'crypto';

export interface AgentExecuteRequest {
  instructions: string; // Main instruction text
  tools?: Array<{name: string, version?: string, config?: Record<string, any>}>; // Optional tools
  servers?: Array<{name: string, endpoint?: string, config?: Record<string, any>}>; // Optional servers
  metadata?: Record<string, any>; // Optional context metadata
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
 * Execute an agent via simplified smolagents hierarchy
 * All capability routing handled internally by smolagents
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
    const { instructions, tools, servers, metadata, webhook_url, timeout = 30000 } = body;

    if (!instructions) {
      return Response.json({ 
        error: 'Instructions are required' 
      }, { status: 400 });
    }

    // Generate execution ID for tracking (UUID format for database compatibility)
    const executionId = crypto.randomUUID();

    // Execute agent via simplified gRPC worker
    console.log(`[GRPC-AGENT-EXEC] ${executionId}: Agent ${agentId} executing task for user ${userId}`);
    
    const result = await executeAgentViaGRPC({
      agentId: agentId,
      instructions,
      tools,
      servers,
      executionId
    });

    // If webhook URL provided, send result asynchronously
    if (webhook_url && result.success) {
      // Fire and forget webhook - don't wait for it
      setImmediate(async () => {
        try {
          const webhookPayload = {
            execution_id: executionId,
            agent_id: agentId,
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