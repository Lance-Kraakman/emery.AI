'use server'

import { defaultAnnotationRenderers } from '@llamaindex/chat-ui'
import { Markdown } from '@llamaindex/chat-ui/widgets'
import { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { getRagSearchApplicationService, getRagIndexRepository } from '@/ddd/application/di/container'
import { generateText } from 'ai'
import { getAIModel, getAIProviderInfo } from '@/lib/ai/models'
import type { SearchRagQuery } from '@/ddd/application/services/rag/queries/search-query'
import { OrganizationId } from '@/ddd/domain/shared/value-objects'

export async function chatAction(question: string): Promise<ReactNode> {
  const session = await auth()

  // Check if any AI provider is configured
  const providerInfo = getAIProviderInfo()
  if (!providerInfo.configured) {
    return (
      <Markdown
        content={`**🤗 HuggingFace Configuration Required**

To enable AI-powered responses with RAG using Qwen models:

1. Get your HuggingFace token from https://huggingface.co/settings/tokens
2. Add to \`.env.local\`:
   \`\`\`
   HF_TOKEN=hf_your-token-here
   \`\`\`

After configuration:
1. Restart the development server
2. The system will automatically use **Qwen/Qwen2.5-Coder-32B-Instruct** for code tasks
3. The system will automatically:
   - Index your organization's table schemas
   - Search for relevant context when you ask questions
   - Provide AI responses with your organizational data context

Your question: "${question}"`}
        annotationRenderers={defaultAnnotationRenderers}
      />
    )
  }

  let ragContext = ''

  // AIDEV-NOTE: Search for relevant RAG context if available
  // Index creation is handled automatically by the reindexOrganizationIndexes flow
  try {
    if (session?.user?.id) {
      // AIDEV-TODO: Get actual organization ID from session instead of hardcoding
      // For now using organization 1, but this should come from user's session/profile
      const organizationId = OrganizationId.fromNumber(1)
      
      // AIDEV-NOTE: Using DDD repository to find existing indexes (purely consumptive)
      const indexRepository = getRagIndexRepository();
      const indexes = await indexRepository.findByOrganization(organizationId)
      
      // Find any index that covers tables (or other relevant domain types)
      const ragIndex = indexes.find(idx => 
        idx.domainTypes.includes('tables') || 
        idx.domainTypes.includes('agents') || 
        idx.domainTypes.includes('databases')
      );

      // Search for relevant context if index exists
      if (ragIndex) {
        // AIDEV-NOTE: Using DDD search application service instead of legacy ragService
        const searchQuery: SearchRagQuery = {
          indexId: ragIndex.id.toString(),
          query: question,
          limit: 5,
          threshold: 0.6,
          userId: session.user.id
        };
        
        const searchApplicationService = getRagSearchApplicationService();
        const searchResult = await searchApplicationService.search(searchQuery)

        if (searchResult.success && searchResult.data!.documents.length > 0) {
          const searchData = searchResult.data!;
          ragContext = `
RELEVANT ORGANIZATION DATA:
${searchData.documents.map((doc, idx) => 
  `[${idx + 1}] ${doc.title}
${doc.content.substring(0, 500)}...
Source: ${doc.domainType} - ${doc.sourceName} (${(doc.similarity! * 100).toFixed(1)}% match)
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

  // Generate AI response with RAG context
  try {
    const { text } = await generateText({
      model: getAIModel(),
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for Emery, a dynamic database and workflow platform. You help users understand their organizational data, create workflows, and manage their systems.

${ragContext ? `You have access to relevant context from the user's organization:

${ragContext}

Use this context to provide accurate, specific answers about their tables, data, and workflows. Reference the specific sources when applicable.` : 'No specific organizational context is available. Provide general guidance about database management and workflows.'}

Always be helpful, accurate, and professional.`
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.7,
    })

    return (
      <Markdown
        content={text}
        annotationRenderers={defaultAnnotationRenderers}
      />
    )
  } catch (error) {
    console.error('AI generation failed:', error)
    return (
      <Markdown
        content={`**⚠️ AI Response Error**

There was an issue generating the AI response. This could be due to:

1. **Invalid OpenAI API Key** - Check your \`.env.local\` file
2. **API Rate Limits** - Wait a moment and try again  
3. **Network Issues** - Check your internet connection

**Your question:** "${question}"

**RAG Context Found:** ${ragContext ? 'Yes - Found relevant organizational data' : 'No context available'}

Please check your OpenAI API key and try again.`}
        annotationRenderers={defaultAnnotationRenderers}
      />
    )
  }
}