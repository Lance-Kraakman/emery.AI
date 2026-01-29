/**
 * ChatMessage Domain Entity
 *
 * Represents individual messages within a chat session.
 * Manages message content, metadata, and AI processing information.
 *
 * AIDEV-NOTE: Domain entity for chat messages - contains business rules for
 * message validation and conversation flow management
 */

import { ChatId, ChatMessageId } from "../../shared/value-objects";
import type { AnyAttachmentMetadata } from "../../../domain/multimodal/value-objects/attachment-metadata";
import type { ExecutionStep } from "../value-objects/execution-step";

/**
 * Plan step status for tracking execution progress
 */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Individual step within a plan
 */
export interface MessagePlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
  tool_call?: string;
  result?: string;
}

/**
 * Plan persisted in message metadata
 *
 * AIDEV-NOTE: Plans are stored in message metadata for history/audit trail.
 * Supports nested plans via nested_plans array for sub-skill execution tracking.
 */
export interface MessagePlan {
  id: string;
  goal: string;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'executing' | 'completed' | 'failed';
  steps: MessagePlanStep[];
  nested_plans?: MessagePlan[];  // For sub-skill plans (StepPlan)
  created_at: string;
  updated_at: string;
}

/**
 * Option for HITL questions/choices
 */
export interface InputOption {
  id: string;
  label: string;
  description?: string;
}

/**
 * Awaiting input state for HITL (plan approval or questions)
 *
 * AIDEV-NOTE: Used for both plan approval and agent questions.
 * - plan_approval: Shows plan + Approve/Reject/Modify buttons
 * - question: Shows question + option buttons for user choice
 */
export interface AwaitingInput {
  type: 'plan_approval' | 'question';
  title: string;
  content: string;  // Plan markdown or question text
  options: InputOption[];
  plan_json?: string;  // Full plan JSON for approval type
}

export interface ChatMessageMetadata {
  modelUsed?: string;
  processingTime?: number;
  tokenCount?: number;
  error?: string;
  // Multimodal attachments (images, audio, documents)
  attachments?: AnyAttachmentMetadata[];
  // Agent execution steps (planning, actions, reasoning)
  executionSteps?: ExecutionStep[];
  // Plan tracking for goal breakdown and progress
  plan?: MessagePlan;
  // HITL state when awaiting user input (approval or question)
  awaitingInput?: AwaitingInput;
  // Streaming status for optimistic saves (undefined = complete for backward compat)
  streamingStatus?: 'streaming' | 'complete' | 'error';
}

export interface ChatMessage {
  id: ChatMessageId;
  chatId: ChatId;
  
  // Message content
  role: 'user' | 'assistant' | 'system';
  content: string;
  
  // AI and processing metadata
  metadata?: ChatMessageMetadata;
  
  // Message ordering and organization
  messageIndex: number; // Sequential order within chat
  parentMessageId?: string; // For threading/editing
  
  createdAt: Date;
}

export interface CreateChatMessageData {
  chatId: ChatId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: ChatMessageMetadata;
  messageIndex: number;
  parentMessageId?: string;
}

export interface UpdateChatMessageData {
  content?: string;
  metadata?: ChatMessageMetadata;
}

/**
 * ChatMessage business rules and validation
 */
export class ChatMessageEntity {
  constructor(private readonly message: ChatMessage) {}

  get id(): ChatMessageId {
    return this.message.id;
  }

  get chatId(): ChatId {
    return this.message.chatId;
  }

  get role(): string {
    return this.message.role;
  }

  get content(): string {
    return this.message.content;
  }

  get messageIndex(): number {
    return this.message.messageIndex;
  }

  get modelUsed(): string | undefined {
    return this.message.metadata?.modelUsed;
  }

  get processingTime(): number | undefined {
    return this.message.metadata?.processingTime;
  }

  get hasError(): boolean {
    return !!(this.message.metadata?.error);
  }

  get isUserMessage(): boolean {
    return this.message.role === 'user';
  }

  get isAssistantMessage(): boolean {
    return this.message.role === 'assistant';
  }

  get isSystemMessage(): boolean {
    return this.message.role === 'system';
  }

  /**
   * Check if this message is a response to another message
   */
  get isReply(): boolean {
    return !!this.message.parentMessageId;
  }

  /**
   * Validate message data before creation/update
   */
  static validateMessageData(data: CreateChatMessageData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.chatId) {
      errors.push('Chat ID is required');
    }

    if (!data.role || !['user', 'assistant', 'system'].includes(data.role)) {
      errors.push('Valid role (user, assistant, or system) is required');
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.push('Message content is required');
    }

    if (data.content && data.content.length > 10000) {
      errors.push('Message content must be less than 10,000 characters');
    }

    if (typeof data.messageIndex !== 'number' || data.messageIndex < 0) {
      errors.push('Valid message index is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create metadata for user messages (minimal)
   */
  static createUserMessageMetadata(): ChatMessageMetadata {
    return {
      // User messages typically don't have AI processing metadata
    };
  }

  /**
   * Create metadata for assistant messages
   */
  static createAssistantMessageMetadata(
    modelUsed: string,
    processingTime: number,
    tokenCount?: number
  ): ChatMessageMetadata {
    return {
      modelUsed,
      processingTime,
      tokenCount
    };
  }

  /**
   * Create metadata for error messages
   */
  static createErrorMessageMetadata(error: string, modelUsed?: string): ChatMessageMetadata {
    return {
      error,
      modelUsed
    };
  }

  /**
   * Create a system message for chat initialization
   */
  static createSystemMessage(chatId: ChatId, messageIndex: number, content: string): CreateChatMessageData {
    return {
      chatId,
      role: 'system',
      content,
      messageIndex,
      metadata: {}
    };
  }

  /**
   * Create a welcome message for table-connected chats
   */
  static createTableWelcomeMessage(chatId: ChatId, messageIndex: number, tableName: string): CreateChatMessageData {
    const content = `Welcome to your chat about the "${tableName}" table! I can help you understand your data, create queries, and provide insights. What would you like to know?`;
    
    return this.createSystemMessage(chatId, messageIndex, content);
  }

  /**
   * Create a welcome message for domain-specific chats
   */
  static createDomainWelcomeMessage(chatId: ChatId, messageIndex: number, domainType: string, domainName: string): CreateChatMessageData {
    let content: string;
    
    switch (domainType) {
      case 'agent':
        content = `Welcome to your chat about agent "${domainName}"! I can help you understand this agent's capabilities, review execution history, and provide insights about its performance. What would you like to know?`;
        break;
      case 'file':
        content = `Welcome to your chat about file "${domainName}"! I can help you analyze the content, understand its structure, and answer questions about this document. How can I assist you?`;
        break;
      case 'team':
        content = `Welcome to your chat about team "${domainName}"! I can help you understand team dynamics, member roles, recent activities, and coordination tasks. What would you like to discuss?`;
        break;
      default:
        content = `Welcome to your chat about ${domainType} "${domainName}"! I can provide assistance and insights. How can I help you today?`;
    }
    
    return this.createSystemMessage(chatId, messageIndex, content);
  }

  /**
   * Create a welcome message for organization-wide chats
   */
  static createOrganizationWelcomeMessage(chatId: ChatId, messageIndex: number, organizationName?: string): CreateChatMessageData {
    const orgText = organizationName ? ` for ${organizationName}` : '';
    const content = `Welcome to your organizational chat${orgText}! I can help you with your tables, data, workflows, and answer questions about your organization. How can I assist you today?`;
    
    return this.createSystemMessage(chatId, messageIndex, content);
  }

  /**
   * Truncate content for display purposes
   */
  getTruncatedContent(maxLength: number = 100): string {
    if (this.message.content.length <= maxLength) {
      return this.message.content;
    }
    
    return this.message.content.substring(0, maxLength) + '...';
  }

  /**
   * Convert to plain object for API responses
   */
  toJSON(): ChatMessage {
    return { ...this.message };
  }
}