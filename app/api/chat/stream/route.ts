import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { auth } from '@/lib/auth'
import { searchApplicationService, indexingApplicationService, indexRepository } from '@/ddd/application/di/rag-container'
import { getAIModel, getAIProviderInfo } from '@/lib/ai/models'
import type { SearchRagQuery } from '@/ddd/application/rag/queries/search-query'
import type { CreateIndexCommand } from '@/ddd/application/rag/commands/create-index-command'
import { RagIndexId, OrganizationId } from '@/ddd/domain/rag/value-objects'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages } = await req.json()
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

    let ragContext = ''

    // Get organization RAG context if available
    try {
      if (session?.user?.id && latestMessage) {
        const organizationId = session.user.currentOrganizationId
        if (!organizationId) {
          console.log('No current organization found for user')
        } else {
          // AIDEV-NOTE: Using DDD repository directly instead of legacy ragService
          const indexes = await indexRepository.findByOrganization(OrganizationId.fromNumber(organizationId))
          let ragIndex = indexes.find(idx => idx.domainTypes.includes('organization'))
        
          // Create default RAG index if none exists
          if (!ragIndex) {
            // AIDEV-NOTE: Using DDD indexing application service instead of legacy ragService
            const createIndexCommand: CreateIndexCommand = {
              name: `Organization ${organizationId} Knowledge Base`,
              description: 'Automatic RAG index for organizational data',
              organizationId,
              domainTypes: ['organization', 'table', 'agent', 'file', 'team'], // DDD uses singular forms
              createdBy: session.user.id,
            };
            
            const indexId = await indexingApplicationService.createIndex(createIndexCommand)
            ragIndex = await indexRepository.findById(RagIndexId.fromString(indexId)) || undefined
          }

          // Search for relevant context
          if (ragIndex) {
            console.log(`[RAG-SEARCH] Searching in index ${ragIndex.id} for query: "${latestMessage}"`)
            // AIDEV-NOTE: Using DDD search application service instead of legacy ragService
            const searchQuery: SearchRagQuery = {
              indexId: ragIndex.id.toString(),
              query: latestMessage,
              limit: 5,
              threshold: 0.3, // Lowered threshold for better matches
              userId: session.user.id
            };
            
            const searchResult = await searchApplicationService.search(searchQuery)

            console.log(`[RAG-SEARCH] Found ${searchResult.documents.length} documents`)
            if (searchResult.documents.length > 0) {
              console.log(`[RAG-SEARCH] Top match: ${searchResult.documents[0].title} (${(searchResult.documents[0].similarity! * 100).toFixed(1)}% similarity)`)
              ragContext = `
RELEVANT ORGANIZATION DATA:
${searchResult.documents.map((doc, idx) => 
  `[${idx + 1}] ${doc.title}
${doc.content.substring(0, 500)}...
Source: ${doc.domainType} - ${doc.sourceName} (${(doc.similarity! * 100).toFixed(1)}% match)
---`
).join('\n')}

`
            } else {
              console.log('[RAG-SEARCH] No documents found above similarity threshold')
            }
          }
        }
      }
    } catch (ragError) {
      console.error('RAG search failed:', ragError)
      // Continue without RAG context
    }

    // Create system message with RAG context
    const systemMessage = {
      role: 'system' as const,
      content: `You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.

${ragContext ? `You have access to relevant context from the user's organization:

${ragContext}

Use this context to provide accurate, specific answers about their tables, data, and workflows. Reference the specific sources when applicable.` : 'No specific organizational context is available. Provide general guidance about database management and workflows.'}

Always be helpful, accurate, and professional.`
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

    // AI SDK v5 - create streaming response from textStream
    return new Response(result.textStream, {
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