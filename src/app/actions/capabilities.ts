'use server';

import { getCapabilityApplicationService } from '@/ddd/application/di/container';
import { CapabilityMapper } from '@/app/mappers/capability-mapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Result } from '@/ddd/domain/shared/result';
import type { CapabilityDTO, StepDTO } from '@/app/mappers/capability-mapper';

/**
 * Server Actions for Capability Management
 *
 * Provides CRUD operations for capabilities and steps with authentication and permission checks.
 * All actions return standardized Result<T> responses.
 */

// ===== CAPABILITY ACTIONS =====

/**
 * Create a new capability with optional steps
 */
export async function createCapability(command: {
  agentId: number;
  name: string;
  description: string;
  steps?: Array<{
    type: 'TOOL_STEP' | 'CODE_STEP';
    instructions: string;
    model?: string;
    tools?: Array<{ name: string; config: any }>;
    servers?: any[];
  }>;
}): Promise<Result<CapabilityDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.createCapability(command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch the created capability with steps to return full DTO
    const capabilityResult = await service.getCapability(result.data!.value);
    if (!capabilityResult.success || !capabilityResult.data) {
      return { success: false, error: 'Failed to fetch created capability' };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(capabilityResult.data)
    };
  } catch (error) {
    console.error('[createCapability] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create capability'
    };
  }
}

/**
 * Update an existing capability's metadata (name, description)
 */
export async function updateCapability(
  capabilityId: number,
  command: {
    name?: string;
    description?: string;
  }
): Promise<Result<CapabilityDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.updateCapability(capabilityId, command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated capability to return full DTO
    const capabilityResult = await service.getCapability(capabilityId);
    if (!capabilityResult.success || !capabilityResult.data) {
      return { success: false, error: 'Failed to fetch updated capability' };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(capabilityResult.data)
    };
  } catch (error) {
    console.error('[updateCapability] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update capability'
    };
  }
}

/**
 * Delete a capability (cascade deletes all steps)
 */
export async function deleteCapability(capabilityId: number): Promise<Result<void>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    return await service.deleteCapability(capabilityId);
  } catch (error) {
    console.error('[deleteCapability] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete capability'
    };
  }
}

/**
 * Get a capability by ID with all steps
 */
export async function getCapability(capabilityId: number): Promise<Result<CapabilityDTO | null>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.getCapability(capabilityId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(result.data)
    };
  } catch (error) {
    console.error('[getCapability] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get capability'
    };
  }
}

/**
 * Get all capabilities for an agent
 */
export async function getCapabilitiesByAgent(agentId: number): Promise<Result<CapabilityDTO[]>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.getCapabilitiesByAgent(agentId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTOList(result.data!)
    };
  } catch (error) {
    console.error('[getCapabilitiesByAgent] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get capabilities'
    };
  }
}

// ===== STEP ACTIONS =====

/**
 * Add a new step to a capability
 */
export async function addStep(
  capabilityId: number,
  stepData: {
    type: 'TOOL_STEP' | 'CODE_STEP';
    instructions: string;
    model?: string;
    tools?: Array<{ name: string; config: any }>;
    servers?: any[];
  }
): Promise<Result<CapabilityDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.addStep(capabilityId, stepData);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated capability with new step to return full DTO
    const capabilityResult = await service.getCapability(capabilityId);
    if (!capabilityResult.success || !capabilityResult.data) {
      return { success: false, error: 'Failed to fetch updated capability' };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(capabilityResult.data)
    };
  } catch (error) {
    console.error('[addStep] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add step'
    };
  }
}

/**
 * Update an existing step
 */
export async function updateStep(
  stepId: number,
  capabilityId: number,
  command: {
    instructions?: string;
    model?: string;
    tools?: Array<{ name: string; config: any }>;
    servers?: any[];
  }
): Promise<Result<CapabilityDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.updateStep(stepId, command);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated capability to return full DTO
    const capabilityResult = await service.getCapability(capabilityId);
    if (!capabilityResult.success || !capabilityResult.data) {
      return { success: false, error: 'Failed to fetch updated capability' };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(capabilityResult.data)
    };
  } catch (error) {
    console.error('[updateStep] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update step'
    };
  }
}

/**
 * Delete a step and reindex remaining steps
 */
export async function deleteStep(
  stepId: number,
  capabilityId: number
): Promise<Result<CapabilityDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.deleteStep(stepId);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated capability to return full DTO
    const capabilityResult = await service.getCapability(capabilityId);
    if (!capabilityResult.success || !capabilityResult.data) {
      return { success: false, error: 'Failed to fetch updated capability' };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(capabilityResult.data)
    };
  } catch (error) {
    console.error('[deleteStep] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete step'
    };
  }
}

/**
 * Reorder steps within a capability
 */
export async function reorderSteps(
  capabilityId: number,
  stepIds: number[]
): Promise<Result<CapabilityDTO>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const service = getCapabilityApplicationService();
    const result = await service.reorderSteps(capabilityId, stepIds);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Fetch updated capability to return full DTO
    const capabilityResult = await service.getCapability(capabilityId);
    if (!capabilityResult.success || !capabilityResult.data) {
      return { success: false, error: 'Failed to fetch updated capability' };
    }

    return {
      success: true,
      data: CapabilityMapper.toDTO(capabilityResult.data)
    };
  } catch (error) {
    console.error('[reorderSteps] error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder steps'
    };
  }
}
