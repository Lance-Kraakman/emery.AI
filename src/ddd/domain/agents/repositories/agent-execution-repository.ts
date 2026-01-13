/**
 * Agent Execution Repository Interface
 * 
 * Domain contract for agent execution operations. Treats execution as a repository
 * operation where different implementations (gRPC, local, queue-based) can be used.
 * 
 * AIDEV-NOTE: Repository pattern for execution - domain defines contract,
 * infrastructure provides implementations (gRPC, local, HTTP, etc.)
 */

import type { SkillExecutionType, RowIdSource, QueryFilter, ReadFieldMapping } from '@/ddd/domain/skills/entities/skill';

/**
 * Enriched skill for execution (from SkillEnrichmentService)
 * Matches EnrichedSkill interface but defined here to avoid circular dependency
 */
export interface ExecutionSkill {
  id: number;
  name: string;
  description: string;
  instructions: string;
  inputs: Array<{ name: string; required: boolean; type?: string; inputMapping?: any }>;
  outputs: Array<{ name: string; type?: string; description?: string; source?: { type: string; nodeId: string; outputName: string }; outputMapping?: any }>;
  tools: Array<{ name: string; version?: string; config?: Record<string, any> }>;
  content: Array<any>; // MessagePart[] - flexible to avoid import
  model: string | null;
  agentType: string | null;
  executionType: SkillExecutionType;
  taskModelConfig?: {
    modelId: string;
    taskType: string;
    parameters?: Record<string, any>;
  };
  // Optional config for 'tool' execution type
  toolExecutionConfig?: {
    toolId: string;
    inputMappings: Array<{ toolParam: string; skillInputName?: string; staticValue?: any }>;
    outputTableId?: number;
  };
  // Optional config for 'write' execution type
  writeConfig?: {
    targetTableId: number;
    rowAction: 'create' | 'update';
    fieldMappings: Array<{ skillInputName: string; targetFieldId: number }>;
    updateMatch?: { skillInputName: string; targetFieldId: number };
  };
  // Optional config for 'read' execution type
  readConfig?: {
    mode: 'single_row' | 'query';
    sourceTableId: number;
    rowIdSource?: RowIdSource;
    queryFilters?: QueryFilter[];
    queryLimit?: number;
    fieldMappings: ReadFieldMapping[];
  };
  // Optional steps for 'agent' (step-based) execution type
  steps?: Array<{
    name: string;
    instruction?: string;
    skillId?: number;
    tools?: string[];
    inputs?: Record<string, string>;
    outputs?: Record<string, string>;
    parallel?: boolean;
    condition?: string;
    // Step-level definitions (same types as skill-level)
    inputDefs?: Array<{ name: string; required: boolean; type?: string; inputMapping?: any }>;
    outputDefs?: Array<{ name: string; type?: string; description?: string; outputMapping?: any }>;
    // DAG execution configuration
    errorConfig?: { continueOnError: boolean; errorOutputVar?: string };
    retryConfig?: { maxAttempts: number; backoffMs: number; backoffType: 'fixed' | 'exponential' | 'linear' };
    // Output routing for DAG branching
    stepOutputs?: Array<{
      type: 'success' | 'error' | 'condition' | 'default';
      condition?: string;
      nextSteps: string[];
    }>;
    // Parallel execution
    parallelGroup?: string;
    // Loop/iteration support
    loopConfig?: {
      type: 'for_each' | 'while' | 'until';
      itemsVar?: string;
      currentItemVar?: string;
      condition?: string;
      maxIterations?: number;
    };
    // Step-level execution configs (for inline execution nodes)
    taskModelConfig?: {
      modelId: string;
      taskType: string;
      parameters?: Record<string, any>;
    };
    toolExecutionConfig?: {
      toolId: string;
      inputMappings: Array<{ toolParam: string; skillInputName?: string; staticValue?: any }>;
      outputTableId?: number;
    };
    writeConfig?: {
      targetTableId: number;
      rowAction: 'create' | 'update';
      fieldMappings: Array<{ skillInputName: string; targetFieldId: number }>;
      updateMatch?: { skillInputName: string; targetFieldId: number };
    };
    readConfig?: {
      mode: 'single_row' | 'query';
      sourceTableId: number;
      rowIdSource?: RowIdSource;
      queryFilters?: QueryFilter[];
      queryLimit?: number;
      fieldMappings: ReadFieldMapping[];
    };
  }>;
}

export interface AgentExecutionRequest {
  agentId: number;
  instructions: string;
  tools?: Array<{name: string, version?: string, config?: Record<string, any>}>;
  servers?: Array<{name: string, endpoint?: string, config?: Record<string, any>}>;
  executionId: string;
  organizationId?: number;
  ownerId?: string;
  agentModel?: string; // Optional - agent's default model (overrides org model)
  organizationModel?: string; // Optional - organization's default model
  timeoutSeconds?: number;
  skill?: ExecutionSkill; // Optional - skill to execute (enables skill_name mode)
  skillInputs?: Record<string, any>; // Optional - resolved skill inputs (from automation inputMappings)
  onProgress?: (logMessage: string) => void; // Callback for real-time log messages
}

export interface AgentExecutionResult {
  success: boolean;
  executionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  outputData?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ExecutionStatus {
  executionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  progress?: number; // 0-100
  currentStep?: string;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkerHealth {
  healthy: boolean;
  organizationId: string;
  workerId: string;
  activeTasks: number;
  maxConcurrentTasks: number;
  uptime?: number;
  error?: string;
}

/**
 * Repository interface for agent execution operations
 * 
 * Different implementations:
 * - GrpcAgentExecutionRepository: gRPC-based execution (current)
 * - LocalAgentExecutionRepository: Local execution for testing
 * - QueueAgentExecutionRepository: Async queue-based execution
 * - HttpAgentExecutionRepository: REST API-based execution
 */
export interface IAgentExecutionRepository {
  /**
   * Execute an agent with the given request parameters
   * Returns execution result with status and output data
   */
  executeAgent(request: AgentExecutionRequest): Promise<AgentExecutionResult>;

  /**
   * Cancel a running execution
   */
  cancelExecution(executionId: string, reason?: string): Promise<void>;

  /**
   * Get current status of an execution
   */
  getExecutionStatus(executionId: string): Promise<ExecutionStatus | null>;

  /**
   * Get health information for the execution worker/service
   */
  getWorkerHealth(organizationId: string): Promise<WorkerHealth>;

  /**
   * Check if the execution service is available for the given organization
   */
  isExecutionAvailable(organizationId: string): Promise<boolean>;
}