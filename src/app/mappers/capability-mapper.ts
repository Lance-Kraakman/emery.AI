import type { Capability } from '@/ddd/domain/capabilities/entities/capability';
import type { Step } from '@/ddd/domain/capabilities/entities/step';

/**
 * DTO for Tool Configuration
 * Matches existing ToolConfigDTO from agent-mapper
 */
export interface ToolConfigDTO {
  name: string;
  config: Record<string, any>;
}

/**
 * DTO for Step
 * Serializable representation of Step entity for API responses
 */
export interface StepDTO {
  id: number;
  capabilityId: number;
  stepOrder: number;
  type: 'TOOL_STEP' | 'CODE_STEP';
  instructions: string;
  model?: string;
  tools: ToolConfigDTO[];
  servers: any[];
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for Capability
 * Serializable representation of Capability aggregate for API responses
 */
export interface CapabilityDTO {
  id: number;
  agentId: number;
  name: string;
  description: string;
  steps: StepDTO[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Capability Mapper
 *
 * Maps between domain entities and DTOs for API layer.
 * Provides type-safe conversions between domain and presentation layers.
 */
export class CapabilityMapper {
  /**
   * Convert Capability domain entity to DTO
   */
  static toDTO(capability: Capability): CapabilityDTO {
    return {
      id: capability.id.value,
      agentId: capability.agentId.value,
      name: capability.name,
      description: capability.description,
      steps: capability.steps.map(s => this.stepToDTO(s)),
      createdAt: capability.createdAt.toISOString(),
      updatedAt: capability.updatedAt.toISOString()
    };
  }

  /**
   * Convert Step domain entity to DTO
   */
  static stepToDTO(step: Step): StepDTO {
    return {
      id: step.id.value,
      capabilityId: step.capabilityId.value,
      stepOrder: step.stepOrder,
      type: step.type.value,
      instructions: step.instructions,
      model: step.model,
      tools: step.tools.map(t => t.toPlain()),
      servers: step.servers,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString()
    };
  }

  /**
   * Convert list of Capabilities to DTOs
   */
  static toDTOList(capabilities: Capability[]): CapabilityDTO[] {
    return capabilities.map(c => this.toDTO(c));
  }

  /**
   * Convert list of Steps to DTOs
   */
  static stepsToDTOList(steps: Step[]): StepDTO[] {
    return steps.map(s => this.stepToDTO(s));
  }
}
