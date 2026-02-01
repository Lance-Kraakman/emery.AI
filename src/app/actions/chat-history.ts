'use server'

/**
 * Chat History Server Actions
 * 
 * Server Actions for chat session management and history retrieval.
 * Uses proper DTOs for clean boundary separation between domain and UI.
 */

import { auth } from '@/lib/auth'
import { getChatApplicationService } from '@/ddd/application/di/container'
import type {
  ChatContextDTO,
  ChatSessionDTO,
  ChatMessageDTO,
  ChatWithMessagesDTO,
  ChatActionResult,
  CreateChatSessionDTO
} from '@/app/mappers/chat-mapper'
import { ChatUtils } from '@/ddd/domain/chat/entities/chat'
import type { DomainType } from '@/ddd/domain/shared/types/domain-type'

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

    // Get chats based on context - service accepts primitives and returns DTOs
    const result = await chatApplicationService.getChats({
      userId: session.user.id,
      organizationId: context.organizationId,
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
    }

    // Service already returns DTOs, no mapping needed
    return { success: true, data: chats }

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

    // Get chat history - service accepts primitives and returns DTOs
    const result = await chatApplicationService.getChatHistory({
      chatId: chatId,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId!,
      limit: 100 // Load up to 100 messages for full history
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to load chat history' }
    }

    // Service already returns DTO, no mapping needed
    return {
      success: true,
      data: result.data!
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

    // Service accepts primitives and returns DTOs
    const result = await chatApplicationService.createChat({
      organizationId: request.organizationId,
      createdBy: session.user.id,
      title,
      domainType: request.domainType as DomainType,
      domainId: request.domainId
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create chat session' }
    }

    // Service already returns DTO, no mapping needed
    return { success: true, data: result.data! }

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

    // Get the most recent chat for this context - service accepts primitives and returns DTOs
    const result = await chatApplicationService.getChats({
      userId: session.user.id,
      organizationId: context.organizationId,
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
    }

    // Return the most recent chat or null if none found - already a DTO
    const mostRecentChat = chats[0] || null
    return { success: true, data: mostRecentChat }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error getting current chat session:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get current chat session' 
    }
  }
}

/**
 * Update a chat session's model configuration
 */
export async function updateChatModel(chatId: string, model: string | null): Promise<ChatActionResult<ChatSessionDTO>> {
  console.log('[CHAT-ACTIONS] updateChatModel called:', { chatId, model })

  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      console.log('[CHAT-ACTIONS] updateChatModel - auth failed')
      return { success: false, error: 'Authentication required' }
    }

    const chatApplicationService = getChatApplicationService()

    console.log('[CHAT-ACTIONS] updateChatModel - calling service:', {
      chatId,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId,
      model
    })

    // Use the application service's updateChat method
    const result = await chatApplicationService.updateChat({
      chatId,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId!,
      model
    })

    console.log('[CHAT-ACTIONS] updateChatModel - result:', {
      success: result.success,
      error: result.error,
      updatedModel: result.data?.model
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update chat model' }
    }

    return { success: true, data: result.data! }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error updating chat model:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update chat model'
    }
  }
}

/**
 * Update a chat's title
 */
export async function updateChatTitle(chatId: string, title: string): Promise<ChatActionResult<ChatSessionDTO>> {
  console.log('[CHAT-ACTIONS] updateChatTitle called:', { chatId, title })

  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'Authentication required' }
    }

    // Validate title
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return { success: false, error: 'Title cannot be empty' }
    }
    if (trimmedTitle.length > 200) {
      return { success: false, error: 'Title must be 200 characters or less' }
    }

    const chatApplicationService = getChatApplicationService()

    const result = await chatApplicationService.updateChat({
      chatId,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId!,
      title: trimmedTitle
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to update chat title' }
    }

    return { success: true, data: result.data! }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error updating chat title:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update chat title'
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

    // First verify user has access to this chat - service accepts primitives
    const chatResult = await chatApplicationService.getChatHistory({
      chatId: chatId,
      userId: session.user.id,
      organizationId: session.user.currentOrganizationId!,
      limit: 1
    })

    if (!chatResult.success || !chatResult.data) {
      return { success: false, error: 'Chat not found or access denied' }
    }

    // TODO: Add archiveChat method to ChatApplicationService instead of accessing repository directly
    // For now, using repository directly as a workaround
    const chatRepository = (chatApplicationService as any).chatRepository
    const { ChatId, OrganizationId } = await import('@/ddd/domain/shared/value-objects')
    const archived = await chatRepository.archive(
      ChatId.fromString(chatId),
      OrganizationId.fromNumber(session.user.currentOrganizationId!)
    )

    return { success: true, data: archived }

  } catch (error) {
    console.error('[CHAT-ACTIONS] Error archiving chat session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive chat session'
    }
  }
}