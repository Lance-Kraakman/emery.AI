'use server';

import { revalidatePath } from 'next/cache';
import { getSkillApplicationService, getAgentApplicationService, getStorageQuotaApplicationService, getAuditApplicationService } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requirePermission, requireResourcePermission } from './permissions';
import type { Result } from '@/ddd/domain/shared/result';
import type { InputDefinition, OutputDefinition, ToolConfigDTO } from '@/app/mappers/skill-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { s3SkillAttachmentService } from '@/ddd/infrastructure/multimodal/s3-skill-attachment-service';
import type { AttachmentMetadata, AttachmentType } from '@/ddd/domain/multimodal/value-objects/attachment-metadata';
import type { MessagePart } from '@/ddd/infrastructure/grpc/generated/agent_worker';
import type { SkillExecutionType, ToolExecutionConfig, WriteConfig, ReadConfig, SkillStep, CanvasMetadata } from '@/ddd/domain/skills/entities/skill';

/**
 * Server Actions for Skill Management
 *
 * Provides CRUD operations for skills with authentication and permission checks.
 * All actions return standardized Result<T> responses.
 *
 * AIDEV-NOTE: Simplified single-instruction model - removed all step-related actions
 *
 * AIDEV-NOTE: Permission Enforcement
 * - Agent-scoped skills: Requires `agents:manage` permission (checked via RLS on agents table)
 * - Organization skills: Requires `skills:view`, `skills:create`, `skills:manage` (checked via RLS)
 * - RLS policies in schema.ts automatically enforce permissions at database layer
 * - Actions only need auth check; permission enforcement handled by database
 */

/**
 * Create a new skill
 * All skills are now workflows - node configs live in steps[]
 */
export async function createSkill(command: {
  agentId: number;
  name: string;
  description?: string;
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  instructions?: string;
  tools?: ToolConfigDTO[];
  model?: string | null;
  agentType?: string | null;
  executionType?: SkillExecutionType;
  taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> };
  toolExecutionConfig?: ToolExecutionConfig;
  writeConfig?: WriteConfig;
  readConfig?: ReadConfig;
  steps?: SkillStep[];
  canvasMetadata?: CanvasMetadata;
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission to manage the agent
    await requireResourcePermission("agents:manage", "agent", command.agentId);

    // Validation - only name is required
    if (!command.name?.trim()) {
      return { success: false, error: 'Skill name is required' };
    }

    // Validate input names if provided
    const inputs = command.inputs || [];
    const invalidInputs = inputs.filter(i => !i.name?.trim());
    if (invalidInputs.length > 0) {
      return { success: false, error: 'All inputs must have names' };
    }

    // Validate output names if provided
    const outputs = command.outputs || [];
    const invalidOutputs = outputs.filter(o => !o.name?.trim());
    if (invalidOutputs.length > 0) {
      return { success: false, error: 'All outputs must have names' };
    }

    // Get agent to retrieve organizationId
    const agentService = getAgentApplicationService();
    const agent = await agentService.getAgent(AgentId.fromNumber(command.agentId));
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    const service = getSkillApplicationService();
    const result = await service.createSkill({
      ...command,
      inputs: inputs,
      outputs: outputs,
      instructions: command.instructions || '',
      tools: command.tools || [],
      organizationId: agent.organizationId.value
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch the created skill to return full DTO
    const skillResult = await service.getSkill(result.data!.value);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Failed to fetch created skill' };
    }

    // AUDIT: Log skill creation
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(agent.organizationId.value),
      {
        eventType: 'agent',
        eventCategory: 'skill_crud',
        eventAction: 'create',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'skill',
        resourceId: String(result.data!.value),
        resourceName: command.name,
        parentResourceType: 'agent',
        parentResourceId: String(command.agentId),
        eventData: { executionType: command.executionType },
        success: true,
      }
    );

    // Revalidate sidebar and skill pages
    revalidatePath(`/agents/${command.agentId}/skills`);
    revalidatePath('/');

    return {
      success: true,
      data: SkillMapper.toDTO(skillResult.data)
    };
  } catch (error) {
    console.error('[createSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create skill'
    };
  }
}

/**
 * Create a new organization skill (organization-level, not agent-specific)
 */
export async function createOrganizationSkill(command: {
  organizationId: number;
  name: string;
  description?: string;
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  instructions?: string;
  tools?: ToolConfigDTO[];
  model?: string | null;
  agentType?: string | null;
  executionType?: SkillExecutionType;
  taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> };
  toolExecutionConfig?: ToolExecutionConfig;
  writeConfig?: WriteConfig;
  steps?: SkillStep[];
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission to create organization skills
    await requirePermission("skills:create");

    // Validation - only name is required
    if (!command.name?.trim()) {
      return { success: false, error: 'Skill name is required' };
    }

    // Validate input names if provided
    const inputs = command.inputs || [];
    const invalidInputs = inputs.filter(i => !i.name?.trim());
    if (invalidInputs.length > 0) {
      return { success: false, error: 'All inputs must have names' };
    }

    // Validate output names if provided
    const outputs = command.outputs || [];
    const invalidOutputs = outputs.filter(o => !o.name?.trim());
    if (invalidOutputs.length > 0) {
      return { success: false, error: 'All outputs must have names' };
    }

    const service = getSkillApplicationService();

    // Create organization skill without agentId (null for organization-scoped)
    const result = await service.createSkill({
      agentId: null,
      organizationId: command.organizationId,
      name: command.name,
      description: command.description,
      inputs: inputs,
      outputs: outputs,
      instructions: command.instructions || '',
      tools: command.tools || [],
      model: command.model,
      agentType: command.agentType,
      executionType: command.executionType,
      taskModelConfig: command.taskModelConfig,
      toolExecutionConfig: command.toolExecutionConfig,
      writeConfig: command.writeConfig,
      steps: command.steps
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch the created skill to return full DTO
    const skillResult = await service.getSkill(result.data!.value);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Failed to fetch created skill' };
    }

    // AUDIT: Log organization skill creation
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(command.organizationId),
      {
        eventType: 'agent',
        eventCategory: 'skill_crud',
        eventAction: 'create',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'skill',
        resourceId: String(result.data!.value),
        resourceName: command.name,
        eventData: { executionType: command.executionType, isOrganizationSkill: true },
        success: true,
      }
    );

    // Revalidate sidebar and skills pages
    revalidatePath('/skills');
    revalidatePath('/');

    return {
      success: true,
      data: SkillMapper.toDTO(skillResult.data)
    };
  } catch (error) {
    console.error('[createOrganizationSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create organization skill'
    };
  }
}

/**
 * Update an existing skill
 */
export async function updateSkill(
  skillId: number,
  command: {
    name?: string;
    description?: string;
    inputs?: InputDefinition[];
    outputs?: OutputDefinition[];
    instructions?: string;
    tools?: ToolConfigDTO[];
    model?: string | null;
    agentType?: string | null; // "tool_calling" (default) or "code_agent"
    executionType?: SkillExecutionType;
    taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> } | null;
    toolExecutionConfig?: ToolExecutionConfig | null;
    writeConfig?: WriteConfig | null;
    readConfig?: ReadConfig | null; // Config for 'read' execution
    steps?: SkillStep[] | null; // Steps for 'agent' (step-based) execution
    canvasMetadata?: CanvasMetadata | null; // Canvas annotations (sticky notes)
    content?: MessagePart[]; // Skill-level attachments
  }
): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();

    // Fetch skill to determine if agent-scoped or org-level
    const skillResult = await service.getSkill(skillId);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    const skill = skillResult.data;

    // Prevent editing of system skills
    if (skill.isSystem) {
      return { success: false, error: 'System skills cannot be edited. Duplicate this skill to create your own version.' };
    }

    // Check appropriate permission based on skill type
    if (skill.agentId) {
      // Agent-scoped skill: check agent management permission
      await requireResourcePermission("agents:manage", "agent", skill.agentId.value);
    } else {
      // Org-level skill: check skill management permission
      await requireResourcePermission("skills:manage", "skill", skillId);
    }

    console.log('[updateSkill] action received:', {
      stepsInCommand: 'steps' in command,
      steps: command.steps,
      stepsLength: command.steps?.length
    });

    const result = await service.updateSkill(skillId, command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated skill to return full DTO
    const updatedSkillResult = await service.getSkill(skillId);
    if (!updatedSkillResult.success || !updatedSkillResult.data) {
      return { success: false, error: 'Failed to fetch updated skill' };
    }

    // AUDIT: Log skill update
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      skill.organizationId,
      {
        eventType: 'agent',
        eventCategory: 'skill_crud',
        eventAction: 'update',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'skill',
        resourceId: String(skillId),
        resourceName: updatedSkillResult.data.name,
        parentResourceType: skill.agentId ? 'agent' : undefined,
        parentResourceId: skill.agentId ? String(skill.agentId.value) : undefined,
        eventData: { updatedFields: Object.keys(command) },
        success: true,
      }
    );

    // Revalidate sidebar and skill pages
    const updatedSkill = updatedSkillResult.data;
    if (updatedSkill.agentId) {
      revalidatePath(`/agents/${updatedSkill.agentId.value}/skills`);
    } else {
      revalidatePath('/skills');
    }
    revalidatePath('/');

    return {
      success: true,
      data: SkillMapper.toDTO(updatedSkillResult.data)
    };
  } catch (error) {
    console.error('[updateSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update skill'
    };
  }
}

/**
 * Delete a skill
 * System skills (isSystem=true) cannot be deleted
 */
export async function deleteSkill(skillId: number): Promise<Result<void>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();

    // Get skill info before deleting for permission check and revalidation
    const skillResult = await service.getSkill(skillId);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    const skill = skillResult.data;
    const agentId = skill.agentId?.value ?? null;

    // Prevent deletion of system skills
    if (skill.isSystem) {
      return { success: false, error: 'System skills cannot be deleted. You can duplicate this skill to create your own version.' };
    }

    // Check appropriate permission based on skill type
    if (skill.agentId) {
      // Agent-scoped skill: check agent management permission
      await requireResourcePermission("agents:manage", "agent", skill.agentId.value);
    } else {
      // Org-level skill: check skill management permission
      await requireResourcePermission("skills:manage", "skill", skillId);
    }

    const result = await service.deleteSkill(skillId);

    if (result.success) {
      // AUDIT: Log skill deletion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        skill.organizationId,
        {
          eventType: 'agent',
          eventCategory: 'skill_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'skill',
          resourceId: String(skillId),
          resourceName: skill.name,
          parentResourceType: skill.agentId ? 'agent' : undefined,
          parentResourceId: skill.agentId ? String(skill.agentId.value) : undefined,
          eventData: {},
          success: true,
        }
      );

      // Revalidate sidebar and skill pages
      if (agentId) {
        revalidatePath(`/agents/${agentId}/skills`);
      } else {
        revalidatePath('/skills');
      }
      revalidatePath('/');
    }

    return result;
  } catch (error) {
    console.error('[deleteSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete skill'
    };
  }
}

/**
 * Duplicate an existing skill
 * Appends " (Copy)" to the skill name
 */
export async function duplicateSkill(skillId: number): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();

    // Get the original skill
    const skillResult = await service.getSkill(skillId);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    const originalSkill = skillResult.data;

    // Create new name with " (Copy)" suffix
    const newName = `${originalSkill.name} (Copy)`;

    // Create the duplicate skill (copy all settings including execution type)
    const createResult = await service.createSkill({
      agentId: originalSkill.agentId?.value || null,
      organizationId: originalSkill.organizationId.value,
      name: newName,
      description: originalSkill.description,
      inputs: originalSkill.inputs,
      outputs: originalSkill.outputs,
      instructions: originalSkill.instructions,
      tools: originalSkill.tools,
      model: originalSkill.model,
      agentType: originalSkill.agentType,
      executionType: originalSkill.executionType,
      taskModelConfig: originalSkill.taskModelConfig,
      toolExecutionConfig: originalSkill.toolExecutionConfig,
      writeConfig: originalSkill.writeConfig,
      steps: originalSkill.steps
    });

    if (!createResult.success || !createResult.data) {
      return {
        success: false,
        error: createResult.error || 'Failed to duplicate skill'
      };
    }

    // Fetch the created skill to return full DTO
    const newSkillResult = await service.getSkill(createResult.data.value);
    if (!newSkillResult.success || !newSkillResult.data) {
      return { success: false, error: 'Failed to fetch duplicated skill' };
    }

    // AUDIT: Log skill duplication
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      originalSkill.organizationId,
      {
        eventType: 'agent',
        eventCategory: 'skill_crud',
        eventAction: 'create',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'skill',
        resourceId: String(createResult.data.value),
        resourceName: newName,
        parentResourceType: originalSkill.agentId ? 'agent' : undefined,
        parentResourceId: originalSkill.agentId ? String(originalSkill.agentId.value) : undefined,
        eventData: { duplicatedFrom: skillId, originalName: originalSkill.name },
        success: true,
      }
    );

    // Revalidate sidebar and skill pages
    if (originalSkill.agentId) {
      revalidatePath(`/agents/${originalSkill.agentId.value}/skills`);
    } else {
      revalidatePath('/skills');
    }
    revalidatePath('/');

    return {
      success: true,
      data: SkillMapper.toDTO(newSkillResult.data)
    };
  } catch (error) {
    console.error('[duplicateSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to duplicate skill'
    };
  }
}

/**
 * Get a skill by ID
 */
export async function getSkill(skillId: number): Promise<Result<SkillDTO | null>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();
    const result = await service.getSkill(skillId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: SkillMapper.toDTO(result.data)
    };
  } catch (error) {
    console.error('[getSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get skill'
    };
  }
}

/**
 * Get all skills for an agent
 */
export async function getSkillsByAgent(agentId: number): Promise<Result<SkillDTO[]>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();
    const result = await service.getSkillsByAgent(agentId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: SkillMapper.toDTOList(result.data!)
    };
  } catch (error) {
    console.error('[getSkillsByAgent] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get skills'
    };
  }
}

/**
 * Get all organization skills for an organization
 */
export async function getOrganizationSkills(organizationId: number): Promise<Result<SkillDTO[]>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();
    const result = await service.getOrganizationSkills(organizationId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: SkillMapper.toDTOList(result.data!)
    };
  } catch (error) {
    console.error('[getOrganizationSkills] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get organization skills'
    };
  }
}

/**
 * Get a skill to use as a template for creating new skills
 * Verifies the skill is an organization skill (can only use org skills as templates)
 * Requires skills:view permission (enforced by RLS)
 */
export async function getSkillTemplate(skillId: number): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();
    const result = await service.getSkill(skillId);

    if (!result.success || !result.data) {
      return { success: false, error: 'Skill not found' };
    }

    const skill = result.data;

    // Verify it's an organization skill (only org skills can be templates)
    if (skill.agentId !== null) {
      return { success: false, error: 'Only organization skills can be used as templates' };
    }

    return {
      success: true,
      data: SkillMapper.toDTO(skill)
    };
  } catch (error) {
    console.error('[getSkillTemplate] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get skill template'
    };
  }
}

/**
 * Get all skills for an organization (both global and agent-scoped)
 */
export async function getSkillsByOrganization(organizationId: number): Promise<Result<SkillDTO[]>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();
    const result = await service.getSkillsByOrganization(organizationId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: SkillMapper.toDTOList(result.data!)
    };
  } catch (error) {
    console.error('[getSkillsByOrganization] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get organization skills'
    };
  }
}

/**
 * Create a default organization skill with minimal data
 * Used for quick creation from sidebar + button
 */
export async function createDefaultOrganizationSkill(): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.currentOrganizationId) {
      return { success: false, error: 'Unauthorized' };
    }

    return createOrganizationSkill({
      organizationId: session.user.currentOrganizationId,
      name: "Untitled Skill",
      description: "",
      inputs: [],
      outputs: [],
      instructions: "Add instructions here...",
      tools: []
    });
  } catch (error) {
    console.error('[createDefaultOrganizationSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create default skill'
    };
  }
}

/**
 * Create a default agent skill with minimal data
 * Used for quick creation from agent header "Add Skill" button
 */
export async function createDefaultAgentSkill(agentId: number): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    return createSkill({
      agentId,
      name: "Untitled Skill",
      description: "",
      inputs: [],
      outputs: [],
      instructions: "Add instructions here...",
      tools: []
    });
  } catch (error) {
    console.error('[createDefaultAgentSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create default agent skill'
    };
  }
}

/**
 * Upload attachment for a skill
 */
export async function uploadSkillAttachment(
  skillId: number,
  formData: FormData
): Promise<Result<AttachmentMetadata>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    const attachmentType = formData.get('type') as AttachmentType || 'file';

    // Get skill to retrieve organizationId
    const service = getSkillApplicationService();
    const skillResult = await service.getSkill(skillId);

    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    const skill = skillResult.data;

    // Check storage quota before upload
    const storageQuotaService = getStorageQuotaApplicationService();
    const quotaCheckResult = await storageQuotaService.checkQuota({
      organizationId: skill.organizationId.value,
      uploadSizeBytes: file.size,
      category: 'skill'
    });

    if (!quotaCheckResult.success) {
      return { success: false, error: quotaCheckResult.error || 'Failed to check storage quota' };
    }

    if (!quotaCheckResult.data?.allowed) {
      return {
        success: false,
        error: quotaCheckResult.data?.reason || 'Storage quota exceeded'
      };
    }

    // Upload to S3
    const uploadResult = await s3SkillAttachmentService.uploadAttachment({
      file,
      organizationId: skill.organizationId.value,
      skillId,
      type: attachmentType
    });

    // Increment storage usage after successful upload
    await storageQuotaService.incrementUsage({
      organizationId: skill.organizationId.value,
      uploadSizeBytes: file.size,
      category: 'skill'
    });

    return {
      success: true,
      data: uploadResult.metadata
    };
  } catch (error) {
    console.error('[uploadSkillAttachment] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload skill attachment'
    };
  }
}

/**
 * Delete attachment from a skill
 */
export async function deleteSkillAttachment(
  skillId: number,
  s3Key: string
): Promise<Result<void>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify skill access
    const service = getSkillApplicationService();
    const skillResult = await service.getSkill(skillId);

    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    // Delete from S3
    await s3SkillAttachmentService.deleteAttachment(s3Key);

    return { success: true, data: undefined };
  } catch (error) {
    console.error('[deleteSkillAttachment] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete skill attachment'
    };
  }
}

/**
 * Generate fresh pre-signed URL for skill attachment
 */
export async function generateSkillAttachmentUrl(
  skillId: number,
  s3Key: string
): Promise<Result<string>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify skill access
    const service = getSkillApplicationService();
    const skillResult = await service.getSkill(skillId);

    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    // Generate URL
    const url = await s3SkillAttachmentService.generateAttachmentUrl(s3Key);

    return { success: true, data: url };
  } catch (error) {
    console.error('[generateSkillAttachmentUrl] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate attachment URL'
    };
  }
}

/**
 * Save a plan to a skill for autonomous execution
 *
 * Either updates an existing skill with the plan, or creates a new skill with the plan.
 * The plan is stored in the skill's first step's agenticConfig.plan field.
 *
 * @param skillId - Existing skill ID to update, or null to create new skill
 * @param planJson - Serialized plan JSON string (from awaiting input)
 * @param agentId - Agent ID (required when creating new skill)
 * @param skillName - Name for new skill (required when creating new skill)
 */
export async function savePlanToSkill(params: {
  skillId: number | null;
  planJson: string;
  agentId?: number;
  skillName?: string;
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const { skillId, planJson, agentId, skillName } = params;

    // Parse the plan JSON
    let plan: any;
    try {
      plan = JSON.parse(planJson);
    } catch (e) {
      return { success: false, error: 'Invalid plan JSON' };
    }

    // Convert to StoredPlan format (strip runtime state like status, result, error)
    const storedPlan = {
      id: plan.id || plan.planId || `plan_${Date.now()}`,
      goal: plan.goal || '',
      basicInstructions: plan.basicInstructions || plan.goal || '',
      context: plan.context,
      analysis: plan.analysis,
      steps: (plan.steps || []).map((step: any) => ({
        stepId: step.stepId || step.step_id || `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        description: step.description || '',
        toolCall: step.toolCall || step.tool_call,
        parameters: step.parameters,
        contextTables: step.contextTables || step.context_tables,
        targetAgent: step.targetAgent || step.target_agent,
        subPlan: step.subPlan || step.sub_plan,
      })),
      version: plan.version || 1,
      generatedAt: plan.generatedAt || new Date().toISOString(),
      approvedAt: new Date().toISOString(), // Mark as approved when saved
    };

    const service = getSkillApplicationService();

    if (skillId) {
      // Update existing skill
      const skillResult = await service.getSkill(skillId);
      if (!skillResult.success || !skillResult.data) {
        return { success: false, error: 'Skill not found' };
      }

      const skill = skillResult.data;

      // Check permission
      if (skill.agentId) {
        await requireResourcePermission("agents:manage", "agent", skill.agentId.value);
      } else {
        await requireResourcePermission("skills:manage", "skill", skillId);
      }

      // Get existing steps or create a default step structure
      const existingSteps = skill.steps || [];
      let updatedSteps: SkillStep[];

      if (existingSteps.length > 0) {
        // Update first step with the plan
        updatedSteps = existingSteps.map((step, index) => {
          if (index === 0) {
            return {
              ...step,
              agenticConfig: {
                ...step.agenticConfig,
                instructions: step.agenticConfig?.instructions || storedPlan.goal,
                tools: step.agenticConfig?.tools || [],
                plan: storedPlan,
              },
            };
          }
          return step;
        });
      } else {
        // Create a new step with the plan
        updatedSteps = [{
          id: `step_${Date.now()}`,
          name: 'Autonomous Execution',
          nodeType: 'agentic' as const,
          agenticConfig: {
            instructions: storedPlan.goal,
            tools: [],
            plan: storedPlan,
          },
        }];
      }

      // Update the skill with the plan
      const updateResult = await service.updateSkill(skillId, {
        executionType: 'agentic',
        steps: updatedSteps,
      });

      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      // Fetch updated skill
      const updatedSkillResult = await service.getSkill(skillId);
      if (!updatedSkillResult.success || !updatedSkillResult.data) {
        return { success: false, error: 'Failed to fetch updated skill' };
      }

      // AUDIT: Log plan save
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        skill.organizationId,
        {
          eventType: 'agent',
          eventCategory: 'skill_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'skill',
          resourceId: String(skillId),
          resourceName: skill.name,
          parentResourceType: skill.agentId ? 'agent' : undefined,
          parentResourceId: skill.agentId ? String(skill.agentId.value) : undefined,
          eventData: { action: 'save_plan_for_autonomous_execution' },
          success: true,
        }
      );

      // Revalidate
      if (skill.agentId) {
        revalidatePath(`/agents/${skill.agentId.value}/skills`);
      }
      revalidatePath('/');

      return {
        success: true,
        data: SkillMapper.toDTO(updatedSkillResult.data)
      };

    } else {
      // Create new skill with the plan
      if (!agentId) {
        return { success: false, error: 'Agent ID is required when creating a new skill' };
      }
      if (!skillName?.trim()) {
        return { success: false, error: 'Skill name is required when creating a new skill' };
      }

      // Check permission to manage the agent
      await requireResourcePermission("agents:manage", "agent", agentId);

      // Get agent for organizationId
      const agentService = getAgentApplicationService();
      const agent = await agentService.getAgent(AgentId.fromNumber(agentId));
      if (!agent) {
        return { success: false, error: 'Agent not found' };
      }

      // Create the skill with the plan
      const createResult = await service.createSkill({
        agentId,
        organizationId: agent.organizationId.value,
        name: skillName.trim(),
        description: `Autonomous skill created from plan: ${storedPlan.goal}`,
        instructions: storedPlan.goal,
        inputs: [],
        outputs: [],
        tools: [],
        executionType: 'agentic',
        steps: [{
          id: `step_${Date.now()}`,
          name: 'Autonomous Execution',
          nodeType: 'agentic' as const,
          agenticConfig: {
            instructions: storedPlan.goal,
            tools: [],
            plan: storedPlan,
          },
        }],
      });

      if (!createResult.success || !createResult.data) {
        return { success: false, error: createResult.error || 'Failed to create skill' };
      }

      // Fetch the created skill
      const newSkillResult = await service.getSkill(createResult.data.value);
      if (!newSkillResult.success || !newSkillResult.data) {
        return { success: false, error: 'Failed to fetch created skill' };
      }

      // AUDIT: Log skill creation with plan
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(agent.organizationId.value),
        {
          eventType: 'agent',
          eventCategory: 'skill_crud',
          eventAction: 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'skill',
          resourceId: String(createResult.data.value),
          resourceName: skillName,
          parentResourceType: 'agent',
          parentResourceId: String(agentId),
          eventData: { action: 'create_with_autonomous_plan' },
          success: true,
        }
      );

      // Revalidate
      revalidatePath(`/agents/${agentId}/skills`);
      revalidatePath('/');

      return {
        success: true,
        data: SkillMapper.toDTO(newSkillResult.data)
      };
    }
  } catch (error) {
    console.error('[savePlanToSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save plan to skill'
    };
  }
}

/**
 * Transfer an organization-level skill to an agent
 * This changes the skill's scope from org-level to agent-scoped
 */
export async function transferSkillToAgent(
  skillId: number,
  agentId: number
): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();

    // Fetch skill to verify it's org-level
    const skillResult = await service.getSkill(skillId);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Skill not found' };
    }

    const skill = skillResult.data;

    // Verify skill is org-level (not already agent-scoped)
    if (skill.agentId) {
      return { success: false, error: 'Skill is already assigned to an agent' };
    }

    // Verify skill is not a system skill
    if (skill.isSystem) {
      return { success: false, error: 'System skills cannot be transferred' };
    }

    // Check permission to manage the org-level skill
    await requireResourcePermission("skills:manage", "skill", skillId);

    // Check permission to manage the target agent
    await requireResourcePermission("agents:manage", "agent", agentId);

    // Update the skill's agentId to transfer ownership
    const updateResult = await service.updateSkillAgent(skillId, agentId);

    if (!updateResult.success) {
      return { success: false, error: updateResult.error || 'Failed to transfer skill' };
    }

    // Fetch updated skill
    const updatedSkillResult = await service.getSkill(skillId);
    if (!updatedSkillResult.success || !updatedSkillResult.data) {
      return { success: false, error: 'Failed to fetch updated skill' };
    }

    // AUDIT: Log skill transfer
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      skill.organizationId,
      {
        eventType: 'agent',
        eventCategory: 'skill_crud',
        eventAction: 'update',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'skill',
        resourceId: String(skillId),
        resourceName: skill.name,
        parentResourceType: 'agent',
        parentResourceId: String(agentId),
        eventData: { action: 'transfer_to_agent', previousScope: 'organization' },
        success: true,
      }
    );

    // Revalidate paths
    revalidatePath('/skills'); // Org skills page
    revalidatePath(`/agents/${agentId}/skills`); // Agent skills page
    revalidatePath('/manage'); // Org chart
    revalidatePath('/');

    return {
      success: true,
      data: SkillMapper.toDTO(updatedSkillResult.data)
    };
  } catch (error) {
    console.error('[transferSkillToAgent] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transfer skill to agent'
    };
  }
}
