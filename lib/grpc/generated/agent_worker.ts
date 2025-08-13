/**
 * TypeScript definitions matching proto/agent_worker.proto
 * These types match the protobuf message definitions exactly
 */

// Enums
export enum TaskStatus {
  TASK_PENDING = 0,
  TASK_IN_PROGRESS = 1,
  TASK_COMPLETED = 2,
  TASK_FAILED = 3,
  TASK_CANCELLED = 4,
  TASK_TIMEOUT = 5,
}

export enum WorkerStatus {
  WORKER_HEALTHY = 0,
  WORKER_BUSY = 1,
  WORKER_DEGRADED = 2,
  WORKER_UNHEALTHY = 3,
  WORKER_SHUTTING_DOWN = 4,
}

export enum StepType {
  CODE_STEP = 0,
  TOOL_STEP = 1,
}

// Messages
export interface TaskRequest {
  task_id: string;
  agent_id: number;
  capability_name: string;
  agent_config: AgentConfig;
  trigger_data: TriggerData;
  organization_id: string;
  owner_id: string;
  timeout_seconds: number;
}

export interface TaskProgress {
  task_id: string;
  status: TaskStatus;
  step_id: string;
  step_type: string;
  output_json: string;
  error_message: string;
  timestamp_ms: number;
  progress_percent: number;
}

export interface CancelTaskRequest {
  task_id: string;
  reason: string;
}

export interface CancelTaskResponse {
  success: boolean;
  message: string;
}

export interface WorkerInfo {
  worker_id: string;
  version: string;
  organization_id: string;
  status: WorkerStatus;
  capabilities: string[];
  active_tasks: number;
  max_concurrent_tasks: number;
  uptime_seconds: number;
  supported_tools: string[];
}

export interface Empty {}

export interface ErrorResponse {
  code: string;
  message: string;
  details: string;
}

export interface AgentConfig {
  name: string;
  role: string;
  description: string;
  persona: string;
  tools: ToolConfig[];
  servers: ServerConfig[];
  capabilities: CapabilityConfig[];
}

export interface CapabilityConfig {
  name: string;
  description: string;
  steps: StepConfig[];
}

export interface StepConfig {
  id: string;
  type: StepType;
  instructions: string;
  model: string;
  tools: ToolConfig[];
  servers: ServerConfig[];
}

export interface ToolConfig {
  name: string;
  version: string;
  config: Record<string, string>;
}

export interface ServerConfig {
  name: string;
  endpoint: string;
  config: Record<string, string>;
}

export interface TriggerData {
  payload: Record<string, string>;
}

// Service interface (for reference)
export interface AgentWorkerService {
  ExecuteTask(request: TaskRequest): AsyncIterable<TaskProgress>;
  GetWorkerInfo(request: Empty): Promise<WorkerInfo>;
  CancelTask(request: CancelTaskRequest): Promise<CancelTaskResponse>;
}