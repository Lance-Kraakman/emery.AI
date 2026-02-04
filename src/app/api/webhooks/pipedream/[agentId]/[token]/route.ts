import { NextRequest, NextResponse } from 'next/server';
import { AgentId } from '@/ddd/domain/shared/value-objects';
import { getAgentRepository, getAgentTaskApplicationService } from '@/ddd/application/di/container';
import { withSystemContext } from '@/ddd/infrastructure/db/system-context';
import { PipedreamEventTriggerConfig, TriggerConfigFromJSON } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { timingSafeEqual } from '@/lib/security/timing-safe';

/**
 * Pipedream Event Source Webhook Receiver
 *
 * AIDEV-NOTE: This endpoint receives events from Pipedream sources (triggers).
 * SECURITY: Uses per-agent webhook token in URL for authentication.
 *
 * When a Pipedream source fires (e.g., new Gmail email), it POSTs here with
 * the event payload. We then:
 * 1. Validate the webhook token from URL
 * 2. Find the agent and matching PIPEDREAM_EVENT automation
 * 3. Extract variables from the payload for skill input mapping
 * 4. Create and execute a task with the skill
 */

interface RouteParams {
  params: Promise<{
    agentId: string;
    token: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId: agentIdParam, token } = await params;
    const agentId = AgentId.fromNumber(parseInt(agentIdParam));

    console.log(`[PipedreamWebhook] Received event for agent ${agentIdParam}`);

    // Get agent and validate webhook token
    const agentRepository = getAgentRepository();
    const agent = await agentRepository.findById(agentId);

    if (!agent) {
      console.error('[PipedreamWebhook] Agent not found:', agentIdParam);
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // SECURITY: Validate webhook token
    if (!timingSafeEqual(agent.webhookToken, token)) {
      console.error('[PipedreamWebhook] Invalid webhook token for agent:', agentIdParam);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid webhook token' },
        { status: 401 }
      );
    }

    // Parse the Pipedream event payload
    const rawBody = await request.text();
    let payload: Record<string, any>;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[PipedreamWebhook] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // SECURITY: Log payload size only, not content (may contain PII)
    console.log('[PipedreamWebhook] Payload received, size:', rawBody.length, 'bytes');

    // Find matching PIPEDREAM_EVENT automation
    let matchingAutomation: typeof agent.automations[number] | null = null;
    let pipedreamConfig: PipedreamEventTriggerConfig | null = null;

    for (const automation of agent.automations) {
      const trigger = TriggerConfigFromJSON(automation.trigger);
      if (trigger instanceof PipedreamEventTriggerConfig && trigger.isEnabled()) {
        // Verify source ID matches if we have one
        if (trigger.pipedreamSourceId) {
          // Pipedream may send the source_id in headers or payload
          const requestSourceId = request.headers.get('x-pd-source-id') || payload.source_id;
          if (requestSourceId && requestSourceId !== trigger.pipedreamSourceId) {
            console.log('[PipedreamWebhook] Source ID mismatch, checking next automation');
            continue;
          }
        }
        matchingAutomation = automation;
        pipedreamConfig = trigger;
        break;
      }
    }

    if (!matchingAutomation || !pipedreamConfig) {
      console.error('[PipedreamWebhook] No matching PIPEDREAM_EVENT automation found');
      return NextResponse.json(
        { error: 'No matching Pipedream event automation found' },
        { status: 400 }
      );
    }

    console.log('[PipedreamWebhook] Found matching automation:', {
      name: matchingAutomation.name,
      skillId: matchingAutomation.skillId,
      triggerType: pipedreamConfig.triggerType
    });

    // Build event variables for skill input mapping
    // These match the variables shown in the UI (generateVariableSamples)
    const eventVariables: Record<string, string> = {
      '$event.app': pipedreamConfig.connectionId.split('-')[0] || 'unknown',
      '$event.type': pipedreamConfig.triggerType,
      '$event.timestamp': new Date().toISOString(),
      '$event.payload': JSON.stringify(payload),
    };

    // Flatten payload fields as individual $event.* variables
    flattenPayload(payload, '$event', eventVariables);

    console.log('[PipedreamWebhook] Event variables:', Object.keys(eventVariables));

    // Create and execute task
    const agentTaskService = getAgentTaskApplicationService();

    await withSystemContext(agent.organizationId, async () => {
      try {
        // Build task with mapped skill inputs
        const skillId = matchingAutomation!.skillId;
        const inputMappings = matchingAutomation!.inputMappings || [];

        // Apply input mappings to resolve variable values
        // mappings use: { triggerField: "$event.email.from", skillInputName: "senderEmail" }
        const resolvedInputs: Record<string, any> = {};
        for (const mapping of inputMappings) {
          if (mapping.triggerField.startsWith('$event.')) {
            resolvedInputs[mapping.skillInputName] = eventVariables[mapping.triggerField] || '';
          } else if (mapping.triggerField.startsWith('static:')) {
            resolvedInputs[mapping.skillInputName] = mapping.triggerField.slice(7);
          } else {
            resolvedInputs[mapping.skillInputName] = mapping.triggerField;
          }
        }

        // SECURITY: Log input field names only, not values (may contain PII)
        console.log('[PipedreamWebhook] Resolved inputs for fields:', Object.keys(resolvedInputs));

        // Create task
        const createResult = await agentTaskService.createTask({
          agentId: agent.id.value,
          organizationId: agent.organizationId.value,
          name: matchingAutomation!.name || 'Pipedream Event',
          skillId: skillId || undefined,
          instructions: {
            task: `Pipedream event triggered: ${pipedreamConfig!.triggerType}`,
            metadata: {
              triggeredBy: 'pipedream_event',
              triggerType: pipedreamConfig!.triggerType,
              sourceId: pipedreamConfig!.pipedreamSourceId,
              eventVariables,
              resolvedInputs  // Pass resolved inputs in metadata for skill execution
            }
          }
        });

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to create task');
        }

        console.log('[PipedreamWebhook] Task created:', createResult.data!.id);

        // Execute the task immediately
        const executeResult = await agentTaskService.executeTask({ taskId: createResult.data!.id });

        if (!executeResult.success) {
          throw new Error(executeResult.error || 'Failed to execute task');
        }

        console.log(`[PipedreamWebhook] Task executed for agent ${agent.name} (${agent.id.value})`);
      } catch (error) {
        console.error(`[PipedreamWebhook] Failed to create/execute task for agent ${agent.id.value}:`, error);
        throw error;
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Pipedream event received and task executed',
      agentId: agent.id.value,
      agentName: agent.name,
      automation: matchingAutomation.name,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[PipedreamWebhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Flatten a nested object into dot-notation keys
 * e.g., { email: { subject: "Hi" } } => { "$event.email.subject": "Hi" }
 */
function flattenPayload(
  obj: Record<string, any>,
  prefix: string,
  result: Record<string, string>,
  maxDepth: number = 3,
  currentDepth: number = 0
): void {
  if (currentDepth >= maxDepth) return;

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = `${prefix}.${key}`;

    if (value === null || value === undefined) {
      result[fullKey] = '';
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      flattenPayload(value, fullKey, result, maxDepth, currentDepth + 1);
      // Also add the stringified version
      result[fullKey] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = String(value);
    }
  }
}

// GET endpoint for health check / debugging
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId: agentIdParam, token } = await params;
    const agentId = AgentId.fromNumber(parseInt(agentIdParam));
    const agentRepository = getAgentRepository();
    const agent = await agentRepository.findById(agentId);

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // SECURITY: Validate webhook token
    if (!timingSafeEqual(agent.webhookToken, token)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid webhook token' },
        { status: 401 }
      );
    }

    // Find Pipedream event automations
    const pipedreamAutomations = agent.automations
      .filter(a => a.trigger.type === 'PIPEDREAM_EVENT')
      .map(a => ({
        name: a.name,
        enabled: a.enabled,
        skillId: a.skillId,
        triggerType: (a.trigger as any).triggerType
      }));

    return NextResponse.json({
      agentId: agent.id.value,
      agentName: agent.name,
      pipedreamAutomations,
      webhookUrl: `${request.nextUrl.origin}/api/webhooks/pipedream/${agent.id.value}/${token}`,
      message: pipedreamAutomations.length > 0
        ? 'Pipedream event webhook is configured'
        : 'No Pipedream event automations found'
    });

  } catch (error) {
    console.error('[PipedreamWebhook] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
