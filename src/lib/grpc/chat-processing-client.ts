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
import type { MessagePart as LlamaIndexMessagePart } from '@llamaindex/chat-ui';
import type {
  ProcessMessageRequest,
  ProcessMessageResponse,
  HistoryMessage,
  ChatContext,
  ContentChunk,
  ProcessingComplete,
  ProcessingError,
  StepProgress,
  MessagePart
} from './generated/agent_worker';
import { toProtoMessageParts } from './mappers/message-part-mapper';

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
  skills?: any[];                // Fully resolved skill definitions with instructions, tools, inputs, outputs, content
  defaultModel?: string | null;  // Organization's default AI model
  userApiKey?: string;           // User API key for managed agents (skill_builder, etc.)
}

export interface StreamingChatResponse {
  type: 'content' | 'complete' | 'error' | 'step_progress';
  content?: string;
  sequence?: number;
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
    // Default to Cloud Map service discovery for production, localhost for development
    this.address = serviceAddress || process.env.WORKER_ADDRESS || 'localhost:50051';
    console.log(`[CHAT-GRPC-CLIENT] Creating ChatProcessingClient for address: ${this.address}`);

    this.client = new ChatProcessingService(
      this.address,
      grpc.credentials.createInsecure(), // AIDEV-TODO: Add TLS in production
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
   * Process a message and stream AI response
   *
   * This is a server-side method called by Next.js API routes.
   * The actual streaming to browser happens at the API route level.
   *
   * Accepts multimodal message parts (text + images) via LlamaIndex format.
   */
  async processMessage(
    messageParts: LlamaIndexMessagePart[],
    userId: string,
    organizationId: number,
    conversationHistory: HistoryMessage[] = [],
    options: ChatProcessingOptions = {},
    onStreamingResponse: (response: StreamingChatResponse) => void,
    messageId?: string,
    sessionId?: string
  ): Promise<void> {

    // Generate message ID if not provided
    const actualMessageId = messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Use sessionId if provided, otherwise generate from organizationId and userId
    const actualSessionId = sessionId || `${organizationId}_${userId}`;

    console.log(`[CHAT-GRPC-CLIENT] Processing message ${actualMessageId} for user ${userId} in org ${organizationId}`);
    console.log(`[CHAT-GRPC-CLIENT] Session ID: ${actualSessionId}`);
    console.log(`[CHAT-GRPC-CLIENT] Message parts: ${messageParts.length}`);
    console.log(`[CHAT-GRPC-CLIENT] History messages: ${conversationHistory.length}`);

    // Convert LlamaIndex MessageParts to Protocol Buffer format
    const protoMessageParts = toProtoMessageParts(messageParts);
    console.log(`[CHAT-GRPC-CLIENT] Converted to ${protoMessageParts.length} proto message parts`);

    // Build AgentConfig with tools and skills
    // AIDEV-NOTE: Serialize nested config objects to JSON for protobuf map<string, string>
    const systemTools = (options.tools || []).map(tool => {
      const config: Record<string, string> = {};

      if (tool.config) {
        for (const [key, value] of Object.entries(tool.config)) {
          // Serialize objects/arrays to JSON, keep strings as-is
          config[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }

      return {
        name: tool.name,
        version: '', // Empty version since ToolConfig no longer has version
        config: config
      };
    });

    // Create skill reference tools for LLM to call
    const skillReferenceTools = (options.skills || []).map(skill => ({
      name: `skill-${skill.name}`,
      version: '',
      config: {
        type: 'skill_reference',
        skill_id: skill.id.toString()  // Use ID for lookup
      }
    }));

    // Combine system tools and skill reference tools
    const allTools = [...systemTools, ...skillReferenceTools];

    // Build full SkillConfig definitions
    const skillConfigs = (options.skills || []).map(skill => ({
      id: skill.id,  // Include skill ID
      name: skill.name,
      description: skill.description || '',
      inputs: skill.inputs || [],
      outputs: skill.outputs || [],
      instructions: skill.instructions || '',
      tools: (skill.tools || []).map((t: any) => ({
        name: t.name,
        version: '',
        config: t.config || {}
      })),
      model: skill.model || '',
      agentType: skill.agentType || '',  // "tool_calling" (default) or "code_agent"
      content: skill.content || [],
      executionType: skill.executionType || 'agent',  // 'agent' (default) or 'operation'
      taskModelConfig: skill.taskModelConfig ? {
        modelId: skill.taskModelConfig.modelId || '',
        taskType: skill.taskModelConfig.taskType || '',
        parameters: Object.fromEntries(
          Object.entries(skill.taskModelConfig.parameters || {}).map(([k, v]) => [k, String(v)])
        )
      } : undefined
    }));

    const agentConfig = {
      name: '', // Chat agents don't have a specific name
      role: '',
      description: '',
      persona: '',
      tools: allTools,
      servers: [],
      skills: skillConfigs,
      defaultModel: options.defaultModel || ''
    };

    console.log(`[CHAT-GRPC-CLIENT] Built AgentConfig with ${allTools.length} tools (${systemTools.length} system + ${skillReferenceTools.length} skill refs) and ${skillConfigs.length} skills`);

    // Build request
    const request: ProcessMessageRequest = {
      context: undefined, // Will set below if needed
      messageParts: protoMessageParts,
      userId: userId,
      organizationId: organizationId,
      conversationHistory: conversationHistory,
      agentConfig: agentConfig,
      model: options.defaultModel || '', // Pass organization's default model or empty string for system default
      messageId: actualMessageId, // Add message ID for cancellation tracking
      sessionId: actualSessionId, // Session ID for stateful agent persistence
      userApiKey: options.userApiKey || '' // User API key for managed agents (skill_builder, etc.)
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
        // AIDEV-NOTE: This is a gRPC connection error (worker unavailable), classified as FATAL
        onStreamingResponse({
          type: 'error',
          error: {
            errorCode: 'GRPC_ERROR',
            errorMessage: error.code === grpc.status.UNAVAILABLE
              ? 'AI service is temporarily unavailable.'
              : 'An unexpected error occurred.',
            errorDetails: {
              'grpc_code': error.code.toString(),
              'grpc_details': error.details || 'No additional details'
            },
            hint: error.code === grpc.status.UNAVAILABLE
              ? 'Please try again in a moment. If the issue persists, contact support.'
              : 'Please try again or contact support if the problem continues.',
            canRetry: true,
            autoRetry: false,
            sessionReset: error.code === grpc.status.UNAVAILABLE  // Fatal if service unavailable
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