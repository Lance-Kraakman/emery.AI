/**
 * Proto mapping functions for converting between TypeScript types and protobuf messages
 * 
 * Data Flow:
 * - Database (TypeScript types) → Proto Messages → Worker
 * - Worker → Proto Progress → Database (TypeScript types)
 * 
 * This file maintains the separation between:
 * - Frontend/Database types (app/actions/types.ts) - Source of truth
 * - Proto messages (proto/agent_worker.proto) - Transport layer only
 */

import type { 
  CreateAgentData, 
  ToolConfig, 
  ServerConfig, 
  StepConfig, 
  CapabilityConfig,
  Task,
  TaskStatus
} from '../../app/actions/types';

// Add missing types that we need for the gRPC integration
export interface AgentData extends CreateAgentData {
  id: number;
  organizationId: number;
  ownerId: string;
  apiKey?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// TaskStatus is now imported from types.ts - no need to redefine it

import { 
  AgentConfig as AgentConfigProto,
  ToolConfig as ToolConfigProto,
  ServerConfig as ServerConfigProto,
  StepConfig as StepConfigProto,
  CapabilityConfig as CapabilityConfigProto,
  TaskRequest,
  TaskProgress as TaskProgressProto,
  TriggerData,
  StepType
} from './generated/agent_worker';

// AIDEV-NOTE: These mappers ensure clean separation between TypeScript types (source of truth) 
// and proto messages (transport only), following the architecture plan

/**
 * Map TypeScript ToolConfig to protobuf ToolConfig
 */
export function mapToolToProto(tool: ToolConfig): ToolConfigProto {
  return {
    name: tool.name,
    version: tool.version || '',
    config: tool.config || {}
  };
}

/**
 * Map TypeScript ServerConfig to protobuf ServerConfig
 */
export function mapServerToProto(server: ServerConfig): ServerConfigProto {
  return {
    name: server.name,
    endpoint: server.endpoint || '',
    config: server.config || {}
  };
}

/**
 * Map TypeScript StepConfig to protobuf StepConfig
 */
export function mapStepToProto(step: StepConfig): StepConfigProto {
  // Map TypeScript string enum to proto enum
  const stepTypeMap: Record<string, StepType> = {
    'CODE_STEP': StepType.CODE_STEP,
    'TOOL_STEP': StepType.TOOL_STEP
  };

  return {
    id: step.id,
    type: stepTypeMap[step.type] || StepType.TOOL_STEP,
    instructions: step.instructions,
    model: step.model || '',
    tools: step.tools?.map(mapToolToProto) || [],
    servers: step.servers?.map(mapServerToProto) || []
  };
}

/**
 * Map TypeScript CapabilityConfig to protobuf CapabilityConfig
 */
export function mapCapabilityToProto(capability: CapabilityConfig): CapabilityConfigProto {
  return {
    name: capability.name,
    description: capability.description,
    steps: capability.steps.map(mapStepToProto)
  };
}

/**
 * Map TypeScript AgentData to protobuf AgentConfig
 */
export function mapAgentToProto(agent: AgentData): AgentConfigProto {
  return {
    name: agent.name,
    role: agent.role || '',
    description: agent.description || '',
    persona: agent.persona || '',
    tools: agent.tools?.map(mapToolToProto) || [],
    servers: agent.servers?.map(mapServerToProto) || [],
    capabilities: agent.capabilities?.map(mapCapabilityToProto) || []
  };
}

/**
 * Create complete TaskRequest proto message from TypeScript types
 */
export function createTaskRequest(params: {
  taskId: string;
  agentId: number;
  capabilityName: string;
  agent: AgentData;
  triggerData: Record<string, any>;
  organizationId: string;
  ownerId: string;
  timeoutSeconds?: number;
}): TaskRequest {
  // Convert trigger data to string map format expected by proto
  const triggerPayload: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.triggerData)) {
    triggerPayload[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  const triggerData: TriggerData = {
    payload: triggerPayload
  };

  return {
    task_id: params.taskId,
    agent_id: params.agentId,
    capability_name: params.capabilityName,
    agent_config: mapAgentToProto(params.agent),
    trigger_data: triggerData,
    organization_id: params.organizationId,
    owner_id: params.ownerId,
    timeout_seconds: params.timeoutSeconds || 300
  };
}

/**
 * Map protobuf TaskStatus to TypeScript TaskStatus
 */
export function mapProtoStatusToTaskStatus(protoStatus: number | string): TaskStatus {
  // Handle both numeric and string enum values (gRPC client configured with enums: String)
  if (typeof protoStatus === 'string') {
    const stringStatusMap: Record<string, TaskStatus> = {
      'TASK_PENDING': 'pending',
      'TASK_IN_PROGRESS': 'in_progress',
      'TASK_COMPLETED': 'completed',
      'TASK_FAILED': 'failed',
      'TASK_CANCELLED': 'cancelled', // Now properly mapped to cancelled status
      'TASK_TIMEOUT': 'timeout'      // Now properly mapped to timeout status
    };
    return stringStatusMap[protoStatus] || 'failed';
  }
  
  // Proto enum values: TASK_PENDING=0, TASK_IN_PROGRESS=1, TASK_COMPLETED=2, TASK_FAILED=3, TASK_CANCELLED=4, TASK_TIMEOUT=5
  const statusMap: Record<number, TaskStatus> = {
    0: 'pending',
    1: 'in_progress', 
    2: 'completed',
    3: 'failed',
    4: 'cancelled', // Now properly mapped to cancelled status
    5: 'timeout'    // Now properly mapped to timeout status
  };
  
  return statusMap[protoStatus] || 'failed';
}

/**
 * Map protobuf TaskProgress to partial Task update
 */
export function mapTaskProgressFromProto(progress: TaskProgressProto): Partial<Task> {
  const update: Partial<Task> = {
    status: mapProtoStatusToTaskStatus(progress.status)
  };

  // Parse JSON output if available
  if (progress.output_json) {
    try {
      update.result = JSON.parse(progress.output_json);
    } catch (error) {
      console.warn('Failed to parse task output JSON:', error);
      update.result = { raw_output: progress.output_json };
    }
  }

  // Set error message if failed
  if (progress.error_message) {
    update.error = progress.error_message;
  }

  // Set completion timestamp for final states
  if (['completed', 'failed', 'cancelled', 'timeout'].includes(update.status!)) {
    update.completedAt = new Date();
  }

  return update;
}

/**
 * Extract trigger data from proto TriggerData back to TypeScript object
 */
export function mapTriggerDataFromProto(triggerData: TriggerData): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(triggerData.payload || {})) {
    try {
      // Try to parse as JSON first
      result[key] = JSON.parse(value);
    } catch {
      // If parsing fails, use as string
      result[key] = value;
    }
  }
  
  return result;
}

// AIDEV-TODO: Add validation functions to ensure proto message completeness
// AIDEV-TODO: Add error handling for missing required fields in mapping functions
// AIDEV-TODO: Consider adding reverse mappers (proto → TypeScript) if needed for debugging