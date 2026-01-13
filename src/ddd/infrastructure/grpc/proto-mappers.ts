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
  SkillConfig as SkillConfigProto,
  TaskRequest,
  TaskProgress as TaskProgressProto,
  TriggerData,
  SkillInputValue,
  InstructionConfig as InstructionConfigProto,
  ContextMappingProto,
  ResolvedContextProto
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

  // Build the agent config, adding skill if provided
  const agentConfig = mapAgentToProto(params.agent);

  // If skill is provided, add it to the agent config's skills array
  if (params.skill) {
    agentConfig.skills = [mapSkillToProto(params.skill)];
    console.log(`[PROTO-MAPPER] Added skill to agent config:`, {
      skillId: params.skill.id,
      skillName: params.skill.name,
      executionType: params.skill.executionType,
      hasTaskModelConfig: !!params.skill.taskModelConfig
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
    resolvedContext: params.resolvedContext ? mapResolvedContextToProto(params.resolvedContext) : undefined
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
    // Skill-based execution: use skill_name mode
    request.skillName = params.skill.name;
    console.log(`[PROTO-MAPPER] Using skill_name mode for skill: ${params.skill.name}`);
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

// =============================================================================
// Multi-Table Output Mapping Types (for proto mapping)
// =============================================================================

/** Typed field source - discriminated union (skill output, skill input, or table ref) */
type FieldSourceDTO =
  | { type: 'skill_output'; name: string }
  | { type: 'skill_input'; name: string }
  | { type: 'table_ref'; order: number; field: string };

/** Row ID source - determines which row to update */
type RowIdSourceDTO =
  | { type: 'static'; staticId: string }
  | { type: 'skill_input'; skillInput: string }
  | { type: 'skill_output'; skillOutput: string }
  | { type: 'table_ref'; tableRef: { order: number; field: string } }
  | { type: 'source_row' };

/** Table mapping DTO for skill output mapping */
interface TableMappingDTO {
  order: number;
  targetTableId: number;
  rowAction: 'create' | 'update';
  rowIdSource?: RowIdSourceDTO;
  mappings: Array<{
    source: FieldSourceDTO;
    targetFieldId: number;
    targetFieldMetadata?: {
      fieldType: string;
      options?: string[];
      maxSelections?: number;
      fieldName?: string;
    };
    appendMode?: boolean;
  }>;
  displayFieldId?: number;
  mode?: 'single_row' | 'multi_row';
}

/** Output mapping config DTO */
interface OutputMappingConfigDTO {
  mode: 'single_row' | 'multi_row';
  tableMappings: TableMappingDTO[];
}

/**
 * Map FieldSource to proto format
 * Returns null for invalid sources so callers can filter them out
 */
function mapFieldSourceToProto(source: FieldSourceDTO | undefined | null): any | null {
  if (!source || !source.type) {
    console.warn('[PROTO-MAPPER] FieldSource is undefined or has no type - skipping mapping');
    return null;
  }

  if (source.type === 'skill_output') {
    return { skillOutput: source.name };
  } else if (source.type === 'skill_input') {
    return { skillInput: source.name };
  } else if (source.type === 'table_ref') {
    return {
      tableRef: {
        order: source.order,
        field: source.field
      }
    };
  }

  console.warn(`[PROTO-MAPPER] Unknown FieldSource type: ${(source as any).type} - skipping mapping`);
  return null;
}

/**
 * Map RowIdSource to proto format
 */
function mapRowIdSourceToProto(source: RowIdSourceDTO): any {
  switch (source.type) {
    case 'static':
      return { staticId: source.staticId };
    case 'skill_input':
      return { skillInput: source.skillInput };
    case 'skill_output':
      return { skillOutput: source.skillOutput };
    case 'table_ref':
      return {
        tableRef: {
          order: source.tableRef.order,
          field: source.tableRef.field
        }
      };
    case 'source_row':
      return { useSourceRow: true };
    default:
      return undefined;
  }
}

/**
 * Map EnrichedSkill/ExecutionSkill to protobuf SkillConfig
 * Used by both chat processing and task execution paths
 * AIDEV-NOTE: Updated to accept SkillExecutionType which includes 'tool' and 'write'
 */
export function mapSkillToProto(skill: ExecutionSkill): SkillConfigProto {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || '',
    instructions: skill.instructions || '',
    inputs: skill.inputs.map(input => ({
      name: input.name,
      required: input.required,
      type: input.type || 'text', // Default to 'text' for proto compatibility
      inputMapping: input.inputMapping ? {
        source: {
          tableId: input.inputMapping.source.tableId,
          fieldId: input.inputMapping.source.fieldId,
          rowSource: input.inputMapping.source.rowSource ? mapRowIdSourceToProto(input.inputMapping.source.rowSource) : undefined
        }
      } : undefined
    })),
    outputs: skill.outputs.map(output => {
      // Map skill output to proto's outputMapping
      const outputMapping = output.outputMapping as OutputMappingConfigDTO | undefined;
      return {
        name: output.name,
        type: output.type || 'text', // Default to 'text' for proto compatibility
        description: output.description || '',
        source: output.source ? {
          type: output.source.type,
          nodeId: output.source.nodeId,
          outputName: output.source.outputName
        } : undefined,
        outputMapping: outputMapping ? {
          mode: outputMapping.mode || 'single_row',
          tableMappings: outputMapping.tableMappings.map((tm: TableMappingDTO) => ({
            order: tm.order,
            targetTableId: tm.targetTableId,
            rowAction: tm.rowAction || 'create',
            rowIdSource: tm.rowIdSource ? mapRowIdSourceToProto(tm.rowIdSource) : undefined,
            displayFieldId: tm.displayFieldId || 0,
            mode: tm.mode || '',
            mappings: tm.mappings
              .map((m: any) => {
                const source = mapFieldSourceToProto(m.source);
                if (!source) return null; // Skip mappings with invalid sources
                return {
                  source,
                  targetFieldId: m.targetFieldId,
                  targetFieldMetadata: m.targetFieldMetadata ? {
                    fieldType: m.targetFieldMetadata.fieldType || '',
                    options: m.targetFieldMetadata.options || [],
                    maxSelections: m.targetFieldMetadata.maxSelections,
                    fieldName: m.targetFieldMetadata.fieldName || ''
                  } : undefined,
                  appendMode: m.appendMode || false
                };
              })
              .filter((m: any): m is NonNullable<typeof m> => m !== null)
          }))
        } : undefined
      };
    }),
    tools: skill.tools.map(tool => mapToolToProto(
      tool instanceof ToolConfig ? tool : ToolConfig.fromPlain(tool)
    )),
    model: skill.model || '',
    content: skill.content.map((part: any) => {
      // Handle various content formats (MessagePart format)
      if (part.text?.text || (part.type === 'text' && part.text)) {
        return { text: { text: part.text?.text || part.text || '' } };
      } else if (part.imageUrl?.url || (part.type === 'image_url' && part.imageUrl)) {
        return { imageUrl: { url: part.imageUrl?.url || part.imageUrl || '' } };
      } else if (part.file?.url || (part.type === 'file' && part.file)) {
        const fileData = part.file;
        return {
          file: {
            url: fileData?.url || '',
            mimeType: fileData?.mimeType || '',
            filename: fileData?.filename || '',
            size: fileData?.size || 0
          }
        };
      }
      return { text: { text: '' } };
    }),
    agentType: skill.agentType || '',
    executionType: skill.executionType || 'agentic',
    taskModelConfig: skill.taskModelConfig ? {
      modelId: skill.taskModelConfig.modelId || '',
      taskType: skill.taskModelConfig.taskType || '',
      parameters: Object.fromEntries(
        Object.entries(skill.taskModelConfig.parameters || {}).map(([k, v]) => [k, String(v)])
      )
    } : undefined,
    // Map tool execution config for 'tool' execution type
    toolExecutionConfig: skill.toolExecutionConfig ? {
      toolId: skill.toolExecutionConfig.toolId,
      inputMappings: skill.toolExecutionConfig.inputMappings.map(m => ({
        toolParam: m.toolParam,
        skillInputName: m.skillInputName || '',
        staticValue: m.staticValue !== undefined ? String(m.staticValue) : ''
      })),
      outputTableId: skill.toolExecutionConfig.outputTableId
    } : undefined,
    // Map write config for 'write' execution type
    writeConfig: skill.writeConfig ? {
      targetTableId: skill.writeConfig.targetTableId,
      rowAction: skill.writeConfig.rowAction,
      fieldMappings: skill.writeConfig.fieldMappings.map(m => ({
        skillInputName: m.skillInputName,
        targetFieldId: m.targetFieldId
      })),
      updateMatch: skill.writeConfig.updateMatch ? {
        skillInputName: skill.writeConfig.updateMatch.skillInputName,
        targetFieldId: skill.writeConfig.updateMatch.targetFieldId
      } : undefined
    } : undefined,
    // Map read config for 'read' execution type
    readConfig: skill.readConfig ? {
      mode: skill.readConfig.mode,
      sourceTableId: skill.readConfig.sourceTableId,
      rowIdSource: skill.readConfig.rowIdSource ? mapRowIdSourceToProto(skill.readConfig.rowIdSource) : undefined,
      queryFilters: skill.readConfig.queryFilters?.map(f => ({
        fieldId: f.fieldId,
        operator: f.operator,
        valueSource: mapRowIdSourceToProto(f.valueSource)
      })) || [],
      queryLimit: skill.readConfig.queryLimit || 100,
      fieldMappings: skill.readConfig.fieldMappings.map(m => ({
        sourceFieldId: m.sourceFieldId,
        targetVariable: m.targetVariable
      }))
    } : undefined,
    // Map steps for 'agent' (step-based) execution type
    steps: skill.steps?.map(step => ({
      id: step.id,  // UUID for step_context keying
      name: step.name,
      instruction: step.instruction || '',
      skillId: step.skillId || 0,
      tools: step.tools || [],
      inputs: step.inputs || {},
      outputs: step.outputs || {},
      parallel: step.parallel || false,
      condition: step.condition || '',
      // Step-level definitions (same mapping as skill-level)
      inputDefs: step.inputDefs?.map(input => ({
        name: input.name,
        required: input.required,
        type: input.type || 'text',
        inputMapping: input.inputMapping ? {
          source: {
            tableId: input.inputMapping.source.tableId,
            fieldId: input.inputMapping.source.fieldId,
            rowSource: input.inputMapping.source.rowSource ? mapRowIdSourceToProto(input.inputMapping.source.rowSource) : undefined
          }
        } : undefined
      })) || [],
      outputDefs: step.outputDefs?.map(output => ({
        name: output.name,
        type: output.type || 'text',
        description: output.description || '',
        source: undefined,  // Step-level outputs don't use source (that's for skill outputs)
        outputMapping: undefined  // Step-level outputs typically don't have table mappings
      })) || [],
      // DAG execution configuration
      errorConfig: step.errorConfig ? {
        continueOnError: step.errorConfig.continueOnError,
        errorOutputVar: step.errorConfig.errorOutputVar || ''
      } : undefined,
      retryConfig: step.retryConfig ? {
        maxAttempts: step.retryConfig.maxAttempts,
        backoffMs: step.retryConfig.backoffMs,
        backoffType: step.retryConfig.backoffType
      } : undefined,
      // Output routing for DAG branching
      stepOutputs: step.stepOutputs?.map(output => ({
        type: output.type,
        condition: output.condition || '',
        nextSteps: output.nextSteps || []
      })) || [],
      // Parallel execution
      parallelGroup: step.parallelGroup || '',
      // Loop/iteration support
      loopConfig: step.loopConfig ? {
        type: step.loopConfig.type,
        itemsVar: step.loopConfig.itemsVar || '',
        currentItemVar: step.loopConfig.currentItemVar || '',
        condition: step.loopConfig.condition || '',
        maxIterations: step.loopConfig.maxIterations || 100
      } : undefined,
      // Step-level execution configs (for non-agentic steps)
      readConfig: step.readConfig ? {
        mode: step.readConfig.mode,
        sourceTableId: step.readConfig.sourceTableId,
        rowIdSource: step.readConfig.rowIdSource ? mapRowIdSourceToProto(step.readConfig.rowIdSource) : undefined,
        queryFilters: step.readConfig.queryFilters?.map(f => ({
          fieldId: f.fieldId,
          operator: f.operator,
          valueSource: mapRowIdSourceToProto(f.valueSource)
        })) || [],
        queryLimit: step.readConfig.queryLimit || 100,
        fieldMappings: step.readConfig.fieldMappings.map(m => ({
          sourceFieldId: m.sourceFieldId,
          targetVariable: m.targetVariable
        }))
      } : undefined,
      writeConfig: step.writeConfig ? {
        targetTableId: step.writeConfig.targetTableId,
        rowAction: step.writeConfig.rowAction,
        fieldMappings: step.writeConfig.fieldMappings.map(m => ({
          skillInputName: m.skillInputName,
          targetFieldId: m.targetFieldId
        })),
        updateMatch: step.writeConfig.updateMatch ? {
          skillInputName: step.writeConfig.updateMatch.skillInputName,
          targetFieldId: step.writeConfig.updateMatch.targetFieldId
        } : undefined
      } : undefined,
      toolExecutionConfig: step.toolExecutionConfig ? {
        toolId: step.toolExecutionConfig.toolId,
        inputMappings: step.toolExecutionConfig.inputMappings.map(m => ({
          toolParam: m.toolParam,
          skillInputName: m.skillInputName || '',
          staticValue: m.staticValue !== undefined ? String(m.staticValue) : ''
        })),
        outputTableId: step.toolExecutionConfig.outputTableId
      } : undefined,
      taskModelConfig: step.taskModelConfig ? {
        modelId: step.taskModelConfig.modelId || '',
        taskType: step.taskModelConfig.taskType || '',
        parameters: Object.fromEntries(
          Object.entries(step.taskModelConfig.parameters || {}).map(([k, v]) => [k, String(v)])
        )
      } : undefined,
      // UI state
      isDisabled: step.isDisabled || false
    })) || []
  };
}

// AIDEV-TODO: Add validation functions to ensure proto message completeness
// AIDEV-TODO: Add error handling for missing required fields in mapping functions
// AIDEV-TODO: Consider adding reverse mappers (proto → TypeScript) if needed for debugging
