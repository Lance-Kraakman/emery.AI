import type { AuditActor, TriggerMetadata } from '@/app/actions/audit-helpers';
import type { NextRequest } from 'next/server';

export interface AgentRequestContext {
  isAgentRequest: boolean;
  actor: AuditActor;
  triggerMetadata?: TriggerMetadata;
}

/**
 * Extract agent context from HTTP request headers.
 *
 * When Python agent tools make API calls, they include headers:
 * - X-Agent-ID: Agent performing the action
 * - X-Agent-Name: Agent display name
 * - X-Task-ID: Task execution ID
 * - X-Task-Name: Task name
 * - X-Trigger-Type: How the task was triggered
 * - X-Triggered-By-User-Id: Root-cause user ID
 * - X-Triggered-By-User-Name: Root-cause user display name
 *
 * If X-Agent-ID is present, the request is from an agent.
 * Otherwise, it's a regular user request.
 */
export function extractAgentContext(
  request: NextRequest,
  fallbackUser: { id: string; name?: string | null }
): AgentRequestContext {
  const agentId = request.headers.get('X-Agent-ID');
  const agentName = request.headers.get('X-Agent-Name');

  if (agentId) {
    // Agent request - use agent as actor
    const actor: AuditActor = {
      type: 'agent',
      id: agentId,
      name: agentName || undefined,
    };

    // Build trigger metadata from headers
    const triggerMetadata: TriggerMetadata = {};
    const triggerType = request.headers.get('X-Trigger-Type');
    const triggeredByUserId = request.headers.get('X-Triggered-By-User-Id');
    const triggeredByUserName = request.headers.get('X-Triggered-By-User-Name');
    const taskId = request.headers.get('X-Task-ID');
    const taskName = request.headers.get('X-Task-Name');

    if (triggerType) triggerMetadata.triggerType = triggerType;
    if (triggeredByUserId) triggerMetadata.triggeredByUserId = triggeredByUserId;
    if (triggeredByUserName) triggerMetadata.triggeredByUserName = triggeredByUserName;
    if (taskId) triggerMetadata.taskId = taskId;
    if (taskName) triggerMetadata.taskName = taskName;
    triggerMetadata.agentId = agentId;
    if (agentName) triggerMetadata.agentName = agentName;

    return {
      isAgentRequest: true,
      actor,
      triggerMetadata,
    };
  }

  // Regular user request
  return {
    isAgentRequest: false,
    actor: {
      type: 'user',
      id: fallbackUser.id,
      name: fallbackUser.name || undefined,
    },
  };
}
