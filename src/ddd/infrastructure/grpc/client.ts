/**
 * gRPC client for communicating with agent worker instances
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { getGrpcClientCredentials } from '@/lib/security/grpc-tls';
import path from 'path';

// Load protobuf definition
const PROTO_PATH = path.join(process.cwd(), 'proto', 'agent_worker.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,  // Convert to camelCase to match generated TypeScript interfaces
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const AgentWorkerService = protoDescriptor.emery.agents.AgentWorker;
import { TaskProgress } from './generated/agent_worker';
export type { TaskProgress };

// Type definitions for our gRPC calls (camelCase to match loader config)
export interface TaskRequest {
  taskId: string;
  agentId: number;
  skillName?: string;
  instructionConfig?: any;
  triggerData: any;
  organizationId: string;
  ownerId: string;
  timeoutSeconds?: number;
}


export enum TaskStatus {
  TASK_PENDING = 0,
  TASK_IN_PROGRESS = 1,
  TASK_COMPLETED = 2,
  TASK_FAILED = 3,
  TASK_CANCELLED = 4,
  TASK_TIMEOUT = 5,
}

export interface WorkerInfo {
  worker_id: string;
  version: string;
  organization_id: string;
  status: WorkerStatus;
  skills: string[];
  active_tasks: number;
  max_concurrent_tasks: number;
  uptime_seconds: string;
  supported_tools: string[];
}

export enum WorkerStatus {
  WORKER_HEALTHY = 0,
  WORKER_BUSY = 1,
  WORKER_DEGRADED = 2,
  WORKER_UNHEALTHY = 3,
  WORKER_SHUTTING_DOWN = 4,
}

export interface CancelTaskRequest {
  taskId: string;
  reason?: string;
}

export interface CancelTaskResponse {
  success: boolean;
  message: string;
}

/**
 * gRPC client for agent worker communication
 */
export class AgentWorkerClient {
  private client: any;
  private address: string;

  /**
   * Retry configuration for connection-level errors
   */
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000; // 1 second base delay for exponential backoff

  constructor(workerAddress: string) {
    this.address = workerAddress;
    console.log(`[GRPC-CLIENT] Creating new client for address: ${workerAddress}`);
    this.client = new AgentWorkerService(
      workerAddress,
      getGrpcClientCredentials(),
      {
        // gRPC keepalive settings for better connection performance
        'grpc.keepalive_time_ms': 30000, // Send keepalive ping every 30s
        'grpc.keepalive_timeout_ms': 10000, // Wait 10s for keepalive response
        'grpc.keepalive_permit_without_calls': 1, // Allow keepalive pings when no calls
        'grpc.http2.max_pings_without_data': 0, // Allow unlimited pings without data
        'grpc.http2.min_time_between_pings_ms': 10000, // Min 10s between pings
      }
    );
  }

  /**
   * Check if an error is retryable (connection-level errors, not application errors)
   */
  private isRetryableError(error: grpc.ServiceError): boolean {
    // Retry on connection-level errors, not application errors
    return (
      error.code === grpc.status.CANCELLED ||      // 1: Connection cancelled (worker crash/restart)
      error.code === grpc.status.UNAVAILABLE ||    // 14: Worker not reachable
      error.code === grpc.status.DEADLINE_EXCEEDED // 4: Connection timeout
    );
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a task on the worker and stream progress updates
   * Includes automatic retry with exponential backoff for connection-level errors
   */
  async executeTask(
    request: TaskRequest,
    onProgress: (progress: TaskProgress) => void
  ): Promise<void> {
    console.log(`[GRPC-CLIENT] Executing task ${request.taskId} on worker ${this.address}`);

    let lastError: grpc.ServiceError | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.executeTaskOnce(request, onProgress);
        return; // Success - exit the retry loop
      } catch (error) {
        const grpcError = error as grpc.ServiceError;
        lastError = grpcError;

        // Check if we should retry
        if (this.isRetryableError(grpcError) && attempt < this.MAX_RETRIES) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
          console.log(
            `[GRPC-RETRY] Task ${request.taskId} attempt ${attempt + 1}/${this.MAX_RETRIES + 1} failed ` +
            `with ${grpc.status[grpcError.code] || grpcError.code}, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          continue;
        }

        // Non-retryable error or max retries exceeded
        throw grpcError;
      }
    }

    // Should not reach here, but throw last error if we do
    throw lastError;
  }

  /**
   * Execute a task once (internal method, no retry)
   */
  private executeTaskOnce(
    request: TaskRequest,
    onProgress: (progress: TaskProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const call = this.client.ExecuteTask(request);

      call.on('data', (progress: TaskProgress) => {
        console.log(`[GRPC-PROGRESS] Task ${request.taskId}: ${progress.status}`, progress);
        onProgress(progress);
      });

      call.on('end', () => {
        console.log(`[GRPC-END] Task ${request.taskId} stream ended`);
        resolve();
      });

      call.on('error', (error: grpc.ServiceError) => {
        console.error(`[GRPC-ERROR] Task ${request.taskId} failed:`, error);
        if (error.code === grpc.status.UNAVAILABLE) {
          console.error(`[GRPC-CLIENT] Worker at ${this.address} is unavailable. Please ensure the worker is running.`);
        }
        reject(error);
      });
    });
  }

  /**
   * Get worker information and health status
   */
  async getWorkerInfo(): Promise<WorkerInfo> {
    return new Promise((resolve, reject) => {
      this.client.GetWorkerInfo({}, (error: grpc.ServiceError | null, response: WorkerInfo) => {
        if (error) {
          console.error('[GRPC-ERROR] GetWorkerInfo:', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Cancel a running task
   */
  async cancelTask(request: CancelTaskRequest): Promise<CancelTaskResponse> {
    return new Promise((resolve, reject) => {
      this.client.CancelTask(request, (error: grpc.ServiceError | null, response: CancelTaskResponse) => {
        if (error) {
          console.error(`[GRPC-ERROR] CancelTask ${request.taskId}:`, error);
          reject(error);
        } else {
          resolve(response);
        }
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

/**
 * Worker registry for managing connections to multiple worker instances
 */
export class WorkerRegistry {
  private workers: Map<string, AgentWorkerClient> = new Map();
  private workerHealthCache: Map<string, { info: any; lastCheck: number }> = new Map();
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds
  
  /**
   * Get or create a worker client for the given organization
   */
  getWorkerForOrganization(organizationId: string): AgentWorkerClient {
    const workerAddress = this.getWorkerAddress(organizationId);
    const cacheKey = `${organizationId}:${workerAddress}`;
    
    if (!this.workers.has(cacheKey)) {
      console.log(`[WORKER-REGISTRY] Creating new worker client for org ${organizationId} at ${workerAddress}`);
      this.workers.set(cacheKey, new AgentWorkerClient(workerAddress));
    }
    
    return this.workers.get(cacheKey)!;
  }
  
  /**
   * Get worker address for organization with improved service discovery
   */
  private getWorkerAddress(organizationId: string): string {
    // Strategy 1: Environment variable for specific organization
    const orgSpecificAddress = process.env[`WORKER_ADDRESS_${organizationId.toUpperCase()}`];
    if (orgSpecificAddress) {
      console.log(`[WORKER-DISCOVERY] Using org-specific address for ${organizationId}: ${orgSpecificAddress}`);
      return orgSpecificAddress;
    }
    
    // Strategy 2: Single worker address for all organizations (Cloud Map DNS)
    const singleWorkerAddress = process.env.WORKER_ADDRESS;
    if (singleWorkerAddress) {
      console.log(`[WORKER-DISCOVERY] Using Cloud Map service discovery: ${singleWorkerAddress}`);
      return singleWorkerAddress;
    }
    
    // Strategy 3: Cloud Map DNS (production default)
    const cloudMapAddress = "agent-service.emery.local:50051";
    console.log(`[WORKER-DISCOVERY] Using Cloud Map DNS: ${cloudMapAddress}`);
    return cloudMapAddress;
    
    // Strategy 4: Port-based distribution (fallback for local development)
    const basePort = parseInt(process.env.WORKER_BASE_PORT || '50051');
    const workerHost = process.env.WORKER_HOST || 'localhost';
    
    if (organizationId === 'default' || organizationId === 'test_org') {
      // Use base port for default/test organizations
      const address = `${workerHost}:${basePort}`;
      console.log(`[WORKER-DISCOVERY] Using base port for ${organizationId}: ${address}`);
      return address;
    }
    
    // Hash-based distribution for other organizations
    const orgHash = this.hashOrgId(organizationId);
    const workerPort = basePort + (orgHash % 100); // Distribute across 100 ports
    const address = `${workerHost}:${workerPort}`;
    console.log(`[WORKER-DISCOVERY] Using hash-based distribution for ${organizationId}: ${address}`);
    return address;
  }
  
  /**
   * Simple hash function for organization ID distribution
   */
  private hashOrgId(orgId: string): number {
    let hash = 0;
    for (let i = 0; i < orgId.length; i++) {
      const char = orgId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Get worker health information with caching
   */
  async getWorkerHealth(organizationId: string): Promise<any> {
    const cacheKey = organizationId;
    const cached = this.workerHealthCache.get(cacheKey);
    
    // Return cached result if still valid
    if (cached && Date.now() - cached.lastCheck < this.HEALTH_CACHE_TTL) {
      return cached.info;
    }
    
    try {
      const workerClient = this.getWorkerForOrganization(organizationId);
      const workerInfo = await workerClient.getWorkerInfo();
      
      // Cache the result
      this.workerHealthCache.set(cacheKey, {
        info: workerInfo,
        lastCheck: Date.now(),
      });
      
      return workerInfo;
    } catch (error) {
      console.error(`[WORKER-HEALTH] Failed to get health for org ${organizationId}:`, error);
      throw error;
    }
  }
  
  /**
   * List all available worker addresses for debugging
   */
  listWorkerAddresses(): Record<string, string> {
    const addresses: Record<string, string> = {};
    
    // Add environment-based addresses
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('WORKER_ADDRESS_')) {
        const orgId = key.replace('WORKER_ADDRESS_', '').toLowerCase();
        addresses[orgId] = process.env[key]!;
      }
    });
    
    // Add single worker address if set
    if (process.env.WORKER_ADDRESS) {
      addresses['*'] = process.env.WORKER_ADDRESS;
    }
    
    // Add default addresses
    const basePort = parseInt(process.env.WORKER_BASE_PORT || '50051');
    const workerHost = process.env.WORKER_HOST || 'localhost';
    addresses['default'] = `${workerHost}:${basePort}`;
    
    return addresses;
  }
  
  /**
   * Close all worker connections
   */
  closeAll(): void {
    this.workers.forEach(worker => worker.close());
    this.workers.clear();
  }
}

// Global worker registry instance  
export const workerRegistry = new WorkerRegistry();

// Re-export TaskStatus enum values for convenience
export const TaskStatusEnum = {
  TASK_PENDING: 0,
  TASK_IN_PROGRESS: 1,
  TASK_COMPLETED: 2,
  TASK_FAILED: 3,
  TASK_CANCELLED: 4,
  TASK_TIMEOUT: 5,
} as const;
