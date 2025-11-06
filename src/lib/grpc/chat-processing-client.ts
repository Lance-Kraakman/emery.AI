/**
 * gRPC-Web client for ChatProcessingService
 * 
 * Handles AI processing operations only - database operations remain in Next.js.
 * This client is used by Next.js API routes to communicate with the Python gRPC service.
 * 
 * AIDEV-NOTE: gRPC-Web client for browser/Next.js usage, not the server-side grpc-js client.
 * Uses the Next.js proxy (/grpc/*) to communicate with Python gRPC service.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import type { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type {
  ProcessMessageRequest,
  ProcessMessageResponse,
  HistoryMessage,
  ChatContext,
  ContentChunk,
  RagContext,
  ProcessingComplete,
  ProcessingError,
  StepProgress
} from './generated/agent_worker';

// Load protobuf definition
const PROTO_PATH = path.join(process.cwd(), 'proto', 'agent_worker.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false, // Convert snake_case to camelCase to match TypeScript generated types
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const ChatProcessingService = protoDescriptor.emery.agents.ChatProcessingService;

export interface ChatProcessingOptions {
  domainType?: string;
  domainId?: number;
  tools?: ToolConfig[];          // Available tools for the chat
  defaultModel?: string | null;  // Organization's default AI model
}

export interface StreamingChatResponse {
  type: 'content' | 'rag_context' | 'complete' | 'error' | 'step_progress';
  content?: string;
  sequence?: number;
  ragContext?: RagContext;
  complete?: ProcessingComplete;
  error?: ProcessingError;
  stepProgress?: StepProgress;
  timestamp: number;
}

/**
 * Client for ChatProcessingService - AI operations only
 */
export class ChatProcessingClient {
  private client: any;
  private address: string;

  constructor(serviceAddress?: string) {
    // Default to localhost for development, can be overridden
    this.address = serviceAddress || process.env.WORKER_ADDRESS || 'localhost:50051';
    console.log(`[CHAT-GRPC-CLIENT] Creating ChatProcessingClient for address: ${this.address}`);
    
    this.client = new ChatProcessingService(
      this.address,
      grpc.credentials.createInsecure() // AIDEV-TODO: Add TLS in production
    );
  }

  /**
   * Process a message and stream AI response
   * 
   * This is a server-side method called by Next.js API routes.
   * The actual streaming to browser happens at the API route level.
   */
  async processMessage(
    messageContent: string,
    userId: string,
    organizationId: number,
    conversationHistory: HistoryMessage[] = [],
    options: ChatProcessingOptions = {},
    onStreamingResponse: (response: StreamingChatResponse) => void,
    messageId?: string
  ): Promise<void> {

    // Generate message ID if not provided
    const actualMessageId = messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[CHAT-GRPC-CLIENT] Processing message ${actualMessageId} for user ${userId} in org ${organizationId}`);
    console.log(`[CHAT-GRPC-CLIENT] Message preview: ${messageContent.substring(0, 100)}...`);
    console.log(`[CHAT-GRPC-CLIENT] History messages: ${conversationHistory.length}`);

    // Build request
    const request: ProcessMessageRequest = {
      context: undefined, // Will set below if needed
      messageContent: messageContent,
      userId: userId,
      organizationId: organizationId,
      conversationHistory: conversationHistory,
      model: options.defaultModel || '', // Pass organization's default model or empty string for system default
      messageId: actualMessageId, // Add message ID for cancellation tracking
      tools: (options.tools || []).map(tool => ({
        name: tool.name,
        version: '', // Empty version since ToolConfig no longer has version
        config: tool.config || {}
      })) // Add tools from options
    };

    // Add context if provided
    if (options.domainType) {
      const context: ChatContext = {
        domainType: options.domainType || '',
        domainId: options.domainId || 0
      };
      request.context = context;
    }

    return new Promise((resolve, reject) => {
      console.log(`[CHAT-GRPC-CLIENT] Starting gRPC stream for message processing`);
      const call = this.client.ProcessMessage(request);

      call.on('data', (response: ProcessMessageResponse) => {
        console.log(`[CHAT-GRPC-CLIENT] Received streaming response:`, {
          hasContentChunk: !!response.contentChunk,
          hasRagContext: !!response.ragContext,
          hasComplete: !!response.complete,
          hasError: !!response.error,
          hasStepProgress: !!response.stepProgress,
          timestamp: response.timestamp
        });

        // Convert gRPC response to standardized streaming response
        // AIDEV-NOTE: keepCase:false converts snake_case proto fields to camelCase at runtime
        let streamingResponse: StreamingChatResponse;

        if (response.stepProgress) {
          // Real-time step execution progress
          streamingResponse = {
            type: 'step_progress',
            stepProgress: response.stepProgress,
            timestamp: response.timestamp
          };
        } else if (response.contentChunk) {
          streamingResponse = {
            type: 'content',
            content: response.contentChunk.content,
            sequence: response.contentChunk.sequence,
            timestamp: response.timestamp
          };
        } else if (response.ragContext) {
          streamingResponse = {
            type: 'rag_context',
            ragContext: response.ragContext,
            timestamp: response.timestamp
          };
        } else if (response.complete) {
          streamingResponse = {
            type: 'complete',
            complete: response.complete,
            timestamp: response.timestamp
          };
        } else if (response.error) {
          streamingResponse = {
            type: 'error',
            error: response.error,
            timestamp: response.timestamp
          };
        } else {
          console.warn(`[CHAT-GRPC-CLIENT] Unknown response type received`);
          return;
        }

        // Pass to callback handler
        onStreamingResponse(streamingResponse);
      });

      call.on('end', () => {
        console.log(`[CHAT-GRPC-CLIENT] Message processing stream ended successfully`);
        resolve();
      });

      call.on('error', (error: grpc.ServiceError) => {
        console.error(`[CHAT-GRPC-CLIENT] Message processing failed:`, error);
        
        if (error.code === grpc.status.UNAVAILABLE) {
          console.error(`[CHAT-GRPC-CLIENT] ChatProcessingService at ${this.address} is unavailable. Please ensure the gRPC server is running.`);
        }
        
        // Send error through callback before rejecting
        onStreamingResponse({
          type: 'error',
          error: {
            errorCode: 'GRPC_ERROR',
            errorMessage: error.message,
            errorDetails: {
              'grpc_code': error.code.toString(),
              'grpc_details': error.details || 'No additional details'
            }
          },
          timestamp: Date.now()
        });
        
        reject(error);
      });
    });
  }

  /**
   * Cancel an in-progress message processing
   *
   * @param messageId - The message ID to cancel
   * @param userId - User requesting cancellation
   * @param organizationId - Organization context
   */
  async cancelMessage(
    messageId: string,
    userId: string,
    organizationId: number
  ): Promise<{ success: boolean; message: string }> {
    console.log(`[CHAT-GRPC-CLIENT] Cancelling message ${messageId}`);

    return new Promise((resolve, reject) => {
      const request = {
        messageId: messageId,
        userId: userId,
        organizationId: organizationId
      };

      this.client.CancelMessage(request, (error: any, response: any) => {
        if (error) {
          console.error(`[CHAT-GRPC-CLIENT] Cancel failed:`, error);
          reject(error);
        } else {
          console.log(`[CHAT-GRPC-CLIENT] Cancel response:`, response);
          resolve({
            success: response.success,
            message: response.message
          });
        }
      });
    });
  }

  /**
   * Close the gRPC connection
   */
  close(): void {
    if (this.client) {
      this.client.close();
    }
  }
}

/**
 * Registry for managing ChatProcessingClient instances by organization
 */
export class ChatProcessingClientRegistry {
  private clients: Map<string, ChatProcessingClient> = new Map();
  
  /**
   * Get or create a ChatProcessingClient for the given organization
   */
  getClientForOrganization(organizationId: string): ChatProcessingClient {
    const cacheKey = organizationId;
    
    if (!this.clients.has(cacheKey)) {
      console.log(`[CHAT-CLIENT-REGISTRY] Creating new ChatProcessingClient for org ${organizationId}`);
      
      // Use same worker discovery logic as AgentWorkerClient
      const workerAddress = this.getWorkerAddress(organizationId);
      this.clients.set(cacheKey, new ChatProcessingClient(workerAddress));
    }
    
    return this.clients.get(cacheKey)!;
  }
  
  /**
   * Get worker address for organization (matches AgentWorkerClient logic)
   */
  private getWorkerAddress(organizationId: string): string {
    // Strategy 1: Environment variable for specific organization
    const orgSpecificAddress = process.env[`WORKER_ADDRESS_${organizationId.toUpperCase()}`];
    if (orgSpecificAddress) {
      console.log(`[CHAT-CLIENT-REGISTRY] Using org-specific address for ${organizationId}: ${orgSpecificAddress}`);
      return orgSpecificAddress;
    }
    
    // Strategy 2: Single worker address for all organizations (development)
    const singleWorkerAddress = process.env.WORKER_ADDRESS;
    if (singleWorkerAddress) {
      console.log(`[CHAT-CLIENT-REGISTRY] Using single worker address: ${singleWorkerAddress}`);
      return singleWorkerAddress;
    }
    
    // Strategy 3: Default address
    const defaultAddress = 'localhost:50051';
    console.log(`[CHAT-CLIENT-REGISTRY] Using default worker address: ${defaultAddress}`);
    return defaultAddress;
  }
  
  /**
   * Close all client connections
   */
  closeAll(): void {
    this.clients.forEach(client => client.close());
    this.clients.clear();
  }
}

// Global client registry instance
export const chatProcessingClientRegistry = new ChatProcessingClientRegistry();

/**
 * Convenience function to get a ChatProcessingClient for an organization
 */
export function getChatProcessingClient(organizationId: string): ChatProcessingClient {
  return chatProcessingClientRegistry.getClientForOrganization(organizationId);
}