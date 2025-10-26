'use server';

import { getSkillApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Result } from '@/ddd/domain/shared/result';
import type { SkillDTO, SkillInput, SkillOutput, ToolConfigDTO } from '@/app/mappers/skill-mapper';

/**
 * Server Actions for Skill Management
 *
 * Provides CRUD operations for skills with authentication and permission checks.
 * All actions return standardized Result<T> responses.
 *
 * AIDEV-NOTE: Simplified single-instruction model - removed all step-related actions
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

    const service = getSkillApplicationService();
    const result = await service.createSkill(command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch the created skill to return full DTO
    const skillResult = await service.getSkill(result.data!.value);
    if (!skillResult.success || !skillResult.data) {
      return { success: false, error: 'Failed to fetch created skill' };
    }

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
    return await service.deleteSkill(skillId);
  } catch (error) {
    console.error('[deleteSkill] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete skill'
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
