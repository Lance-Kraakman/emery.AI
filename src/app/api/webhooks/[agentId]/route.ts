import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { z } from 'zod';
import { AgentId } from '@/ddd/domain/shared/value-objects';
import { getAgentRepository, getAgentTaskApplicationService } from '@/ddd/application/di/container';
import { withSystemContext } from '@/lib/db/system-context';
import { WebhookTriggerConfig, TriggerConfigFromJSON } from '@/ddd/domain/scheduling/value-objects/trigger-config';

// AIDEV-NOTE: Webhook API endpoint for triggering agent tasks via external HTTP calls
// Provides multi-layer security: API key + HMAC signature + origin validation

const webhookPayloadSchema = z.object({
  message: z.string().optional(),
  data: z.record(z.any()).optional(),
  timestamp: z.string().optional(),
});

type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

interface RouteParams {
  params: Promise<{
    agentId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId: agentIdParam } = await params;
    const agentId = AgentId.fromNumber(parseInt(agentIdParam));
    const requestHeaders = await headers();
    
    // Extract authorization header
    const authHeader = requestHeaders.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header. Expected: Bearer <api_key>' },
        { status: 401 }
      );
    }
    
    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      );
    }
    
    // Get agent and validate API key
    const agentRepository = getAgentRepository();
    const agent = await agentRepository.findById(agentId);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Validate API key
    if (!agent.apiKey || agent.apiKey.value !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    // Check if agent has webhook trigger configured
    if (!agent.trigger) {
      return NextResponse.json(
        { error: 'Agent does not have webhook trigger configured' },
        { status: 400 }
      );
    }
    
    let webhookConfig: WebhookTriggerConfig;
    try {
      const triggerConfig = TriggerConfigFromJSON(agent.trigger);
      if (!(triggerConfig instanceof WebhookTriggerConfig)) {
        return NextResponse.json(
          { error: 'Agent is not configured for webhook triggers' },
          { status: 400 }
        );
      }
      webhookConfig = triggerConfig;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid webhook trigger configuration' },
        { status: 500 }
      );
    }
    
    if (!webhookConfig.isEnabled()) {
      return NextResponse.json(
        { error: 'Webhook trigger is disabled for this agent' },
        { status: 400 }
      );
    }
    
    // Validate origin if specified
    const origin = requestHeaders.get('origin');
    if (origin && !webhookConfig.isOriginAllowed(origin)) {
      return NextResponse.json(
        { error: 'Origin not allowed' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const rawBody = await request.text();
    let payload: WebhookPayload;
    
    try {
      const jsonPayload = JSON.parse(rawBody);
      payload = webhookPayloadSchema.parse(jsonPayload);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    
    // Verify HMAC signature if required
    if (webhookConfig.requiresSignature) {
      const signature = requestHeaders.get('x-webhook-signature');
      if (!signature) {
        return NextResponse.json(
          { error: 'Webhook signature required but not provided' },
          { status: 401 }
        );
      }
      
      if (!webhookConfig.webhookSecret) {
        return NextResponse.json(
          { error: 'Webhook secret not configured' },
          { status: 500 }
        );
      }
      
      // Verify HMAC-SHA256 signature
      const expectedSignature = crypto
        .createHmac('sha256', webhookConfig.webhookSecret)
        .update(rawBody)
        .digest('hex');
      
      const providedSignature = signature.startsWith('sha256=') 
        ? signature.substring(7) 
        : signature;
      
      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }
    
    // Create and execute task
    const agentTaskService = getAgentTaskApplicationService();
    
    await withSystemContext(agent.organizationId, async () => {
      try {
        // Service accepts primitives and returns Result<TaskDTO>
        const createResult = await agentTaskService.createTask({
          agentId: agent.id.value,
          organizationId: agent.organizationId.value,
          name: 'Webhook Trigger',
          capabilityName: undefined,
          instructions: {
            instructions: payload.message || 'Webhook triggered task',
            metadata: payload.data
          }
        });

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to create task');
        }

        // Execute the task immediately
        const executeResult = await agentTaskService.executeTask({ taskId: createResult.data!.id });

        if (!executeResult.success) {
          throw new Error(executeResult.error || 'Failed to execute task');
        }

        console.log(`✅ Webhook triggered task for agent ${agent.name} (${agent.id.value})`);
      } catch (error) {
        console.error(`❌ Failed to create/execute webhook task for agent ${agent.id.value}:`, error);
        throw error;
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Webhook received and task executed',
      agentId: agent.id.value,
      agentName: agent.name,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to provide webhook information
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId: agentIdParam } = await params;
    const agentId = AgentId.fromNumber(parseInt(agentIdParam));
    const agentRepository = getAgentRepository();
    const agent = await agentRepository.findById(agentId);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Check if agent has webhook trigger configured
    if (!agent.trigger) {
      return NextResponse.json({
        configured: false,
        message: 'Agent does not have webhook trigger configured'
      });
    }
    
    let webhookConfig: WebhookTriggerConfig;
    try {
      const triggerConfig = TriggerConfigFromJSON(agent.trigger);
      if (!(triggerConfig instanceof WebhookTriggerConfig)) {
        return NextResponse.json({
          configured: false,
          message: 'Agent is not configured for webhook triggers'
        });
      }
      webhookConfig = triggerConfig;
    } catch (error) {
      return NextResponse.json({
        configured: false,
        message: 'Invalid webhook trigger configuration'
      });
    }
    
    return NextResponse.json({
      configured: true,
      enabled: webhookConfig.isEnabled(),
      requiresSignature: webhookConfig.requiresSignature,
      allowedOrigins: webhookConfig.allowedOrigins,
      hasSecret: !!webhookConfig.webhookSecret,
      agentName: agent.name,
      webhookUrl: `${request.nextUrl.origin}/api/webhooks/${agent.id.value}`,
      documentation: {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer <agent_api_key>',
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=<hmac_signature> (if signature required)'
        },
        payload: {
          message: 'Optional message for the task',
          data: { 'key': 'value' },
          timestamp: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('Webhook info endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}