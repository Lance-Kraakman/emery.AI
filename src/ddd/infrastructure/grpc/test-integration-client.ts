/**
 * AIDEV-NOTE: Frontend integration client for testing gRPC agent worker
 * This provides a complete example of how to call the agent worker from Next.js
 */

import * as grpc from '@grpc/grpc-js';
import { AgentWorkerClient } from './generated/agent_worker_grpc_pb';
import {
  TaskRequest,
  AgentConfig,
  TriggerData,
  InstructionConfig,
  ToolConfig,
  TaskProgress,
  TaskStatus
} from './generated/agent_worker';

export interface AgentWorkerConfig {
  host: string;
  port: number;
  organizationId: string;
}

export interface TaskExecutionRequest {
  taskId: string;
  agentId: number;
  instructions?: string;
  skillName?: string;
  agentConfig: {
    name: string;
    role?: string;
    description?: string;
    persona?: string;
  };
  triggerData?: Record<string, string>;
  ownerId: string;
  timeoutSeconds?: number;
  name: string;
}

export interface TaskProgressEvent {
  taskId: string;
  status: TaskStatus;
  stepId?: string;
  stepType?: string;
  outputJson?: string;
  errorMessage?: string;
  timestampMs: number;
  progressPercent: number;
}

export class AgentWorkerTestClient {
  private client: any; // AgentWorkerClient from generated gRPC
  private config: AgentWorkerConfig;

  constructor(config: AgentWorkerConfig) {
    this.config = config;
    const address = `${config.host}:${config.port}`;
    
    // For development/testing - use insecure connection
    // In production, you'd use proper TLS credentials
    this.client = new AgentWorkerClient(
      address, 
      grpc.credentials.createInsecure()
    );
  }

  /**
   * Test worker connectivity and get worker information
   */
  async getWorkerInfo(): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = {}; // Empty message
      
      this.client.getWorkerInfo(request, (error: any, response: any) => {
        if (error) {
          reject(new Error(`Worker info failed: ${error.message}`));
          return;
        }
        
        resolve({
          workerId: response.getWorkerId(),
          version: response.getVersion(),
          organizationId: response.getOrganizationId(),
          status: response.getStatus(),
          skills: response.getCapabilitiesList(),
          activeTasks: response.getActiveTasks(),
          maxConcurrentTasks: response.getMaxConcurrentTasks(),
          uptimeSeconds: response.getUptimeSeconds(),
          supportedTools: response.getSupportedToolsList()
        });
      });
    });
  }

  /**
   * Execute a task with streaming progress updates
   */
  executeTask(
    request: TaskExecutionRequest,
    onProgress: (progress: TaskProgressEvent) => void
  ): Promise<TaskProgressEvent> {
    return new Promise((resolve, reject) => {
      // Build the gRPC request object
      const grpcRequest: TaskRequest = {
        triggeredByUserId: request.ownerId,
        triggeredByUserName: 'Integration Test User',
        triggerType: 'manual',
        instructionConfig: undefined,
        skillName: request.skillName || '',
        name: request.name,
        taskId: request.taskId,
        agentId: request.agentId,
        organizationId: this.config.organizationId,
        ownerId: request.ownerId,
        timeoutSeconds: request.timeoutSeconds || 300,
        agentModel: '', // Empty string will use org/system default
        organizationModel: '', // Empty string will use system default
        agentConfig: {
          name: request.name,
          // Add other agent config fields as needed
        } as AgentConfig,
        triggerData: {
          // Add trigger data fields as needed
        } as TriggerData,
        inputContent: [], // Runtime input attachments (empty for test client)
        resolvedContext: undefined, // Context table mappings (not used in test client)
        skillId: 0, // Not used in test client

        // Set execution mode
        ...(request.instructions
          ? {
              instruction_config: {
                task: request.instructions,
                images: [],
                attachments: [],
                tools: [],
                servers: [],
                model: ''
              } as InstructionConfig
            }
          : { capability_name: request.skillName }
        )
      };

      // Create the streaming call
      const call = this.client.executeTask(grpcRequest);
      let lastProgress: TaskProgressEvent | null = null;

      call.on('data', (progress: any) => {
        const progressEvent: TaskProgressEvent = {
          taskId: progress.task_id,
          status: progress.status,
          stepId: progress.step_id || undefined,
          stepType: progress.step_type || undefined,
          outputJson: progress.output_json || undefined,
          errorMessage: progress.error_message || undefined,
          timestampMs: progress.timestamp_ms || Date.now(),
          progressPercent: progress.progress_percent || 0
        };

        lastProgress = progressEvent;
        onProgress(progressEvent);
      });

      call.on('end', () => {
        if (lastProgress) {
          resolve(lastProgress);
        } else {
          reject(new Error('No progress updates received'));
        }
      });

      call.on('error', (error: any) => {
        reject(new Error(`Task execution failed: ${error.message}`));
      });
    });
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string, reason?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = new (require('./generated/agent_worker_pb2').CancelTaskRequest)();
      request.setTaskId(taskId);
      if (reason) request.setReason(reason);
      
      this.client.cancelTask(request, (error: any, response: any) => {
        if (error) {
          reject(new Error(`Task cancellation failed: ${error.message}`));
          return;
        }
        
        resolve(response.getSuccess());
      });
    });
  }

  /**
   * Close the gRPC connection
   */
  close(): void {
    this.client.close();
  }
}

// Example usage function
export async function exampleAgentWorkerIntegration() {
  const client = new AgentWorkerTestClient({
    host: 'localhost',
    port: 50051,
    organizationId: 'test-org'
  });

  try {
    // Test connectivity
    console.log('Testing worker connectivity...');
    const workerInfo = await client.getWorkerInfo();
    console.log('Worker Info:', workerInfo);

    // Execute a simple task
    console.log('Executing test task...');
    const taskId = `task-${Date.now()}`;
    
    const finalResult = await client.executeTask({
      taskId,
      agentId: 1,
      instructions: 'Analyze the current weather conditions and provide a brief summary',
      agentConfig: {
        name: 'Weather Analysis Agent',
        role: 'Weather Analyst',
        description: 'Provides weather analysis and summaries'
      },
      ownerId: 'test-user',
      name: 'Weather Analysis Task'
    }, (progress) => {
      console.log(`Progress: ${progress.progressPercent}% - ${progress.status} - ${progress.stepType || 'N/A'}`);
      if (progress.outputJson) {
        console.log('Step Output:', JSON.parse(progress.outputJson));
      }
      if (progress.errorMessage) {
        console.error('Step Error:', progress.errorMessage);
      }
    });

    console.log('Task completed:', finalResult);

  } catch (error) {
    console.error('Integration test failed:', error);
  } finally {
    client.close();
  }
}

// AIDEV-NOTE: This can be used in your API routes or server actions for frontend integration
export default AgentWorkerTestClient;