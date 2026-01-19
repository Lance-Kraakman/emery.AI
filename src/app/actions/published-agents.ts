'use server';

import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission } from './permissions';
import { db } from '@/ddd/infrastructure/db/client';
import {
  DrizzlePublishedAgentRepository,
  DrizzlePublishedAgentApiKeyRepository,
} from '@/ddd/infrastructure/db/repositories/published-agents';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { DrizzleSecurityReportRepository } from '@/ddd/infrastructure/db/repositories/security/drizzle-security-report-repository';
import {
  getSecurityAnalyzerService,
  getAuditApplicationService,
} from '@/ddd/application/di/container';
import { PublicationApplicationService } from '@/ddd/application/services/published-agents';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type {
  PublishedAgent,
  PublishedAgentApiKey,
  PublishedAgentDTO,
  PublishedAgentApiKeyDTO,
} from '@/ddd/domain/published-agents/types';
import type { SecurityReport } from '@/ddd/domain/security/types';
import type { Result } from './types';
import { revalidatePath } from 'next/cache';

// ============================================================================
// REPOSITORY & SERVICE INITIALIZATION
// ============================================================================

function getPublicationService() {
  const publishedAgentRepository = new DrizzlePublishedAgentRepository(db);
  const apiKeyRepository = new DrizzlePublishedAgentApiKeyRepository(db);
  const agentRepository = new DrizzleAgentRepository(db);
  const securityReportRepository = new DrizzleSecurityReportRepository(db);
  const securityAnalyzer = getSecurityAnalyzerService();

  return new PublicationApplicationService(
    publishedAgentRepository,
    apiKeyRepository,
    agentRepository,
    securityReportRepository,
    securityAnalyzer
  );
}

// ============================================================================
// DTO MAPPERS
// ============================================================================

function toDTO(entity: PublishedAgent): PublishedAgentDTO {
  return {
    id: entity.id,
    agentId: entity.agentId,
    organizationId: entity.organizationId,
    slug: entity.slug,
    displayName: entity.displayName,
    description: entity.description,
    status: entity.status,
    publishedAt: entity.publishedAt?.toISOString() ?? null,
    publishedBy: entity.publishedBy,
    latestSecurityReportId: entity.latestSecurityReportId,
    securityApprovedAt: entity.securityApprovedAt?.toISOString() ?? null,
    securityApprovedBy: entity.securityApprovedBy,
    minSecurityGrade: entity.minSecurityGrade,
    allowTaskMode: entity.allowTaskMode,
    allowSkillMode: entity.allowSkillMode,
    billingMode: entity.billingMode,
    rateLimitPerMinute: entity.rateLimitPerMinute,
    rateLimitPerDay: entity.rateLimitPerDay,
    integrations: entity.integrations,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function apiKeyToDTO(entity: PublishedAgentApiKey): PublishedAgentApiKeyDTO {
  return {
    id: entity.id,
    publishedAgentId: entity.publishedAgentId,
    name: entity.name,
    keyPrefix: entity.keyPrefix,
    scopes: entity.scopes,
    lastUsedAt: entity.lastUsedAt?.toISOString() ?? null,
    usageCount: entity.usageCount,
    expiresAt: entity.expiresAt?.toISOString() ?? null,
    isRevoked: entity.isRevoked,
    createdAt: entity.createdAt.toISOString(),
  };
}

// ============================================================================
// PUBLICATION ACTIONS
// ============================================================================

/**
 * Initiate publication for an agent
 * Creates a draft and triggers security scan
 */
export async function initiatePublication(options: {
  agentId: number;
  slug: string;
  displayName: string;
  description?: string;
  allowTaskMode?: boolean;
  allowSkillMode?: boolean;
  minSecurityGrade?: 'A' | 'B' | 'C';
}): Promise<Result<{ publishedAgent: PublishedAgentDTO; securityReport?: SecurityReport }>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const service = getPublicationService();
      const auditService = getAuditApplicationService();

      const result = await service.initiatePublication({
        ...options,
        organizationId: session.user.currentOrganizationId!,
        initiatedBy: session.user.id,
      });

      // Audit log
      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent',
          eventAction: 'initiate_publication',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'published_agent',
          resourceId: result.success && result.data ? String(result.data.publishedAgent.id) : undefined,
          eventData: { agentId: options.agentId, slug: options.slug },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Publication initiation failed' };
      }

      revalidatePath('/agents');

      return {
        success: true,
        data: {
          publishedAgent: toDTO(result.data.publishedAgent),
          securityReport: result.data.securityReport,
        },
      };
    } catch (error) {
      console.error('Error initiating publication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate publication',
      };
    }
  });
}

/**
 * Approve publication after security review
 */
export async function approvePublication(
  publishedAgentId: number
): Promise<Result<PublishedAgentDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const service = getPublicationService();
      const auditService = getAuditApplicationService();

      const result = await service.approvePublication(publishedAgentId, session.user.id);

      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent',
          eventAction: 'approve_publication',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'published_agent',
          resourceId: String(publishedAgentId),
          eventData: { publishedAgentId },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Approval failed' };
      }

      revalidatePath('/agents');

      return { success: true, data: toDTO(result.data) };
    } catch (error) {
      console.error('Error approving publication:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve publication',
      };
    }
  });
}

/**
 * Publish the agent (make externally accessible)
 * Returns the generated API key (only shown once)
 */
export async function publishAgent(
  publishedAgentId: number
): Promise<Result<{ publishedAgent: PublishedAgentDTO; apiKey: string }>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const service = getPublicationService();
      const auditService = getAuditApplicationService();

      const result = await service.publish(publishedAgentId, session.user.id);

      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent',
          eventAction: 'publish',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'published_agent',
          resourceId: String(publishedAgentId),
          eventData: { publishedAgentId },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Publish failed' };
      }

      revalidatePath('/agents');

      return {
        success: true,
        data: {
          publishedAgent: toDTO(result.data.publishedAgent),
          apiKey: result.data.apiKey!,
        },
      };
    } catch (error) {
      console.error('Error publishing agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish agent',
      };
    }
  });
}

/**
 * Suspend a published agent
 */
export async function suspendPublishedAgent(
  publishedAgentId: number,
  reason: string
): Promise<Result<PublishedAgentDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const service = getPublicationService();
      const auditService = getAuditApplicationService();

      const result = await service.suspend(publishedAgentId, reason);

      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent',
          eventAction: 'suspend',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'published_agent',
          resourceId: String(publishedAgentId),
          eventData: { reason },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Suspend failed' };
      }

      revalidatePath('/agents');

      return { success: true, data: toDTO(result.data) };
    } catch (error) {
      console.error('Error suspending published agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suspend agent',
      };
    }
  });
}

/**
 * Resume a suspended agent
 */
export async function resumePublishedAgent(
  publishedAgentId: number
): Promise<Result<PublishedAgentDTO>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const service = getPublicationService();
      const auditService = getAuditApplicationService();

      const result = await service.resume(publishedAgentId);

      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent',
          eventAction: 'resume',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'published_agent',
          resourceId: String(publishedAgentId),
          eventData: { publishedAgentId },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Resume failed' };
      }

      revalidatePath('/agents');

      return { success: true, data: toDTO(result.data) };
    } catch (error) {
      console.error('Error resuming published agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume agent',
      };
    }
  });
}

// ============================================================================
// API KEY ACTIONS
// ============================================================================

/**
 * Generate a new API key for a published agent
 */
export async function generateApiKey(
  publishedAgentId: number,
  name: string
): Promise<Result<{ apiKey: PublishedAgentApiKeyDTO; plaintextKey: string }>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const service = getPublicationService();
      const auditService = getAuditApplicationService();

      const result = await service.generateNewApiKey(publishedAgentId, name);

      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent_api_key',
          eventAction: 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'api_key',
          resourceId: result.success && result.data ? String(result.data.apiKey.id) : undefined,
          eventData: { publishedAgentId, keyName: name },
          success: result.success,
          error: !result.success ? result.error : undefined,
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'API key generation failed' };
      }

      return {
        success: true,
        data: {
          apiKey: apiKeyToDTO(result.data.apiKey),
          plaintextKey: result.data.plaintextKey,
        },
      };
    } catch (error) {
      console.error('Error generating API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate API key',
      };
    }
  });
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(apiKeyId: number): Promise<Result<void>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const apiKeyRepository = new DrizzlePublishedAgentApiKeyRepository(db);
      const auditService = getAuditApplicationService();

      await apiKeyRepository.revoke(apiKeyId);

      auditService.logEvent(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        {
          eventType: 'agent',
          eventCategory: 'published_agent_api_key',
          eventAction: 'revoke',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'api_key',
          resourceId: String(apiKeyId),
          eventData: { apiKeyId },
          success: true,
        }
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error revoking API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke API key',
      };
    }
  });
}

// ============================================================================
// QUERY ACTIONS
// ============================================================================

/**
 * Get all published agents for the organization
 */
export async function getPublishedAgents(): Promise<Result<PublishedAgentDTO[]>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:view');
      const repository = new DrizzlePublishedAgentRepository(db);

      const agents = await repository.findByOrganization(session.user.currentOrganizationId!);

      return {
        success: true,
        data: agents.map(toDTO),
      };
    } catch (error) {
      console.error('Error fetching published agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch published agents',
      };
    }
  });
}

/**
 * Get a published agent by ID
 */
export async function getPublishedAgentById(id: number): Promise<Result<PublishedAgentDTO | null>> {
  return withAuthContext(async () => {
    try {
      await requirePermission('agents:view');
      const repository = new DrizzlePublishedAgentRepository(db);

      const agent = await repository.findById(id);

      return {
        success: true,
        data: agent ? toDTO(agent) : null,
      };
    } catch (error) {
      console.error('Error fetching published agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch published agent',
      };
    }
  });
}

/**
 * Get published agent by agent ID
 */
export async function getPublishedAgentByAgentId(agentId: number): Promise<Result<PublishedAgentDTO | null>> {
  return withAuthContext(async () => {
    try {
      await requirePermission('agents:view');
      const repository = new DrizzlePublishedAgentRepository(db);

      const agent = await repository.findByAgentId(agentId);

      return {
        success: true,
        data: agent ? toDTO(agent) : null,
      };
    } catch (error) {
      console.error('Error fetching published agent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch published agent',
      };
    }
  });
}

/**
 * Get API keys for a published agent
 */
export async function getApiKeysForPublishedAgent(
  publishedAgentId: number
): Promise<Result<PublishedAgentApiKeyDTO[]>> {
  return withAuthContext(async () => {
    try {
      await requirePermission('agents:view');
      const repository = new DrizzlePublishedAgentApiKeyRepository(db);

      const keys = await repository.findByPublishedAgentId(publishedAgentId, { isRevoked: false });

      return {
        success: true,
        data: keys.map(apiKeyToDTO),
      };
    } catch (error) {
      console.error('Error fetching API keys:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch API keys',
      };
    }
  });
}
