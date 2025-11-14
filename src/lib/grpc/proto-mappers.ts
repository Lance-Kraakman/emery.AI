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

import { Agent, ScheduleConfigurationJSON } from '@/ddd/domain/agents/entities/agent';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

import {
  AgentConfig as AgentConfigProto,
  ToolConfig as ToolConfigProto,
  SkillConfig as SkillConfigProto,
  TaskRequest,
  TaskProgress as TaskProgressProto,
  TriggerData,
  InstructionConfig as InstructionConfigProto
} from './generated/agent_worker';
import { Task, TaskStatus } from '@/ddd/domain/tasks/entities/task';

// AgentData interface for gRPC transport (uses primitives, not domain value objects)
// AIDEV-NOTE: Skills are now in separate table, not embedded in Agent
export interface AgentData {
  id: number;
  name: string;
  role?: string;
  description?: string;
  persona?: string;
  tools?: ToolConfig[];
  schedules?: ScheduleConfigurationJSON[];
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
    version: '', // Empty version since ToolConfig no longer has version
    config: tool.config || {}
  };
}

/**
 * Map TypeScript AgentData to protobuf AgentConfig
 * AIDEV-NOTE: Skills are now in separate table, queried separately when needed
 */
export function mapAgentToProto(agent: Agent): AgentConfigProto {
  return {
    name: agent.name,
    role: agent.role || '',
    description: agent.description || '',
    persona: agent.persona || '',
    defaultModel: agent.defaultModel || '', // Agent-specific model override for task execution
    tools: [], // Tools are now defined per-task (in skills and schedule configurations)
    servers: [], // Servers removed from agent-level configuration
    skills: [] // Skills queried separately from skills table
  };
}

/**
 * Map instruction config to protobuf InstructionConfig
 *
 * AIDEV-NOTE: Updated to support multimodal task instructions (2025-01)
 * - task: Main text instruction
 * - images: Image URLs for vision models
 * - attachments: File metadata (preprocessed to text)
 */
export function mapInstructionConfigToProto(instructionConfig: {
  task: string;
  images?: Array<{ url: string; s3Key?: string }>;
  attachments?: Array<{ type: string; url: string; filename: string; mimeType: string }>;
  tools?: ToolConfig[];
  metadata?: Record<string, any>;
}): InstructionConfigProto {
  return {
    task: instructionConfig.task,
    images: instructionConfig.images?.map(img => ({ url: img.url, s3Key: img.s3Key || '' })) || [],
    attachments: instructionConfig.attachments?.map(att => ({
      type: att.type,
      url: att.url,
      filename: att.filename,
      mimeType: att.mimeType
    })) || [],
    tools: instructionConfig.tools?.filter(tool => tool !== null && tool !== undefined)?.map(mapToolToProto) || [],
    servers: [], // Servers removed from task instructions
    model: '' // Empty model will be resolved by worker using hierarchy
  };
}

/**
 * Create complete TaskRequest proto message from TypeScript types
 * Supports both direct capability execution and instruction-based auto-routing
 *
 * AIDEV-NOTE: Updated for multimodal support (2025-01)
 */
export function createTaskRequest(params: {
  taskId: string;
  agentId: number;
  // Execution mode - use one of the following
  skillName?: string;  // Direct capability execution
  instructionConfig?: {     // Instruction-based execution with auto-routing
    task: string;
    images?: Array<{ url: string; s3Key?: string }>;
    attachments?: Array<{ type: string; url: string; filename: string; mimeType: string }>;
    tools?: ToolConfig[];
    metadata?: Record<string, any>;
  };
  agent: Agent;
  triggerData: Record<string, any>;
  organizationId: string;
  ownerId: string;
  timeoutSeconds?: number;
  agentModel?: string; // Agent default model (overrides organization model)
  organizationModel?: string; // Organization default model (fallback for agent model)
}): TaskRequest {
  // Convert trigger data to string map format expected by proto
  const triggerPayload: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.triggerData)) {
    triggerPayload[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  const triggerData: TriggerData = {
    payload: triggerPayload
  };

  // Build the base request (using camelCase - generator handles wire format conversion)
  const request: TaskRequest = {
    name: params.skillName || 'instruction_based_task',
    taskId: params.taskId,
    agentId: params.agentId,
    agentConfig: mapAgentToProto(params.agent),
    triggerData: triggerData as any,
    organizationId: params.organizationId,
    ownerId: params.ownerId,
    timeoutSeconds: params.timeoutSeconds || 300,
    agentModel: params.agentModel || '', // Agent default model (overrides org model in hierarchy)
    organizationModel: params.organizationModel || '', // Organization default model for fallback
    inputContent: [] // Runtime input attachments (empty for now, can be extended later)
  };

  // Debug logging for model selection
  console.log(`[PROTO-MAPPER] TaskRequest model fields set:`, {
    agentModel: request.agentModel,
    organizationModel: request.organizationModel,
    agentModelLength: request.agentModel?.length,
    organizationModelLength: request.organizationModel?.length,
    agentModelParam: params.agentModel,
    organizationModelParam: params.organizationModel
  });

  // Set execution mode (oneof field)
  if (params.skillName) {
    request.skillName = params.skillName;
  } else if (params.instructionConfig) {
    request.instructionConfig = mapInstructionConfigToProto(params.instructionConfig);
  } else {
    throw new Error('Either skillName or instructionConfig must be provided');
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
  if (progress.outputJson) {
    try {
      result = JSON.parse(progress.outputJson);
    } catch (error) {
      console.warn('Failed to parse task output JSON:', error);
      result = { raw_output: progress.outputJson };
    }
  }

  return {
    status,
    result,
    error: progress.errorMessage || undefined
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
