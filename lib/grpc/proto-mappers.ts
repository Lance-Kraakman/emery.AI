/**
 * Proto mapping functions for converting between TypeScript types and protobuf messages
 * 
 * Data Flow:
 * - Database (TypeScript types) → Proto Messages → Worker
 * - Worker → Proto Progress → Database (TypeScript types)
 * 
 * This file maintains the separation between:
 * - Frontend/Database types (@/ddd/domain/agents/entities/agent) - Source of truth
 * - Proto messages (proto/agent_worker.proto) - Transport layer only
 */

import { Agent, CapabilityConfig, ServerConfig, StepConfig } from '@/ddd/domain/agents/entities/agent';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

import { 
  AgentConfig as AgentConfigProto,
  ToolConfig as ToolConfigProto,
  ServerConfig as ServerConfigProto,
  StepConfig as StepConfigProto,
  CapabilityConfig as CapabilityConfigProto,
  TaskRequest,
  TaskProgress as TaskProgressProto,
  TriggerData,
  InstructionConfig as InstructionConfigProto,
  StepType
} from './generated/agent_worker';
import { Task, TaskStatus } from '@/ddd/domain/tasks/entities/task';

// AgentData interface for gRPC transport (uses primitives, not domain value objects)
export interface AgentData {
  id: number;
  name: string;
  role?: string;
  description?: string;
  persona?: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  trigger?: any;
  capabilities?: CapabilityConfig[];
  status?: any;
  organizationId: number;
  ownerId: string;
  roleId?: number;
  apiKey?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

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
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // Generate ID for proto
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
export function mapAgentToProto(agent: Agent): AgentConfigProto {
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
 * Map instruction config to protobuf InstructionConfig
 */
export function mapInstructionConfigToProto(instructionConfig: {
  instructions: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
}): InstructionConfigProto {
  return {
    instructions: instructionConfig.instructions,
    tools: instructionConfig.tools?.map(mapToolToProto) || [],
    servers: instructionConfig.servers?.map(mapServerToProto) || []
  };
}

/**
 * Create complete TaskRequest proto message from TypeScript types
 * Supports both direct capability execution and instruction-based auto-routing
 */
export function createTaskRequest(params: {
  taskId: string;
  agentId: number;
  // Execution mode - use one of the following
  capabilityName?: string;  // Direct capability execution
  instructionConfig?: {     // Instruction-based execution with auto-routing
    instructions: string;
    tools?: ToolConfig[];
    servers?: ServerConfig[];
  };
  agent: Agent;
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

  // Build the base request
  const request: TaskRequest = {
    task_id: params.taskId,
    agent_id: params.agentId,
    agent_config: mapAgentToProto(params.agent),
    trigger_data: triggerData as any,
    organization_id: params.organizationId,
    owner_id: params.ownerId,
    timeout_seconds: params.timeoutSeconds || 300
  };

  // Set execution mode (oneof field)
  if (params.capabilityName) {
    request.capability_name = params.capabilityName;
  } else if (params.instructionConfig) {
    request.instruction_config = mapInstructionConfigToProto(params.instructionConfig);
  } else {
    throw new Error('Either capabilityName or instructionConfig must be provided');
  }

  return request;
}

/**
 * Map protobuf TaskStatus to TypeScript TaskStatus
 */
export function mapProtoStatusToTaskStatus(protoStatus: number | string): TaskStatus {
  // Handle both numeric and string enum values (gRPC client configured with enums: String)
  if (typeof protoStatus === 'string') {
    const stringStatusMap: Record<string, string> = {
      'TASK_PENDING': 'pending',
      'TASK_IN_PROGRESS': 'in_progress',
      'TASK_COMPLETED': 'completed',
      'TASK_FAILED': 'failed',
      'TASK_CANCELLED': 'cancelled',
      'TASK_TIMEOUT': 'failed' // Map timeout to failed since we don't have timeout status
    };
    const statusString = stringStatusMap[protoStatus] || 'failed';
    return TaskStatus.fromString(statusString);
  }
  
  // Proto enum values: TASK_PENDING=0, TASK_IN_PROGRESS=1, TASK_COMPLETED=2, TASK_FAILED=3, TASK_CANCELLED=4, TASK_TIMEOUT=5
  const statusMap: Record<number, string> = {
    0: 'pending',
    1: 'in_progress', 
    2: 'completed',
    3: 'failed',
    4: 'cancelled',
    5: 'failed' // Map timeout to failed since we don't have timeout status
  };
  
  const statusString = statusMap[protoStatus] || 'failed';
  return TaskStatus.fromString(statusString);
}

/**
 * Map protobuf TaskProgress to parsed task update data
 * Use with existing Task domain methods: task.start(), task.complete(), task.fail(), etc.
 */
export function mapTaskProgressFromProto(progress: TaskProgressProto): {
  status: TaskStatus;
  result?: any;
  error?: string;
} {
  const status = mapProtoStatusToTaskStatus(progress.status as any);
  
  // Parse result if available
  let result: any = undefined;
  if (progress.output_json) {
    try {
      result = JSON.parse(progress.output_json);
    } catch (error) {
      console.warn('Failed to parse task output JSON:', error);
      result = { raw_output: progress.output_json };
    }
  }

  return {
    status,
    result,
    error: progress.error_message || undefined
  };
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
