'use server';

import { revalidatePath } from 'next/cache';
import { getSkillApplicationService, getAgentApplicationService, getStorageQuotaApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requirePermission, requireResourcePermission } from './permissions';
import type { Result } from '@/ddd/domain/shared/result';
import type { SkillInput, SkillOutput, ToolConfigDTO } from '@/app/mappers/skill-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import { s3SkillAttachmentService } from '@/ddd/infrastructure/multimodal/s3-skill-attachment-service';
import type { AttachmentMetadata, AttachmentType } from '@/ddd/domain/multimodal/value-objects/attachment-metadata';
import type { MessagePart } from '@/lib/grpc/generated/agent_worker';

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
 * Create a new skill with inputs, outputs, and single instruction block
 */
export async function createSkill(command: {
  agentId: number;
  name: string;
  description?: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfigDTO[];
  model?: string | null;
  agentType?: string | null; // "tool_calling" (default) or "code_agent"
  executionType?: 'agent' | 'operation' | 'task-model';  // 'task-model' is legacy alias for 'operation'
  taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> };
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission to manage the agent (agent-scoped skills require agent management permission)
    await requireResourcePermission("agents:manage", "agent", command.agentId);

    // Validation
    if (!command.name?.trim()) {
      return { success: false, error: 'Skill name is required' };
    }

    const executionType = command.executionType || 'agent';
    const isOperationMode = executionType === 'operation' || executionType === 'task-model';

    // Instructions required for agent execution, optional for operation mode
    if (!isOperationMode && !command.instructions?.trim()) {
      return { success: false, error: 'Instructions are required for agent execution' };
    }

    // Task model config required for operation mode
    if (isOperationMode && !command.taskModelConfig) {
      return { success: false, error: 'Task model configuration is required for operation execution' };
    }

    // Validate input names
    const invalidInputs = command.inputs.filter(i => !i.name?.trim());
    if (invalidInputs.length > 0) {
      return { success: false, error: 'All inputs must have names' };
    }

    // Validate output names
    const invalidOutputs = command.outputs.filter(o => !o.name?.trim());
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
  inputs: SkillInput[];
  outputs: SkillOutput[];
  instructions: string;
  tools: ToolConfigDTO[];
  model?: string | null;
  agentType?: string | null; // "tool_calling" (default) or "code_agent"
  executionType?: 'agent' | 'operation' | 'task-model';  // 'task-model' is legacy alias for 'operation'
  taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> };
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check permission to create organization skills
    await requirePermission("skills:create");

    // Validation
    if (!command.name?.trim()) {
      return { success: false, error: 'Skill name is required' };
    }

    const executionType = command.executionType || 'agent';
    const isOperationMode = executionType === 'operation' || executionType === 'task-model';

    // Instructions required for agent execution, optional for operation mode
    if (!isOperationMode && !command.instructions?.trim()) {
      return { success: false, error: 'Instructions are required for agent execution' };
    }

    // Task model config required for operation mode
    if (isOperationMode && !command.taskModelConfig) {
      return { success: false, error: 'Task model configuration is required for operation execution' };
    }

    // Validate input names
    const invalidInputs = command.inputs.filter(i => !i.name?.trim());
    if (invalidInputs.length > 0) {
      return { success: false, error: 'All inputs must have names' };
    }

    // Validate output names
    const invalidOutputs = command.outputs.filter(o => !o.name?.trim());
    if (invalidOutputs.length > 0) {
      return { success: false, error: 'All outputs must have names' };
    }

    const service = getSkillApplicationService();

    // Create organization skill without agentId (null for organization-scoped)
    const result = await service.createSkill({
      agentId: null, // null for organization skills
      organizationId: command.organizationId,
      name: command.name,
      description: command.description,
      inputs: command.inputs,
      outputs: command.outputs,
      instructions: command.instructions,
      tools: command.tools,
      model: command.model,
      agentType: command.agentType,
      executionType: command.executionType,  // Include execution type
      taskModelConfig: command.taskModelConfig  // Include task model config
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch the created skill to return full DTO
    const skillResult = await service.getSkill(result.data!.value);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Failed to fetch created skill' };
    }

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
    inputs?: SkillInput[];
    outputs?: SkillOutput[];
    instructions?: string;
    tools?: ToolConfigDTO[];
    model?: string | null;
    agentType?: string | null; // "tool_calling" (default) or "code_agent"
    executionType?: 'agent' | 'operation' | 'task-model';  // 'task-model' is legacy alias for 'operation'
    taskModelConfig?: { modelId: string; taskType: string; parameters?: Record<string, any> } | null;
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

    const result = await service.updateSkill(skillId, command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated skill to return full DTO
    const updatedSkillResult = await service.getSkill(skillId);
    if (!updatedSkillResult.success || !updatedSkillResult.data) {
      return { success: false, error: 'Failed to fetch updated skill' };
    }

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
      taskModelConfig: originalSkill.taskModelConfig
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
