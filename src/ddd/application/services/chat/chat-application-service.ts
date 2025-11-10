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
import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { AgentId, TableId, OrganizationId, UserId, ChatId } from '@/ddd/domain/shared/value-objects';
import { Chat, ChatUtils, type CreateChatData, type ChatContextMetadata } from '@/ddd/domain/chat/entities/chat';
import type { DomainType } from '@/ddd/domain/shared/types/domain-type';
import type { ChatMessage, CreateChatMessageData, ChatMessageMetadata } from '@/ddd/domain/chat/entities/chat-message';
import type { Result } from '@/ddd/domain/shared/result';
import { ChatMessageEntity } from '@/ddd/domain/chat/entities/chat-message';
import type {
  CreateChatDTO,
  SendMessageDTO,
  GetChatHistoryDTO,
  GetChatsDTO,
  ChatSessionDTO,
  ChatMessageDTO,
  ChatWithMessagesDTO
} from '@/app/dtos/chat.dto';
import { ChatMapper } from '@/app/mappers/chat-mapper';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('ChatService');

export class ChatApplicationService {
  constructor(
    private readonly chatRepository: IChatRepository,
    private readonly messageRepository: IChatMessageRepository,
    private readonly dynamicTableService: DynamicTableService,
    private readonly agentRepository?: IAgentRepository // Optional for agent domain support
  ) {}

  /**
   * Create a new chat session, optionally connected to any domain type
   */
  async createChat(dto: CreateChatDTO): Promise<Result<ChatSessionDTO>> {
    try {
      // Convert DTO to Value Objects
      const organizationId = OrganizationId.fromNumber(dto.organizationId);
      const createdBy = UserId.fromString(dto.createdBy);

      // 1. Validate domain connection and get domain info
      let contextMetadata: ChatContextMetadata;

      if (dto.domainType && dto.domainId) {
        const validation = await this.validateDomainConnection(dto.domainType, dto.domainId, dto.organizationId);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        // Create domain-specific context metadata
        contextMetadata = ChatUtils.createDomainContextMetadata(
          dto.domainType,
          dto.domainId,
          validation.domainName!,
          validation.domainSchema
        );
      } else {
        // Create organization-wide context metadata
        contextMetadata = ChatUtils.createOrganizationContextMetadata();
      }

      // 2. Generate title if not provided
      const title = dto.title || ChatUtils.generateContextTitle(contextMetadata);

      // 3. Validate chat data
      const chatData: CreateChatData = {
        organizationId,
        createdBy,
        title,
        description: dto.description,
        contextMetadata
      };

      const validation = ChatUtils.validateChatData(chatData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // 5. Create chat
      const chat = await this.chatRepository.create(chatData);

      // 4. Create welcome message
      const welcomeMessageData = this.createWelcomeMessage(chat.id, contextMetadata);
      await this.messageRepository.create(welcomeMessageData);

      // 5. Update chat message count
      await this.chatRepository.updateMessageStats(chat.id, 1, new Date());

      const chatTypeDesc = contextMetadata.contextType === 'organizations' ? 'organization' : `${contextMetadata.contextType}-connected`;
      logger.summary(`Created ${chatTypeDesc} chat: ${chat.title}`);

      return {
        success: true,
        data: ChatMapper.toSessionDTO(chat)
      };

    } catch (error) {
      logger.error('Error creating chat:', error);
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
      case 'tables':
        const table = await this.dynamicTableService.getTable(TableId.fromNumber(domainId));
        if (!table) {
          return { valid: false, error: `Table ${domainId} not found` };
        }
        if (table.organizationId.value !== organizationId) {
          return { valid: false, error: 'Access denied: table not in your organization' };
        }
        return {
          valid: true,
          domainName: table.name,
          domainSchema: { tableName: table.name, dbName: table.name }
        };

      case 'agents':
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

      case 'files':
        // TODO: Implement file validation when IFileRepository is available
        return {
          valid: true,
          domainName: `File ${domainId}`,
          domainSchema: { fileId: domainId }
        };

      case 'teams':
        // TODO: Implement team validation when ITeamRepository is available
        return {
          valid: true,
          domainName: `Team ${domainId}`,
          domainSchema: { teamId: domainId }
        };
      default:
        return { valid: false, error: `Unsupported domain type: ${domainType}` };
    }
  }

  /**
   * Create appropriate welcome message based on context metadata
   */
  private createWelcomeMessage(chatId: ChatId, contextMetadata: ChatContextMetadata): CreateChatMessageData {
    if (contextMetadata.contextType !== 'organizations' && contextMetadata.domainSchema?.name) {
      const domainType = contextMetadata.contextType;
      const domainName = contextMetadata.domainSchema.name;
      
      switch (domainType) {
        case 'tables':
          return ChatMessageEntity.createTableWelcomeMessage(chatId, 0, domainName);
        case 'agents':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'agent', domainName);
        case 'files':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'file', domainName);
        case 'teams':
          return ChatMessageEntity.createDomainWelcomeMessage(chatId, 0, 'team', domainName);
      }
    }
    
    return ChatMessageEntity.createOrganizationWelcomeMessage(chatId, 0);
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(dto: SendMessageDTO): Promise<Result<ChatMessageDTO>> {
    try {
      // Convert DTO to Value Objects
      const chatId = ChatId.fromString(dto.chatId);
      const userId = UserId.fromString(dto.userId);
      const organizationId = OrganizationId.fromNumber(dto.organizationId);

      // 1. Verify chat exists and user has access
      const chat = await this.chatRepository.findById(chatId, organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      if (!chat.canUserMessage(userId, organizationId)) {
        return {
          success: false,
          error: 'Access denied: cannot send messages to this chat'
        };
      }

      // 2. Get next message index
      const messageIndex = await this.messageRepository.getNextMessageIndex(chatId);

      // 3. Validate message data
      const messageData: CreateChatMessageData = {
        chatId,
        role: dto.role,
        content: dto.content,
        metadata: dto.metadata,
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
      const newMessageCount = await this.messageRepository.getMessageCount(chatId);
      await this.chatRepository.updateMessageStats(chatId, newMessageCount, new Date());

      logger.summary(`Added ${dto.role} message to chat ${chat.title}`);

      return {
        success: true,
        data: ChatMapper.toMessageDTO(message)
      };

    } catch (error) {
      logger.error('Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      };
    }
  }

  /**
   * Get chat history with messages
   */
  async getChatHistory(dto: GetChatHistoryDTO): Promise<Result<ChatWithMessagesDTO>> {
    try {
      // Convert DTO to Value Objects
      const chatId = ChatId.fromString(dto.chatId);
      const userId = UserId.fromString(dto.userId);
      const organizationId = OrganizationId.fromNumber(dto.organizationId);

      // 1. Verify chat exists and user has access
      const chat = await this.chatRepository.findById(chatId, organizationId);
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      if (!chat.canUserAccess(userId, organizationId)) {
        return {
          success: false,
          error: 'Access denied: cannot view this chat'
        };
      }

      // 2. Get messages
      const messages = await this.messageRepository.findByChatId(
        chatId,
        dto.limit || 50,
        dto.offset || 0
      );

      // 3. Get total message count
      const totalMessages = await this.messageRepository.getMessageCount(chatId);

      return {
        success: true,
        data: ChatMapper.toChatWithMessagesDTO(chat, messages, totalMessages)
      };

    } catch (error) {
      logger.error('Error getting chat history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat history'
      };
    }
  }

  /**
   * Get chats for a user or organization, with optional table filtering
   */
  async getChats(dto: GetChatsDTO): Promise<Result<ChatSessionDTO[]>> {
    try {
      // Convert DTO to Value Objects
      const organizationId = OrganizationId.fromNumber(dto.organizationId);

      let chats: Chat[];

      if (dto.tableId) {
        // Get chats for specific table
        const tableId = TableId.fromNumber(dto.tableId);
        chats = await this.chatRepository.findByTable(
          tableId,
          organizationId,
          dto.limit || 20,
          dto.offset || 0
        );
      } else if (dto.userId) {
        // Get chats for specific user
        const userId = UserId.fromString(dto.userId);
        chats = await this.chatRepository.findByUser(
          userId,
          organizationId,
          dto.limit || 20,
          dto.offset || 0
        );
      } else {
        // Get all chats for organization
        if (dto.status === 'active') {
          chats = await this.chatRepository.findActiveByOrganization(
            organizationId,
            dto.limit || 20,
            dto.offset || 0
          );
        } else {
          chats = await this.chatRepository.findByOrganization(
            organizationId,
            dto.limit || 20,
            dto.offset || 0
          );
        }
      }

      return {
        success: true,
        data: chats.map(ChatMapper.toSessionDTO)
      };

    } catch (error) {
      logger.error('Error getting chats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chats'
      };
    }
  }

  /**
   * Get conversation context for AI processing
   */
  async getConversationContext(chatId: ChatId, organizationId: OrganizationId, contextSize: number = 10): Promise<Result<ChatMessage[]>> {
    try {
      // 1. Verify chat exists
      const chat = await this.chatRepository.findById(chatId, organizationId);      if (!chat) {
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
      logger.error('Error getting conversation context:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversation context'
      };
    }
  }

  /**
   * Archive a chat
   */
  async archiveChat(chatId: ChatId, userId: UserId, organizationId: OrganizationId): Promise<Result<void>> {
    try {
      // 1. Verify chat exists and user can edit
      const chat = await this.chatRepository.findById(chatId, organizationId);   
      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      if (!chat.canUserEdit(userId)) {
       return {
          success: false,
          error: 'Access denied: only chat creator can archive chat'
        };
      }

      // 2. Archive chat
      const success = await this.chatRepository.archive(chatId, organizationId);      if (!success) {
        return {
          success: false,
          error: 'Failed to archive chat'
        };
      }

      logger.summary(`Archived chat: ${chat.title}`);

      return {
        success: true
      };

    } catch (error) {
      logger.error('Error archiving chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to archive chat'
      };
    }
  }

  /**
   * Delete a chat permanently
   */
  async deleteChat(chatId: ChatId, userId: UserId, organizationId: OrganizationId): Promise<Result<void>> {
    try {
      // 1. Verify chat exists and user can edit
      const chat = await this.chatRepository.findById(chatId, organizationId);      if (!chat) {
        return {
          success: false,
          error: 'Chat not found or access denied'
        };
      }

      if (!chat.canUserEdit(userId)) {
       return {
          success: false,
          error: 'Access denied: only chat creator can delete chat'
        };
      }

      // 2. Delete all messages first
      await this.messageRepository.deleteByChatId(chatId);

      // 3. Delete chat
      const success = await this.chatRepository.delete(chatId, organizationId);      if (!success) {
        return {
          success: false,
          error: 'Failed to delete chat'
        };
      }

      logger.summary(`Deleted chat: ${chat.title}`);

      return {
        success: true
      };

    } catch (error) {
      logger.error('Error deleting chat:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete chat'
      };
    }
  }

  /**
   * Get chat statistics for an organization
   */
  async getChatStats(organizationId: OrganizationId): Promise<Result<{
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
      logger.error('Error getting chat stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat statistics'
      };
    }
  }
}