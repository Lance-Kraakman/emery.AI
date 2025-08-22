import { streamText } from 'ai'
import { auth } from '@/lib/auth'
import { searchApplicationService } from '@/ddd/application/di/rag-container'
import { getAIModel } from '@/lib/ai/models'
import type { SearchRagQuery } from '@/ddd/application/rag/queries/search-query'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages, ragIndexId } = await req.json()
    const latestMessage = messages[messages.length - 1]?.content

    let context = ''
    let ragResults = null

    // If RAG index is specified, search for relevant context
    if (ragIndexId && latestMessage) {
      try {
        // AIDEV-NOTE: Using DDD search application service instead of legacy ragService
        const searchQuery: SearchRagQuery = {
          indexId: ragIndexId,
          query: latestMessage,
          limit: 5,
          threshold: 0.7,
          userId: session.user.id
        };

        const searchResult = await searchApplicationService.search(searchQuery)

        ragResults = searchResult
        
        // Build context from search results
        if (searchResult.documents.length > 0) {
          context = `
CONTEXT FROM ORGANIZATION DATA:
${searchResult.documents.map((doc, idx) => 
  `[${idx + 1}] ${doc.title}
${doc.content}
Source: ${doc.domainType} (${doc.sourceName})
Relevance: ${(doc.similarity! * 100).toFixed(1)}%
---`
).join('\n')}

Based on the above context from your organization's data, please provide a helpful response.
`
        }
      } catch (ragError) {
        console.error('RAG search failed:', ragError)
        // Continue without RAG context if search fails
      }
    }

    // Prepare messages with RAG context
    const systemMessage = {
      role: 'system' as const,
      content: `You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.

${context ? `You have access to relevant context from the user's organization data. Use this context to provide accurate, specific answers about their tables, data, and workflows.

${context}` : 'The user has not provided a RAG index, so respond based on general knowledge about databases and workflows.'}

Always be helpful, accurate, and reference the specific data sources when applicable.`
    }

    const result = await streamText({
      model: getAIModel(),
      messages: [systemMessage, ...messages],
      temperature: 0.7,
    })

    return result.toTextStreamResponse({
      headers: {
        'X-Rag-Results': ragResults ? JSON.stringify({
          documentsFound: ragResults.documents.length,
          query: ragResults.query,
          sources: ragResults.documents.map(d => ({ type: d.domainType, name: d.sourceName }))
        }) : 'null'
      }
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}