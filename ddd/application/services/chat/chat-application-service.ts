/**
 * Chat Application Service
 * 
 * Orchestrates chat operations with business logic and table connections.
 * Handles chat session management, message processing, and RAG integration.
 * Connects chats to dynamic tables for table-specific AI assistance.
 * 
 * AIDEV-NOTE: Application service for chat management - coordinates between
 * chat repositories, RAG services, and dynamic table context for table-connected chats
 */

import type { IChatRepository } from '@/ddd/domain/chat/repositories/chat-repository';
import type { IChatMessageRepository } from '@/ddd/domain/chat/repositories/chat-message-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import type { Chat, CreateChatData, ChatContextMetadata, DomainType } from '@/ddd/domain/chat/entities/chat';
import type { ChatMessage, CreateChatMessageData, ChatMessageMetadata } from '@/ddd/domain/chat/entities/chat-message';
import type { Result } from '@/ddd/domain/shared/result';
import { ChatEntity } from '@/ddd/domain/chat/entities/chat';
import { ChatMessageEntity } from '@/ddd/domain/chat/entities/chat-message';

export interface CreateChatCommand {
  organizationId: number;
  createdBy: string;
  title?: string; // Auto-generated if not provided
  description?: string;
  
  // Domain connections - choose one
  domainType?: DomainType;
  domainId?: number;
  tableId?: number; // Legacy table connection
}

export interface SendMessageCommand {
  chatId: string;
  userId: string;
  organizationId: number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: ChatMessageMetadata;
}

export interface GetChatHistoryQuery {
  chatId: string;
  userId: string;
  organizationId: number;
  limit?: number;
  offset?: number;
}

export interface GetChatsQuery {
  userId?: string;
  organizationId: number;
  tableId?: number;
  status?: 'active' | 'archived';
  limit?: number;
  offset?: number;
}

// Use unified Result interface from domain shared types
export type ChatApplicationServiceResult<T = any> = Result<T>;

export class ChatApplicationService {
  constructor(
    private readonly chatRepository: IChatRepository,
    private readonly messageRepository: IChatMessageRepository,
    private readonly tableRepository: IDynamicTableRepository,
    private readonly agentRepository?: IAgentRepository // Optional for agent domain support
  ) {}

  /**
   * Create a new chat session, optionally connected to any domain type
   */
  async createChat(command: CreateChatCommand): Promise<ChatApplicationServiceResult<Chat>> {
    try {
      // 1. Validate domain connection
      let domainName: string | undefined;
      let domainSchema: any = undefined;
      let resolvedDomainType = command.domainType;
      let resolvedDomainId = command.domainId;

      // Handle legacy table connection
      if (command.tableId && !command.domainType) {
        resolvedDomainType = 'table';
        resolvedDomainId = command.tableId;
      }

      if (resolvedDomainType && resolvedDomainId) {
        const validation = await this.validateDomainConnection(resolvedDomainType, resolvedDomainId, command.organizationId);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
        domainName = validation.domainName;
        domainSchema = validation.domainSchema;
      }

      // 2. Generate title if not provided
      const title = command.title || ChatEntity.generateContextTitle(
        resolvedDomainType, 
        domainName, 
        command.tableId, 
        resolvedDomainType === 'table' ? domainName : undefined
      );

      // 3. Create context metadata
      let contextMetadata: ChatContextMetadata;
      if (resolvedDomainType) {
        contextMetadata = ChatEntity.createDomainContextMetadata(resolvedDomainType, domainSchema);
      } else {
        contextMetadata = ChatEntity.createOrganizationContextMetadata();
      }

      // 4. Validate chat data
      const chatData: CreateChatData = {
        organizationId: command.organizationId,
        createdBy: command.createdBy,
        title,
        description: command.description,
        domainType: resolvedDomainType,
        domainId: resolvedDomainId,
        tableId: command.tableId, // Maintain legacy compatibility
        contextMetadata
      };

      const validation = ChatEntity.validateChatData(chatData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // 5. Create chat
      const chat = await this.chatRepository.create(chatData);

      // 6. Create welcome message
      const welcomeMessageData = this.createWelcomeMessage(chat.id, resolvedDomainType, domainName);
      await this.messageRepository.create(welcomeMessageData);

      // 7. Update chat message count
      await this.chatRepository.updateMessageStats(chat.id, 1, new Date());

      const chatTypeDesc = resolvedDomainType ? `${resolvedDomainType}-connected` : 'organization';
      console.log(`[CHAT-APP-SERVICE] Created ${chatTypeDesc} chat: ${chat.title}`);

      return {
        success: true,
        data: chat
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error creating chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat'
      };
    }
  }

  /**
   * Validate domain connection and get domain information
   */
  private async validateDomainConnection(domainType: DomainType, domainId: number, organizationId: number): Promise<{
    valid: boolean;
    error?: string;
    domainName?: string;
    domainSchema?: any;
  }> {
    switch (domainType) {
      case 'table':
        const table = await this.tableRepository.findById(domainId);
        if (!table) {
          return { valid: false, error: `Table ${domainId} not found` };
        }
        if (table.organizationId !== organizationId) {
          return { valid: false, error: 'Access denied: table not in your organization' };
        }
        return {
          valid: true,
          domainName: table.name,
          domainSchema: { tableName: table.name, dbName: table.dbName }
        };

      case 'agent':
        if (!this.agentRepository) {
          return { valid: false, error: 'Agent repository not available' };
        }
        const agent = await this.agentRepository.findById(AgentId.fromNumber(domainId));
        if (!agent) {
          return { valid: false, error: `Agent ${domainId} not found` };
        }
        if (agent.organizationId.value !== organizationId) {
          return { valid: false, error: 'Access denied: agent not in your organization' };
        }
        return {
          valid: true,
          domainName: agent.name,
          domainSchema: { agentName: agent.name, role: agent.role }
        };

      case 'file':
        // TODO: Implement file validation when IFileRepository is available
        return {
          valid: true,
          domainName: `File ${domainId}`,
          domainSchema: { fileId: domainId }
        };

      case 'team':
        // TODO: Implement team validation when ITeamRepository is available
        return {
          valid: true,
          domainName: `Team ${domainId}`,
          domainSchema: { teamId: domainId }
        };

      case 'workflow':
        // TODO: Implement workflow validation when IWorkflowRepository is available
        return {
          valid: true,
          domainName: `Workflow ${domainId}`,
          domainSchema: { workflowId: domainId }
        };

      default:
        return { valid: false, error: `Unsupported domain type: ${domainType}` };
    }
  }

  /**
   * Create appropriate welcome message based on domain type
   */
  private createWelcomeMessage(chatId: string, domainType?: DomainType | null, domainName?: string): CreateChatMessageData {
    if (domainType && domainName) {
      switch (domainType) {
        case 'table':
          return ChatMessageEntity.createTableWelcomeMessage(chatId, 0, domainName);
        case 'agent':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'agent', domainName);
        case 'file':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'file', domainName);
        case 'team':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'team', domainName);
        case 'workflow':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'workflow', domainName);
      }
    }
    
    return ChatMessageEntity.createOrganizationWelcomeMessage(chatId, 0);
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(command: SendMessageCommand): Promise<ChatApplicationServiceResult<ChatMessage>> {
    try {
      // 1. Verify chat exists and user has access
      const chat = await this.chatRepository.findById(command.chatId, command.organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      const chatEntity = new ChatEntity(chat);
      if (!chatEntity.canUserMessage(command.userId, command.organizationId)) {
        return {
          success: false,
          error: 'Access denied: cannot send messages to this chat'
        };
      }

      // 2. Get next message index
      const messageIndex = await this.messageRepository.getNextMessageIndex(command.chatId);

      // 3. Validate message data
      const messageData: CreateChatMessageData = {
        chatId: command.chatId,
        role: command.role,
        content: command.content,
        metadata: command.metadata,
        messageIndex
      };

      const validation = ChatMessageEntity.validateMessageData(messageData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // 4. Create message
      const message = await this.messageRepository.create(messageData);

      // 5. Update chat statistics
      const newMessageCount = await this.messageRepository.getMessageCount(command.chatId);
      await this.chatRepository.updateMessageStats(command.chatId, newMessageCount, new Date());

      console.log(`[CHAT-APP-SERVICE] Added ${command.role} message to chat ${chat.title}`);

      return {
        success: true,
        data: message
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  /**
   * Get chat history with messages
   */
  async getChatHistory(query: GetChatHistoryQuery): Promise<ChatApplicationServiceResult<{
    chat: Chat;
    messages: ChatMessage[];
    totalMessages: number;
  }>> {
    try {
      // 1. Verify chat exists and user has access
      const chat = await this.chatRepository.findById(query.chatId, query.organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      const chatEntity = new ChatEntity(chat);
      if (!chatEntity.canUserAccess(query.userId, query.organizationId)) {
        return {
          success: false,
          error: 'Access denied: cannot view this chat'
        };
      }

      // 2. Get messages
      const messages = await this.messageRepository.findByChatId(
        query.chatId,
        query.limit || 50,
        query.offset || 0
      );

      // 3. Get total message count
      const totalMessages = await this.messageRepository.getMessageCount(query.chatId);

      return {
        success: true,
        data: {
          chat,
          messages,
          totalMessages
        }
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error getting chat history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat history'
      };
    }
  }

  /**
   * Get chats for a user or organization, with optional table filtering
   */
  async getChats(query: GetChatsQuery): Promise<ChatApplicationServiceResult<Chat[]>> {
    try {
      let chats: Chat[];

      if (query.tableId) {
        // Get chats for specific table
        chats = await this.chatRepository.findByTable(
          query.tableId,
          query.organizationId,
          query.limit || 20,
          query.offset || 0
        );
      } else if (query.userId) {
        // Get chats for specific user
        chats = await this.chatRepository.findByUser(
          query.userId,
          query.organizationId,
          query.limit || 20,
          query.offset || 0
        );
      } else {
        // Get all chats for organization
        if (query.status === 'active') {
          chats = await this.chatRepository.findActiveByOrganization(
            query.organizationId,
            query.limit || 20,
            query.offset || 0
          );
        } else {
          chats = await this.chatRepository.findByOrganization(
            query.organizationId,
            query.limit || 20,
            query.offset || 0
          );
        }
      }

      return {
        success: true,
        data: chats
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error getting chats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chats'
      };
    }
  }

  /**
   * Get conversation context for AI processing
   */
  async getConversationContext(chatId: string, organizationId: number, contextSize: number = 10): Promise<ChatApplicationServiceResult<ChatMessage[]>> {
    try {
      // 1. Verify chat exists
      const chat = await this.chatRepository.findById(chatId, organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      // 2. Get recent messages for context
      const messages = await this.messageRepository.getConversationContext(chatId, contextSize);

      return {
        success: true,
        data: messages
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error getting conversation context:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation context'
      };
    }
  }

  /**
   * Archive a chat
   */
  async archiveChat(chatId: string, userId: string, organizationId: number): Promise<ChatApplicationServiceResult<void>> {
    try {
      // 1. Verify chat exists and user can edit
      const chat = await this.chatRepository.findById(chatId, organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      const chatEntity = new ChatEntity(chat);
      if (!chatEntity.canUserEdit(userId)) {
        return {
          success: false,
          error: 'Access denied: only chat creator can archive chat'
        };
      }

      // 2. Archive chat
      const success = await this.chatRepository.archive(chatId, organizationId);
      if (!success) {
        return {
          success: false,
          error: 'Failed to archive chat'
        };
      }

      console.log(`[CHAT-APP-SERVICE] Archived chat: ${chat.title}`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error archiving chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to archive chat'
      };
    }
  }

  /**
   * Delete a chat permanently
   */
  async deleteChat(chatId: string, userId: string, organizationId: number): Promise<ChatApplicationServiceResult<void>> {
    try {
      // 1. Verify chat exists and user can edit
      const chat = await this.chatRepository.findById(chatId, organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      const chatEntity = new ChatEntity(chat);
      if (!chatEntity.canUserEdit(userId)) {
        return {
          success: false,
          error: 'Access denied: only chat creator can delete chat'
        };
      }

      // 2. Delete all messages first
      await this.messageRepository.deleteByChatId(chatId);

      // 3. Delete chat
      const success = await this.chatRepository.delete(chatId, organizationId);
      if (!success) {
        return {
          success: false,
          error: 'Failed to delete chat'
        };
      }

      console.log(`[CHAT-APP-SERVICE] Deleted chat: ${chat.title}`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error deleting chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete chat'
      };
    }
  }

  /**
   * Get chat statistics for an organization
   */
  async getChatStats(organizationId: number): Promise<ChatApplicationServiceResult<{
    totalChats: number;
    activeChats: number;
    archivedChats: number;
    tableConnectedChats: number;
    totalMessages: number;
  }>> {
    try {
      const stats = await this.chatRepository.getOrganizationStats(organizationId);

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('[CHAT-APP-SERVICE] Error getting chat stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat statistics'
      };
    }
  }
}