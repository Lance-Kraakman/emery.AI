'use server';

import { revalidatePath } from 'next/cache';
import { getSkillApplicationService, getAgentApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Result } from '@/ddd/domain/shared/result';
import type { SkillInput, SkillOutput, ToolConfigDTO } from '@/app/mappers/skill-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';

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
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validation
    if (!command.name?.trim()) {
      return { success: false, error: 'Skill name is required' };
    }

    if (!command.instructions?.trim()) {
      return { success: false, error: 'Instructions are required' };
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
}): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validation
    if (!command.name?.trim()) {
      return { success: false, error: 'Skill name is required' };
    }

    if (!command.instructions?.trim()) {
      return { success: false, error: 'Instructions are required' };
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
      tools: command.tools
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
  }
): Promise<Result<SkillDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();
    const result = await service.updateSkill(skillId, command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated skill to return full DTO
    const skillResult = await service.getSkill(skillId);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Failed to fetch updated skill' };
    }

    // Revalidate sidebar and skill pages
    const skill = skillResult.data;
    if (skill.agentId) {
      revalidatePath(`/agents/${skill.agentId.value}/skills`);
    } else {
      revalidatePath('/skills');
    }
    revalidatePath('/');

    return {
      success: true,
      data: SkillMapper.toDTO(skillResult.data)
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
 */
export async function deleteSkill(skillId: number): Promise<Result<void>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getSkillApplicationService();

    // Get skill info before deleting for revalidation
    const skillResult = await service.getSkill(skillId);
    const agentId = skillResult.success && skillResult.data ? skillResult.data.agentId?.value : null;

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

    // Create the duplicate skill
    const createResult = await service.createSkill({
      agentId: originalSkill.agentId?.value || null,
      organizationId: originalSkill.organizationId.value,
      name: newName,
      description: originalSkill.description,
      inputs: originalSkill.inputs,
      outputs: originalSkill.outputs,
      instructions: originalSkill.instructions,
      tools: originalSkill.tools
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
