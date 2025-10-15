'use server'

/**
 * Chat History Server Actions
 * 
 * Server Actions for chat session management and history retrieval.
 * Uses proper DTOs for clean boundary separation between domain and UI.
 */

import { auth } from '@/lib/auth'
import { getChatApplicationService } from '@/ddd/application/di/container'
import { OrganizationId, UserId, ChatId } from '@/ddd/domain/shared/value-objects'
import { 
  ChatMapper,
  type ChatContextDTO, 
  type ChatSessionDTO, 
  type ChatMessageDTO,
  type ChatWithMessagesDTO,
  type ChatActionResult,
  type CreateChatSessionDTO
} from '@/app/mappers/chat-mapper'
import { ChatUtils } from '@/ddd/domain/chat/entities/chat'
import type { DomainType } from '@/ddd/domain/rag/value-objects'

/**
 * Get chat sessions for a given context (domain + user)
 */
export async function getChatSessions(context: ChatContextDTO): Promise<ChatActionResult<ChatSessionDTO[]>> {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Validate organization access
    const currentOrgId = session.user.currentOrganizationId
    if (!currentOrgId || currentOrgId !== context.organizationId) {
      return { success: false, error: 'Invalid organization access' }
    }

    const chatApplicationService = getChatApplicationService()
    const userId = UserId.fromString(session.user.id)
    const organizationId = OrganizationId.fromNumber(context.organizationId)

    // Get chats based on context
    const result = await chatApplicationService.getChats({
      userId,
      organizationId,
      limit: context.limit || 20,
      offset: context.offset || 0
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to load chat sessions' }
    }

    // Filter by domain context if specified
    let chats = result.data || []
    
    if (context.domainType && context.domainId) {
      // Filter for specific domain entity
      chats = chats.filter(chat => {
        const metadata = chat.contextMetadata
        return metadata?.contextType === context.domainType &&
               metadata?.domainSchema?.id === context.domainId
      })
    } else if (!context.domainType) {
      // Filter for general/organization chats (when domainType is undefined, meaning 'general')
      chats = chats.filter(chat => {
        const metadata = chat.contextMetadata
        return !metadata?.contextType || metadata.contextType === 'organizations'
      })
    }

    // Convert to DTOs using ChatMapper
    const chatDTOs = chats.map(chat => ChatMapper.toSessionDTO(chat));

    return { success: true, data: chatDTOs }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error getting chat sessions:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to load chat sessions' 
    }
  }
}

/**
 * Load a specific chat session with full message history
 */
export async function loadChatWithFullHistory(chatId: string): Promise<ChatActionResult<ChatWithMessagesDTO>> {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const chatApplicationService = getChatApplicationService()
    const userId = UserId.fromString(session.user.id)
    const organizationId = OrganizationId.fromNumber(session.user.currentOrganizationId!)
    const chatIdVO = ChatId.fromString(chatId)

    // Get chat history (with higher limit for full history)
    const result = await chatApplicationService.getChatHistory({
      chatId: chatIdVO,
      userId,
      organizationId,
      limit: 100 // Load up to 100 messages for full history
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to load chat history' }
    }

    const chatData = result.data
    if (!chatData?.chat) {
      return { success: false, error: 'Chat not found' }
    }

    // Convert to DTOs using ChatMapper
    const chatWithMessages = ChatMapper.toChatWithMessagesDTO(
      chatData.chat, 
      chatData.messages || [], 
      chatData.chat.messageCount
    );

    return {
      success: true,
      data: chatWithMessages
    }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error loading chat history:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load chat history'
    }
  }
}

/**
 * Create a new chat session
 */
export async function createNewChatSession(request: CreateChatSessionDTO): Promise<ChatActionResult<ChatSessionDTO>> {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Validate organization access
    if (session.user.currentOrganizationId !== request.organizationId) {
      return { success: false, error: 'Invalid organization access' }
    }

    // Create context metadata
    let contextMetadata
    if (request.domainType && request.domainId && request.domainName) {
      contextMetadata = ChatUtils.createDomainContextMetadata(
        request.domainType as DomainType,
        request.domainId,
        request.domainName
      )
    } else {
      contextMetadata = ChatUtils.createOrganizationContextMetadata()
    }

    // Generate title if not provided
    const title = request.title || ChatUtils.generateContextTitle(contextMetadata)

    const chatApplicationService = getChatApplicationService()
    const result = await chatApplicationService.createChat({
      organizationId: OrganizationId.fromNumber(request.organizationId),
      createdBy: UserId.fromString(session.user.id),
      title,
      domainType: request.domainType as DomainType,
      domainId: request.domainId
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create chat session' }
    }

    // Convert to DTO using ChatMapper
    const chatDTO = ChatMapper.toSessionDTO(result.data!);

    return { success: true, data: chatDTO }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error creating chat session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create chat session'
    }
  }
}

/**
 * Get the current/most recent chat session for a given context
 * Used to detect when a new chat has been created by the stream-grpc endpoint
 */
export async function getCurrentChatSession(context: ChatContextDTO): Promise<ChatActionResult<ChatSessionDTO | null>> {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Validate organization access
    const currentOrgId = session.user.currentOrganizationId
    if (!currentOrgId || currentOrgId !== context.organizationId) {
      return { success: false, error: 'Invalid organization access' }
    }

    const chatApplicationService = getChatApplicationService()
    const userId = UserId.fromString(session.user.id)
    const organizationId = OrganizationId.fromNumber(context.organizationId)

    // Get the most recent chat for this context (limit 1)
    const result = await chatApplicationService.getChats({
      userId,
      organizationId,
      limit: 1,
      offset: 0
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to get current chat session' }
    }

    // Filter by domain context if specified
    let chats = result.data || []
    
    if (context.domainType && context.domainId) {
      // Filter for specific domain entity
      chats = chats.filter(chat => {
        const metadata = chat.contextMetadata
        return metadata?.contextType === context.domainType &&
               metadata?.domainSchema?.id === context.domainId
      })
    } else if (!context.domainType) {
      // Filter for general/organization chats
      chats = chats.filter(chat => {
        const metadata = chat.contextMetadata
        return !metadata?.contextType || metadata.contextType === 'organizations'
      })
    }

    // Return the most recent chat or null if none found
    const mostRecentChat = chats[0] || null
    
    if (mostRecentChat) {
      const chatDTO: ChatSessionDTO = {
        id: mostRecentChat.id.value,
        title: mostRecentChat.title,
        description: mostRecentChat.description,
        status: mostRecentChat.status,
        messageCount: mostRecentChat.messageCount,
        lastMessageAt: mostRecentChat.lastMessageAt,
        createdAt: mostRecentChat.createdAt,
        updatedAt: mostRecentChat.updatedAt,
        contextMetadata: mostRecentChat.contextMetadata
      }
      return { success: true, data: chatDTO }
    }

    return { success: true, data: null }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error getting current chat session:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get current chat session' 
    }
  }
}

/**
 * Delete/archive a chat session
 */
export async function archiveChatSession(chatId: string): Promise<ChatActionResult<boolean>> {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    const chatApplicationService = getChatApplicationService()
    const userId = UserId.fromString(session.user.id)
    const organizationId = OrganizationId.fromNumber(session.user.currentOrganizationId!)
    const chatIdVO = ChatId.fromString(chatId)

    // First verify user has access to this chat
    const chatResult = await chatApplicationService.getChatHistory({
      chatId: chatIdVO,
      userId,
      organizationId,
      limit: 1
    })

    if (!chatResult.success || !chatResult.data?.chat) {
      return { success: false, error: 'Chat not found or access denied' }
    }

    // Archive the chat (using repository directly)
    const chatRepository = (chatApplicationService as any).chatRepository // Access private field
    const archived = await chatRepository.archive(chatIdVO, organizationId)

    return { success: true, data: archived }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error archiving chat session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive chat session'
    }
  }
}