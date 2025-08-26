/**
 * Webhook endpoint for external agent triggers
 * Handles WEBHOOK trigger type for agents
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';
import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import { getAgentTaskApplicationService } from '@/ddd/application/di/container';
import { v4 as uuidv4 } from 'uuid';
import { createHmac, timingSafeEqual } from 'crypto';

interface TriggerConfig {
  type: 'MANUAL' | 'CRON' | 'WEBHOOK' | 'DATABASE_EVENT';
  cron?: string;
  webhook_url?: string;
  webhook_secret?: string;
  table_id?: string;
}

/**
 * Handle webhook triggers for agents
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agent_id');

    if (!agentId || isNaN(parseInt(agentId))) {
      return Response.json({ 
        success: false,
        error: 'Missing or invalid agent_id parameter' 
      }, { status: 400 });
    }

    // Get agent with webhook trigger
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, parseInt(agentId)),
          eq(agents.status, 'active'),
          sql`trigger->>'type' = 'WEBHOOK'`
        )
      )
      .limit(1);

    if (!agent) {
      return Response.json({ 
        success: false,
        error: 'Agent not found or webhook trigger not configured' 
      }, { status: 404 });
    }

    const triggerConfig = agent.trigger as TriggerConfig;

    // Verify webhook signature if secret is configured
    if (triggerConfig.webhook_secret) {
      const signature = request.headers.get('x-emery-signature');
      const timestamp = request.headers.get('x-emery-timestamp');
      
      if (!signature || !timestamp) {
        return Response.json({ 
          success: false,
          error: 'Missing webhook signature headers' 
        }, { status: 401 });
      }

      // Get request body for signature verification
      const body = await request.text();
      
      // Verify timestamp (prevent replay attacks)
      const requestTime = parseInt(timestamp);
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - requestTime) > 300) { // 5 minutes tolerance
        return Response.json({ 
          success: false,
          error: 'Request timestamp too old' 
        }, { status: 401 });
      }

      // Verify HMAC signature
      const expectedSignature = createHmac('sha256', triggerConfig.webhook_secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      
      const receivedSignature = signature.replace('sha256=', '');
      
      if (!timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      )) {
        return Response.json({ 
          success: false,
          error: 'Invalid webhook signature' 
        }, { status: 401 });
      }

      // Parse body as JSON now that we've verified it
      let webhookPayload;
      try {
        webhookPayload = JSON.parse(body);
      } catch (error) {
        return Response.json({ 
          success: false,
          error: 'Invalid JSON payload' 
        }, { status: 400 });
      }

      // Execute agent using DDD application service
      const executionId = uuidv4();
      const instructions = `Execute webhook trigger with payload`;

      console.log(`[SCHEDULER-WEBHOOK] Executing agent ${agent.id} (${agent.name}) via webhook trigger`);

      const agentTaskService = getAgentTaskApplicationService();
      
      const taskInstructions: TaskInstructions = {
        instructions,
        tools: [], // Webhook can specify tools if needed
        servers: [], // Webhook can specify servers if needed
        metadata: { 
          triggerType: 'WEBHOOK',
          webhookPayload
        }
      };

      const taskResult = await agentTaskService.createAndExecuteTask({
        agentId: agent.id,
        name: `Webhook: ${instructions}`,
        instructions: taskInstructions,
        timeoutSeconds: 300
      });

      const result = {
        success: taskResult.executionResult.success,
        error: taskResult.executionResult.error
      };

      return Response.json({
        success: true,
        message: 'Webhook executed successfully',
        execution: {
          execution_id: executionId,
          agent_id: agent.id,
          agent_name: agent.name,
          result: result.success,
          error: result.error,
        },
      });

    } else {
      // No signature verification required - parse body directly
      const webhookPayload = await request.json();

      // Execute agent using DDD application service
      const executionId = uuidv4();
      const instructions = `Execute webhook trigger with payload`;

      console.log(`[SCHEDULER-WEBHOOK] Executing agent ${agent.id} (${agent.name}) via webhook trigger (unsigned)`);

      const agentTaskService = getAgentTaskApplicationService();
      
      const taskInstructions: TaskInstructions = {
        instructions,
        tools: [], // Webhook can specify tools if needed
        servers: [], // Webhook can specify servers if needed
        metadata: { 
          triggerType: 'WEBHOOK',
          webhookPayload
        }
      };

      const taskResult = await agentTaskService.createAndExecuteTask({
        agentId: agent.id,
        name: `Webhook: ${instructions}`,
        instructions: taskInstructions,
        timeoutSeconds: 300
      });

      const result = {
        success: taskResult.executionResult.success,
        error: taskResult.executionResult.error
      };

      return Response.json({
        success: true,
        message: 'Webhook executed successfully',
        execution: {
          execution_id: executionId,
          agent_id: agent.id,
          agent_name: agent.name,
          result: result.success,
          error: result.error,
        },
      });
    }

  } catch (error) {
    console.error('Error in webhook endpoint:', error);
    return Response.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Get webhook URL and configuration info for an agent
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agent_id');

    if (!agentId || isNaN(parseInt(agentId))) {
      return Response.json({ 
        success: false,
        error: 'Missing or invalid agent_id parameter' 
      }, { status: 400 });
    }

    // Get agent with webhook trigger
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, parseInt(agentId)),
          eq(agents.status, 'active'),
          sql`trigger->>'type' = 'WEBHOOK'`
        )
      )
      .limit(1);

    if (!agent) {
      return Response.json({ 
        success: false,
        error: 'Agent not found or webhook trigger not configured' 
      }, { status: 404 });
    }

    const triggerConfig = agent.trigger as TriggerConfig;
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/scheduler/webhook?agent_id=${agentId}`;

    return Response.json({
      success: true,
      webhook: {
        agent_id: agent.id,
        agent_name: agent.name,
        webhook_url: webhookUrl,
        has_secret: !!triggerConfig.webhook_secret,
        signature_required: !!triggerConfig.webhook_secret,
        headers_required: triggerConfig.webhook_secret ? ['x-emery-signature', 'x-emery-timestamp'] : [],
        example_curl: triggerConfig.webhook_secret 
          ? `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-emery-timestamp: $(date +%s)" \\
  -H "x-emery-signature: sha256=<HMAC-SHA256-SIGNATURE>" \\
  -d '{"message": "Hello from webhook"}'`
          : `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from webhook"}'`,
      },
    });

  } catch (error) {
    console.error('Error in webhook info endpoint:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}