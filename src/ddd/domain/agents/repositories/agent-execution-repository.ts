/**
 * Agent Execution Repository Interface
 * 
 * Domain contract for agent execution operations. Treats execution as a repository
 * operation where different implementations (gRPC, local, queue-based) can be used.
 * 
 * AIDEV-NOTE: Repository pattern for execution - domain defines contract,
 * infrastructure provides implementations (gRPC, local, HTTP, etc.)
 */

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