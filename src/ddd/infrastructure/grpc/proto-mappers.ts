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

import { Agent, AutomationConfigurationJSON } from '@/ddd/domain/agents/entities/agent';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { ExecutionSkill } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import {
  AgentConfig as AgentConfigProto,
  ToolConfig as ToolConfigProto,
  TaskRequest,
  TaskProgress as TaskProgressProto,
  TriggerData,
  SkillInputValue,
  InstructionConfig as InstructionConfigProto,
  ContextMappingProto,
  ResolvedContextProto,
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
  automations?: AutomationConfigurationJSON[];
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
    allowNetwork: agent.allowNetwork, // Network access for bash commands (git, curl, wget)
    tools: [], // Tools are now defined per-task (in skills and schedule configurations)
    servers: [], // Servers removed from agent-level configuration
    // skills removed - now loaded dynamically via API
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
 * AIDEV-NOTE: Updated for skill-based task execution (2025-01)
 */
/**
 * Context mapping data for gRPC transport
 */
export interface ContextMappingData {
  tableId: number;
  tableName: string;
  accessMode: 'read' | 'write' | 'readwrite';
  syncMode: 'on_access' | 'on_save' | 'realtime';
  targetType: 'agent' | 'skill' | 'skill_step';
  targetId: string;
}

/**
 * Resolved context data for gRPC transport
 */
export interface ResolvedContextData {
  mappings: ContextMappingData[];
  agentMappings?: ContextMappingData[];
  skillMappings?: ContextMappingData[];
  stepMappings?: ContextMappingData[];
}

/**
 * Map context mapping to proto format
 */
function mapContextMappingToProto(mapping: ContextMappingData): ContextMappingProto {
  return {
    tableId: mapping.tableId,
    tableName: mapping.tableName,
    accessMode: mapping.accessMode,
    syncMode: mapping.syncMode,
    targetType: mapping.targetType,
    targetId: mapping.targetId,
  };
}

/**
 * Map resolved context to proto format
 */
function mapResolvedContextToProto(context: ResolvedContextData): ResolvedContextProto {
  return {
    mappings: context.mappings.map(mapContextMappingToProto),
    agentMappings: (context.agentMappings || []).map(mapContextMappingToProto),
    skillMappings: (context.skillMappings || []).map(mapContextMappingToProto),
    stepMappings: (context.stepMappings || []).map(mapContextMappingToProto),
  };
}

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
  // Optional skill to execute (for skill-based task execution)
  // AIDEV-NOTE: ExecutionSkill type now supports 'agent', 'operation', 'tool', 'write'
  skill?: ExecutionSkill;
  agent: Agent;
  // Typed skill inputs (name → value with type info)
  skillInputs?: Array<{ name: string; type: string; value: unknown }>;
  organizationId: string;
  ownerId: string;
  timeoutSeconds?: number;
  agentModel?: string; // Agent default model (overrides organization model)
  organizationModel?: string; // Organization default model (fallback for agent model)
  // Context table mappings for this execution
  resolvedContext?: ResolvedContextData;
  // Trigger context for audit trail (flows to Python worker as HTTP headers on tool calls)
  triggerType?: string;
  triggeredByUserId?: string;
  triggeredByUserName?: string;
  userApiKey?: string; // API key for tool auth (agent key for scheduled tasks)
}): TaskRequest {
  // Build typed skill inputs for TriggerData
  const skillInputValues: SkillInputValue[] = (params.skillInputs || []).map(input => {
    const skillInputValue: SkillInputValue = {
      name: input.name,
      type: input.type
    };

    // Set appropriate oneof field based on value type
    if (typeof input.value === 'string') {
      skillInputValue.stringValue = input.value;
    } else if (typeof input.value === 'number') {
      skillInputValue.numberValue = input.value;
    } else if (typeof input.value === 'boolean') {
      skillInputValue.boolValue = input.value;
    } else if (input.value !== null && input.value !== undefined) {
      // Complex types (objects, arrays) → JSON string
      skillInputValue.jsonValue = JSON.stringify(input.value);
    }

    return skillInputValue;
  });

  const triggerData: TriggerData = {
    skillInputs: skillInputValues
  };

  // Build the agent config (skills removed - loaded dynamically via API)
  const agentConfig = mapAgentToProto(params.agent);

  // AIDEV-NOTE: Skills no longer added to AgentConfig - Python loads skills dynamically via API
  // Skill ID is passed via instructionConfig or skillName for routing
  if (params.skill) {
    console.log(`[PROTO-MAPPER] Skill will be loaded dynamically:`, {
      skillId: params.skill.id,
      skillName: params.skill.name,
      executionType: params.skill.executionType
    });
  }

  // Build the base request (using camelCase - generator handles wire format conversion)
  const request: TaskRequest = {
    name: params.skill?.name || params.skillName || 'instruction_based_task',
    taskId: params.taskId,
    agentId: params.agentId,
    agentConfig,
    triggerData: triggerData as any,
    organizationId: params.organizationId,
    ownerId: params.ownerId,
    timeoutSeconds: params.timeoutSeconds || 300,
    agentModel: params.agentModel || '', // Agent default model (overrides org model in hierarchy) - empty string if not set
    organizationModel: params.organizationModel || '', // Organization default model for fallback - empty string if not set
    inputContent: [], // Runtime input attachments (empty for now, can be extended later)
    resolvedContext: params.resolvedContext ? mapResolvedContextToProto(params.resolvedContext) : undefined,
    skillId: 0, // Default; set below when skill is provided
    // Trigger context for audit trail
    triggerType: params.triggerType || '',
    triggeredByUserId: params.triggeredByUserId || '',
    triggeredByUserName: params.triggeredByUserName || '',
    userApiKey: params.userApiKey || '',
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
  // Priority: skill-based > skillName > instructionConfig
  if (params.skill) {
    // Skill-based execution: use skill_name mode + pass skill_id for direct lookup
    request.skillName = params.skill.name;
    request.skillId = params.skill.id;
    console.log(`[PROTO-MAPPER] Using skill_name mode for skill: ${params.skill.name} (id=${params.skill.id})`);
  } else if (params.skillName) {
    request.skillName = params.skillName;
  } else if (params.instructionConfig) {
    request.instructionConfig = mapInstructionConfigToProto(params.instructionConfig);
  } else {
    throw new Error('Either skill, skillName, or instructionConfig must be provided');
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
 * Extract typed skill inputs from proto TriggerData back to TypeScript object
 */
export function mapTriggerDataFromProto(triggerData: TriggerData): Record<string, any> {
  const result: Record<string, any> = {};

  for (const input of triggerData.skillInputs || []) {
    // Extract value from appropriate oneof field
    if (input.stringValue !== undefined) {
      result[input.name] = input.stringValue;
    } else if (input.numberValue !== undefined) {
      result[input.name] = input.numberValue;
    } else if (input.boolValue !== undefined) {
      result[input.name] = input.boolValue;
    } else if (input.jsonValue !== undefined) {
      try {
        result[input.name] = JSON.parse(input.jsonValue);
      } catch {
        result[input.name] = input.jsonValue;
      }
    }
  }

  return result;
}

// mapSkillToProto, mapFieldSourceToProto, mapRowIdSourceToProto, mapStoredPlan*ToProto
// removed — skills are no longer sent via gRPC proto. Python resolves skills dynamically via API.
