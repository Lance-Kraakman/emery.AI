'use server'

/**
 * Context Mapping Server Actions
 *
 * Manages context table attachments for agents, skills, and skill steps.
 * Uses withServerAction pattern for consistent auth, RLS, and audit logging.
 */

import { withServerAction, withReadOnlyAction } from './lib/with-server-action';
import { getContextMappingApplicationService } from '@/ddd/application/di/container';
import type { Result } from './types';
import type {
  ContextMappingTargetType,
  ContextMappingAccessMode,
  ContextMappingSyncMode,
} from '@/ddd/domain/context/entities/context-mapping';

// ============================================================================
// Types
// ============================================================================

export interface AttachContextTableData {
  targetType: ContextMappingTargetType;
  targetId: string;
  tableId: number;
  tableName: string;
  accessMode?: ContextMappingAccessMode;
  syncMode?: ContextMappingSyncMode;
}

export interface UpdateContextMappingData {
  accessMode?: ContextMappingAccessMode;
  syncMode?: ContextMappingSyncMode;
}

export interface ContextMappingDTO {
  id: number;
  organizationId: number;
  targetType: ContextMappingTargetType;
  targetId: string;
  tableId: number;
  tableName: string;
  accessMode: ContextMappingAccessMode;
  syncMode: ContextMappingSyncMode;
  isSystem: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
}

export interface ResolvedContextDTO {
  mappings: ContextMappingDTO[];
  readTables: ContextMappingDTO[];
  writeTables: ContextMappingDTO[];
}

// ============================================================================
// Helpers
// ============================================================================

function toDTO(mapping: any): ContextMappingDTO {
  return {
    id: mapping.id,
    organizationId: mapping.organizationId?.value ?? mapping.organizationId,
    targetType: mapping.targetType,
    targetId: mapping.targetId,
    tableId: mapping.tableId?.value ?? mapping.tableId,
    tableName: mapping.tableName,
    accessMode: mapping.accessMode,
    syncMode: mapping.syncMode,
    isSystem: mapping.isSystem,
    createdAt: mapping.createdAt?.toISOString?.() ?? mapping.createdAt,
    createdBy: mapping.createdBy?.value ?? mapping.createdBy,
    updatedAt: mapping.updatedAt?.toISOString?.() ?? mapping.updatedAt,
  };
}

/**
 * Get appropriate permission based on target type
 */
function getPermissionForTarget(targetType: ContextMappingTargetType): string {
  switch (targetType) {
    case 'agent':
      return 'agents:manage';
    case 'skill':
    case 'skill_step':
      return 'skills:manage';
    default:
      return 'agents:manage';
  }
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Attach a table to an agent, skill, or skill step as context
 */
export async function attachContextTable(
  data: AttachContextTableData
): Promise<Result<ContextMappingDTO>> {
  return withServerAction(
    getPermissionForTarget(data.targetType),
    async ({ session, org }) => {
      const service = getContextMappingApplicationService();
      const mapping = await service.attachContextTable({
        organizationId: org.id,
        targetType: data.targetType,
        targetId: data.targetId,
        tableId: data.tableId,
        tableName: data.tableName,
        accessMode: data.accessMode,
        syncMode: data.syncMode,
        createdBy: session.user.id,
      });

      return {
        success: true,
        data: toDTO(mapping),
      };
    },
    {
      eventType: 'agent',
      eventCategory: 'context_mapping',
      eventAction: 'attach',
      resourceType: 'context_mapping',
      eventData: { targetType: data.targetType, tableName: data.tableName },
    },
    { defaultRevalidatePath: '/manage' }
  );
}

/**
 * Detach a table from context
 */
export async function detachContextTable(mappingId: number): Promise<Result> {
  return withServerAction(
    'agents:manage', // Generic permission - RLS handles target-specific access
    async () => {
      const service = getContextMappingApplicationService();
      await service.detachContextTable(mappingId);

      return {
        success: true,
        data: { id: mappingId },
      };
    },
    {
      eventType: 'agent',
      eventCategory: 'context_mapping',
      eventAction: 'detach',
      resourceType: 'context_mapping',
    },
    { defaultRevalidatePath: '/manage' }
  );
}

/**
 * Update context mapping access or sync mode
 */
export async function updateContextMapping(
  mappingId: number,
  data: UpdateContextMappingData
): Promise<Result<ContextMappingDTO>> {
  return withServerAction(
    'agents:manage', // Generic permission - RLS handles target-specific access
    async () => {
      const service = getContextMappingApplicationService();
      const mapping = await service.updateContextMapping(mappingId, data);

      return {
        success: true,
        data: toDTO(mapping),
      };
    },
    {
      eventType: 'agent',
      eventCategory: 'context_mapping',
      eventAction: 'update',
      resourceType: 'context_mapping',
      eventData: { ...data },
    },
    { defaultRevalidatePath: '/manage' }
  );
}

/**
 * Get all context mappings for a target (agent, skill, or skill step)
 */
export async function getContextMappings(
  targetType: ContextMappingTargetType,
  targetId: string
): Promise<ContextMappingDTO[]> {
  return withReadOnlyAction(
    getPermissionForTarget(targetType),
    async () => {
      const service = getContextMappingApplicationService();
      const mappings = await service.getContextMappings(targetType, targetId);
      return mappings.map(toDTO);
    }
  );
}

/**
 * Resolve context for agent execution
 * Merges mappings respecting hierarchy: agent → skill → step
 */
export async function resolveContextForExecution(
  agentId: number,
  skillId?: number,
  stepId?: string
): Promise<ResolvedContextDTO> {
  return withReadOnlyAction('agents:view', async ({ org }) => {
    const service = getContextMappingApplicationService();
    const resolved = await service.resolveContextForExecution(
      org.id,
      agentId,
      skillId,
      stepId
    );

    return {
      mappings: resolved.mappings.map(toDTO),
      readTables: resolved.readTables.map(toDTO),
      writeTables: resolved.writeTables.map(toDTO),
    };
  });
}

/**
 * Find all usages of a table in context mappings
 * Useful for showing warnings when deleting a table
 */
export async function findTableUsages(
  tableId: number
): Promise<ContextMappingDTO[]> {
  return withReadOnlyAction('databases:view', async () => {
    const service = getContextMappingApplicationService();
    const mappings = await service.findTableUsages(tableId);
    return mappings.map(toDTO);
  });
}
