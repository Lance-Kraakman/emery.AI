import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { auth } from '@/lib/auth'
import { searchApplicationService, indexingApplicationService, indexRepository } from '@/ddd/application/di/rag-container'
import { getAIModel, getAIProviderInfo } from '@/lib/ai/models'
import { getChatApplicationService, getDynamicTableRepository, getAgentRepository } from '@/ddd/application/di/container'
import type { SearchRagQuery } from '@/ddd/application/rag/queries/search-query'
import type { CreateIndexCommand } from '@/ddd/application/rag/commands/create-index-command'
import { RagIndexId, OrganizationId } from '@/ddd/domain/rag/value-objects'
import type { CreateChatCommand, SendMessageCommand } from '@/ddd/application/use-cases/chat/chat-application-service'
import { ChatMessageEntity } from '@/ddd/domain/chat/entities/chat-message'
import { DualContextRagService } from '@/ddd/application/use-cases/chat/dual-context-rag-service'
import type { DomainContextOptions } from '@/ddd/application/use-cases/chat/dual-context-rag-service'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages, chatId, tableId, domainType, domainId } = await req.json()
    const latestMessage = messages[messages.length - 1]?.content

    // Check if HuggingFace is configured
    const providerInfo = getAIProviderInfo()
    if (!providerInfo.configured) {
      return new Response(
        JSON.stringify({
          error: 'HuggingFace not configured. Please add your HF_TOKEN to the environment variables.',
          details: 'Get your token from https://huggingface.co/settings/tokens'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const organizationId = session.user.currentOrganizationId
    if (!organizationId) {
      return new Response('No current organization found', { status: 400 })
    }

    const chatApplicationService = getChatApplicationService()
    let currentChatId = chatId
    let currentChat: any = null

    // Create or retrieve chat session
    if (!currentChatId && latestMessage) {
      // Create new chat session (optionally connected to domain)
      const createChatCommand: CreateChatCommand = {
        organizationId,
        createdBy: session.user.id,
        domainType: domainType as any,
        domainId: domainId ? parseInt(domainId) : undefined,
        tableId: tableId ? parseInt(tableId) : undefined // Legacy support
      }

      const chatResult = await chatApplicationService.createChat(createChatCommand)
      if (!chatResult.success) {
        return new Response(
          JSON.stringify({ error: chatResult.error || 'Failed to create chat' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
      
      currentChatId = chatResult.data!.id
      currentChat = chatResult.data
      
      const chatTypeDesc = domainType ? `${domainType}-connected` : (tableId ? 'table-connected' : 'organization')
      console.log(`[CHAT-STREAM] Created new ${chatTypeDesc} chat: ${currentChatId}`)
    } else if (currentChatId) {
      // Retrieve existing chat for context
      const chatHistory = await chatApplicationService.getChatHistory({
        chatId: currentChatId,
        userId: session.user.id,
        organizationId,
        limit: 1
      })
      
      if (chatHistory.success) {
        currentChat = chatHistory.data?.chat
      }
    }

    // Save user message if we have a chat session
    if (currentChatId && latestMessage) {
      const userMessageCommand: SendMessageCommand = {
        chatId: currentChatId,
        userId: session.user.id,
        organizationId,
        content: latestMessage,
        role: 'user'
      }

      const messageResult = await chatApplicationService.sendMessage(userMessageCommand)
      if (!messageResult.success) {
        console.warn('[CHAT-STREAM] Failed to save user message:', messageResult.error)
      }
    }

    let ragContext = ''
    let ragSourceSummary: string[] = []

    // Get dual-context RAG results using the new service
    try {
      if (session?.user?.id && latestMessage) {
        // Initialize dual-context RAG service
        const tableRepository = getDynamicTableRepository()
        const agentRepository = getAgentRepository()
        const dualContextRagService = new DualContextRagService(tableRepository, agentRepository)

        // Determine domain context from chat
        let resolvedDomainType = currentChat?.domainType || domainType
        let resolvedDomainId = currentChat?.domainId || domainId
        
        // Handle legacy table ID
        if (!resolvedDomainType && (currentChat?.tableId || tableId)) {
          resolvedDomainType = 'table'
          resolvedDomainId = currentChat?.tableId || parseInt(tableId)
        }

        const contextOptions: DomainContextOptions = {
          domainType: resolvedDomainType,
          domainId: resolvedDomainId,
          organizationId,
          query: latestMessage,
          primaryWeight: 0.7,
          maxPrimaryDocs: 3,
          maxSecondaryDocs: 2,
          similarityThreshold: 0.3
        }

        const dualContextResult = await dualContextRagService.getDualContext(contextOptions)
        
        if (dualContextResult.totalDocuments > 0) {
          ragContext = dualContextRagService.formatContextForSystemMessage(dualContextResult)
          ragSourceSummary = dualContextRagService.getRagSourceSummary(dualContextResult)
          
          console.log(`[DUAL-CONTEXT-RAG] Generated context with ${dualContextResult.primaryContext.length} primary + ${dualContextResult.secondaryContext.length} secondary docs`)
          console.log(`[DUAL-CONTEXT-RAG] Context type: ${resolvedDomainType || 'organization'} chat`)
        } else {
          console.log('[DUAL-CONTEXT-RAG] No relevant context found')
        }
      }
    } catch (ragError) {
      console.error('Dual-context RAG search failed:', ragError)
      // Continue without RAG context
    }

    // Create domain-aware system message with RAG context
    let systemPrompt = 'You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.'
    
    // Add domain-specific context if available
    if (currentChat?.domainType || domainType) {
      const contextType = currentChat?.domainType || domainType
      switch (contextType) {
        case 'table':
          systemPrompt += ' You are currently assisting with a specific table and its data. Focus on table structure, data analysis, and table-specific operations.'
          break
        case 'agent':
          systemPrompt += ' You are currently assisting with a specific agent. Focus on agent capabilities, execution history, and configuration.'
          break
        case 'file':
          systemPrompt += ' You are currently assisting with a specific file. Focus on file content, analysis, and document-related tasks.'
          break
        case 'team':
          systemPrompt += ' You are currently assisting with a specific team. Focus on team dynamics, member coordination, and collaborative activities.'
          break
        case 'workflow':
          systemPrompt += ' You are currently assisting with a specific workflow. Focus on process optimization, execution analysis, and workflow management.'
          break
      }
    }

    if (ragContext) {
      systemPrompt += `

You have access to relevant context information:

${ragContext}

Use this context to provide accurate, specific answers. When referencing information from the context, cite the specific sources (marked as P1, P2 for primary domain context, or S1, S2 for secondary organizational context).`
    } else {
      systemPrompt += ' No specific context is available. Provide general guidance about database management and workflows.'
    }

    systemPrompt += '\n\nAlways be helpful, accurate, and professional.'

    const systemMessage = {
      role: 'system' as const,
      content: systemPrompt
    }

    console.log(`[RAG-CONTEXT] Using RAG context: ${ragContext ? 'YES' : 'NO'}`)
    if (ragContext) {
      console.log(`[RAG-CONTEXT] Context length: ${ragContext.length} characters`)
    }

    // Stream the AI response
    const result = await streamText({
      model: getAIModel(),
      messages: [systemMessage, ...messages],
      temperature: 0.7,
    })

    // Create a transform stream to capture the response for saving
    let fullResponse = ''
    const responseStream = new TransformStream({
      transform(chunk, controller) {
        const decoder = new TextDecoder()
        const text = decoder.decode(chunk)
        fullResponse += text
        controller.enqueue(chunk)
      },
      flush() {
        // Save the complete assistant response after streaming
        if (currentChatId && fullResponse.trim()) {
          const saveAssistantMessage = async () => {
            try {
              const assistantMessageCommand: SendMessageCommand = {
                chatId: currentChatId,
                userId: session.user.id,
                organizationId,
                content: fullResponse.trim(),
                role: 'assistant',
                metadata: {
                  ragSources: [], // TODO: Convert ragSourceSummary to proper format
                  processingTime: Date.now() - performance.now()
                }
              }
              
              await chatApplicationService.sendMessage(assistantMessageCommand)
              console.log(`[CHAT-STREAM] Saved assistant response to chat ${currentChatId}`)
            } catch (error) {
              console.error('[CHAT-STREAM] Failed to save assistant response:', error)
            }
          }
          
          // Save response asynchronously without blocking
          saveAssistantMessage()
        }
      }
    })

    // AI SDK v5 - create streaming response from textStream with transform
    return new Response(result.textStream.pipeThrough(responseStream), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    })
    
  } catch (error) {
    console.error('Streaming chat error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}