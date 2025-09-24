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
  ProcessingError
} from './generated/agent_worker';

// Load protobuf definition  
const PROTO_PATH = path.join(process.cwd(), 'proto', 'agent_worker.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
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
  enableRag?: boolean;
  ragThreshold?: number;
  maxRagDocs?: number;
  primaryRagWeight?: number;
  assembledRagContext?: string;  // Pre-assembled RAG context from DualContextRagService
  ragSources?: string[];         // RAG source summary
  tools?: ToolConfig[];          // Available tools for the chat
}

export interface StreamingChatResponse {
  type: 'content' | 'rag_context' | 'complete' | 'error';
  content?: string;
  sequence?: number;
  ragContext?: RagContext;
  complete?: ProcessingComplete;
  error?: ProcessingError;
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
    onStreamingResponse: (response: StreamingChatResponse) => void
  ): Promise<void> {
    
    console.log(`[CHAT-GRPC-CLIENT] Processing message for user ${userId} in org ${organizationId}`);
    console.log(`[CHAT-GRPC-CLIENT] Message preview: ${messageContent.substring(0, 100)}...`);
    console.log(`[CHAT-GRPC-CLIENT] History messages: ${conversationHistory.length}`);

    // Build request
    const request: ProcessMessageRequest = {
      message_content: messageContent,
      user_id: userId,
      organization_id: organizationId,
      conversation_history: conversationHistory,
      tools: (options.tools || []).map(tool => ({
        name: tool.name,
        version: '', // Empty version since ToolConfig no longer has version
        config: tool.config || {}
      })) // Add tools from options
    };

    // Add context if provided
    if (options.domainType || options.enableRag || options.assembledRagContext) {
      const context: ChatContext = {
        domain_type: options.domainType || '',
        domain_id: options.domainId || 0,
        enable_rag: options.enableRag || false,
        rag_threshold: options.ragThreshold || 0.3,
        max_rag_docs: options.maxRagDocs || 5,
        primary_rag_weight: options.primaryRagWeight || 0.7,
        assembled_rag_context: options.assembledRagContext || '',
        rag_sources: options.ragSources || []
      };
      request.context = context;
    }

    return new Promise((resolve, reject) => {
      console.log(`[CHAT-GRPC-CLIENT] Starting gRPC stream for message processing`);
      const call = this.client.ProcessMessage(request);

      call.on('data', (response: ProcessMessageResponse) => {
        // console.log(`[CHAT-GRPC-CLIENT] Received streaming response:`, {
        //   hasContentChunk: !!response.content_chunk,
        //   hasRagContext: !!response.rag_context,
        //   hasComplete: !!response.complete,
        //   hasError: !!response.error,
        //   timestamp: response.timestamp
        // });

        // Convert gRPC response to standardized streaming response
        let streamingResponse: StreamingChatResponse;

        if (response.content_chunk) {
          streamingResponse = {
            type: 'content',
            content: response.content_chunk.content,
            sequence: response.content_chunk.sequence,
            timestamp: response.timestamp
          };
        } else if (response.rag_context) {
          streamingResponse = {
            type: 'rag_context',
            ragContext: response.rag_context,
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
            error_code: 'GRPC_ERROR',
            error_message: error.message,
            error_details: {
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