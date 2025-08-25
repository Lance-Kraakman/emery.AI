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
  // execution_mode - oneof field (use only one of the following)
  capability_name?: string;        // Direct capability execution
  instruction_config?: InstructionConfig; // Instruction-based execution with auto-routing
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

export interface InstructionConfig {
  instructions: string;           // Natural language instructions
  tools: ToolConfig[];           // Optional tools for this task
  servers: ServerConfig[];       // Optional servers for this task
}

// Chat Processing Service Types (AI-only operations, stateless)
export interface ProcessMessageRequest {
  message_content: string;        // User message content
  user_id: string;                // User identifier for context
  organization_id: number;        // Organization for multi-tenant routing
  context?: ChatContext;          // Context for RAG and domain-specific processing
  conversation_history?: HistoryMessage[]; // Conversation history from Next.js database
  metadata?: Record<string, string>; // Optional metadata
}

export interface ProcessMessageResponse {
  // Standard oneof pattern for different response types (use only one)
  content_chunk?: ContentChunk;   // AI-generated streaming content
  rag_context?: RagContext;       // RAG sources and context
  complete?: ProcessingComplete;  // Processing finished marker
  error?: ProcessingError;        // Processing error
  timestamp: number;              // Response timestamp
}

export interface HistoryMessage {
  role: string;                   // user, assistant, system
  content: string;                // message content
  timestamp: number;              // when it was created
}

export interface ContentChunk {
  content: string;                // Text content chunk
  sequence: number;               // Sequence number for ordering
}

export interface RagContext {
  sources: RagSource[];           // List of RAG sources used
  context_summary: string;        // Summary of context used
  total_sources: number;          // Total number of sources found
}

export interface RagSource {
  document_id: string;            // Source document identifier
  title: string;                  // Source document title
  similarity: number;             // Similarity score
  domain_type: string;            // Domain type (table, agent, file, etc.)
  excerpt: string;                // Relevant text excerpt
}

export interface ProcessingComplete {
  model_used: string;             // AI model used for generation
  total_tokens: number;           // Total tokens processed
  processing_time_ms: number;     // Processing time in milliseconds
  metadata?: Record<string, string>; // Additional processing metadata
}

export interface ProcessingError {
  error_code: string;             // Error code (RAG_FAILED, MODEL_ERROR, etc.)
  error_message: string;          // Human-readable error message
  error_details?: Record<string, string>; // Additional error context
}

export interface ChatContext {
  domain_type: string;            // Domain type (table, agent, file, team, workflow)
  domain_id: number;              // Domain entity identifier
  enable_rag: boolean;            // Enable RAG context retrieval
  rag_threshold: number;          // RAG similarity threshold (default: 0.3)
  max_rag_docs: number;           // Maximum RAG documents to retrieve (default: 5)
  primary_rag_weight: number;     // Weight for domain-specific RAG (default: 0.7)
  assembled_rag_context: string;  // Pre-assembled RAG context from Next.js DualContextRagService
  rag_sources: string[];          // RAG source summary for metadata
}

// Service interfaces (for reference)
export interface AgentWorkerService {
  ExecuteTask(request: TaskRequest): AsyncIterable<TaskProgress>;
  GetWorkerInfo(request: Empty): Promise<WorkerInfo>;
  CancelTask(request: CancelTaskRequest): Promise<CancelTaskResponse>;
}

export interface ChatProcessingService {
  ProcessMessage(request: ProcessMessageRequest): AsyncIterable<ProcessMessageResponse>;
}