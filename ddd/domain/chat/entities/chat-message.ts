/**
 * ChatMessage Domain Entity
 * 
 * Represents individual messages within a chat session.
 * Manages message content, metadata, RAG sources, and AI processing information.
 * 
 * AIDEV-NOTE: Domain entity for chat messages - contains business rules for
 * message validation, RAG source tracking, and conversation flow management
 */

export interface ChatMessageMetadata {
  ragSources?: Array<{
    documentId: string;
    title: string;
    similarity: number;
    domainType: string;
  }>;
  modelUsed?: string;
  processingTime?: number;
  tokenCount?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  
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
  chatId: string;
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

  get id(): string {
    return this.message.id;
  }

  get chatId(): string {
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

  get hasRagSources(): boolean {
    return !!(this.message.metadata?.ragSources && this.message.metadata.ragSources.length > 0);
  }

  get ragSourceCount(): number {
    return this.message.metadata?.ragSources?.length || 0;
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
   * Get the highest similarity RAG source if available
   */
  get topRagSource(): { documentId: string; title: string; similarity: number; domainType: string } | null {
    if (!this.message.metadata?.ragSources || this.message.metadata.ragSources.length === 0) {
      return null;
    }

    return this.message.metadata.ragSources.reduce((top, current) => 
      current.similarity > top.similarity ? current : top
    );
  }

  /**
   * Get RAG sources filtered by domain type
   */
  getRagSourcesByType(domainType: string): Array<{ documentId: string; title: string; similarity: number; domainType: string }> {
    return this.message.metadata?.ragSources?.filter(source => source.domainType === domainType) || [];
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

    // Validate RAG sources if provided
    if (data.metadata?.ragSources) {
      for (const source of data.metadata.ragSources) {
        if (!source.documentId || !source.title || typeof source.similarity !== 'number') {
          errors.push('Invalid RAG source data - documentId, title, and similarity are required');
          break;
        }
        
        if (source.similarity < 0 || source.similarity > 1) {
          errors.push('RAG source similarity must be between 0 and 1');
          break;
        }
      }
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
   * Create metadata for assistant messages with RAG sources
   */
  static createAssistantMessageMetadata(
    ragSources: Array<{ documentId: string; title: string; similarity: number; domainType: string }>,
    modelUsed: string,
    processingTime: number,
    tokenCount?: number
  ): ChatMessageMetadata {
    return {
      ragSources,
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
  static createSystemMessage(chatId: string, messageIndex: number, content: string): CreateChatMessageData {
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
  static createTableWelcomeMessage(chatId: string, messageIndex: number, tableName: string): CreateChatMessageData {
    const content = `Welcome to your chat about the "${tableName}" table! I can help you understand your data, create queries, and provide insights. What would you like to know?`;
    
    return this.createSystemMessage(chatId, messageIndex, content);
  }

  /**
   * Create a welcome message for domain-specific chats
   */
  static createDomainWelcomeMessage(chatId: string, messageIndex: number, domainType: string, domainName: string): CreateChatMessageData {
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
      case 'workflow':
        content = `Welcome to your chat about workflow "${domainName}"! I can help you understand the process steps, execution history, optimization opportunities, and troubleshoot issues. How can I help?`;
        break;
      default:
        content = `Welcome to your chat about ${domainType} "${domainName}"! I can provide assistance and insights. How can I help you today?`;
    }
    
    return this.createSystemMessage(chatId, messageIndex, content);
  }

  /**
   * Create a welcome message for organization-wide chats
   */
  static createOrganizationWelcomeMessage(chatId: string, messageIndex: number, organizationName?: string): CreateChatMessageData {
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