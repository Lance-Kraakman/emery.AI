import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { auth } from '@/lib/auth'
import { ragService } from '@/lib/rag/service'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages } = await req.json()
    const latestMessage = messages[messages.length - 1]?.content

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.'
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
        const organizationId = 1 // AIDEV-TODO: Get from session
        
        const indexes = await ragService.listIndexes({ organizationId })
        let ragIndex = indexes.find(idx => idx.domainTypes.includes('tables'))
        
        // Create default RAG index if none exists
        if (!ragIndex) {
          const indexId = await ragService.createIndex({
            name: 'Organization Knowledge Base',
            description: 'Automatic RAG index for organizational data',
            organizationId,
            domainTypes: ['tables', 'agents'],
            createdBy: session.user.id,
          })
          ragIndex = await ragService.getIndex(indexId)
        }

        // Search for relevant context
        if (ragIndex) {
          const searchResult = await ragService.search({
            indexId: ragIndex.id,
            query: latestMessage,
            limit: 5,
            threshold: 0.6,
            userId: session.user.id,
          })

          if (searchResult.documents.length > 0) {
            ragContext = `
RELEVANT ORGANIZATION DATA:
${searchResult.documents.map((doc, idx) => 
  `[${idx + 1}] ${doc.title}
${doc.content.substring(0, 500)}...
Source: ${doc.sourceType} - ${doc.sourceName} (${(doc.similarity! * 100).toFixed(1)}% match)
---`
).join('\n')}

`
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

    // Stream the AI response
    const result = await streamText({
      model: openai('gpt-4o'),
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      maxTokens: 2000,
    })

    // AI SDK v5 - use pipeTextStreamToResponse for streaming
    return new Response(result.textStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
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