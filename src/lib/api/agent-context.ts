import type { AuditActor, AuditTriggerType, TriggerMetadata } from '@/app/actions/audit-helpers';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { getAuditApplicationService } from '@/ddd/application/di/container';
import type { NextRequest } from 'next/server';

const VALID_TRIGGER_TYPES = new Set<AuditTriggerType>(['manual', 'webhook', 'database_event', 'calendar', 'public_api']);

function parseAuditTriggerType(value: string): AuditTriggerType | undefined {
  return VALID_TRIGGER_TYPES.has(value as AuditTriggerType) ? (value as AuditTriggerType) : undefined;
}

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

    if (triggerType) triggerMetadata.triggerType = parseAuditTriggerType(triggerType);
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

/**
 * Extract actor override from request headers (convenience wrapper).
 *
 * Returns an ActorOverride if the request is from an agent, or undefined
 * for regular user requests. Eliminates repeated ternary patterns in routes.
 */
export function extractActorOverride(
  request: NextRequest,
  fallbackUser: { id: string; name?: string | null }
): { actor: AuditActor; triggerMetadata?: TriggerMetadata } | undefined {
  const ctx = extractAgentContext(request, fallbackUser);
  if (!ctx.isAgentRequest) return undefined;
  return { actor: ctx.actor, triggerMetadata: ctx.triggerMetadata };
}

/**
 * Log an audit event for agent-initiated mutations on non-row resources.
 *
 * Call this in API routes that don't have per-entity audit logging in their
 * server actions. Only logs if the request is from an agent (no-op for users).
 */
export function logAgentMutation(
  request: NextRequest,
  user: { id: string; name?: string | null; organizationId?: number | null },
  params: {
    action: 'create' | 'update' | 'delete';
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
  },
): void {
  if (!user.organizationId) return;

  const ctx = extractAgentContext(request, user);
  if (!ctx.isAgentRequest) return;

  const auditService = getAuditApplicationService();
  auditService.logEvent(OrganizationId.fromNumber(user.organizationId), {
    eventType: 'database',
    eventCategory: `${params.resourceType}_crud`,
    eventAction: params.action,
    actorType: ctx.actor.type,
    actorId: ctx.actor.id,
    actorName: ctx.actor.name,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    resourceName: params.resourceName,
    eventData: {},
    metadata: ctx.triggerMetadata ? { ...ctx.triggerMetadata } : undefined,
    success: true,
  });
}
