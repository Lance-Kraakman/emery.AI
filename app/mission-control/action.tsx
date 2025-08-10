'use server'

import { defaultAnnotationRenderers } from '@llamaindex/chat-ui'
import { Markdown } from '@llamaindex/chat-ui/widgets'
import { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { ragService } from '@/lib/rag/service'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

export async function chatAction(question: string): Promise<ReactNode> {
  const session = await auth()

  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    return (
      <Markdown
        content={`**🔑 OpenAI API Key Required**

To enable AI-powered responses with RAG, please:

1. Add your OpenAI API key to \`.env.local\`:
   \`\`\`
   OPENAI_API_KEY=sk-your-key-here
   \`\`\`

2. Restart the development server

3. The system will then automatically:
   - Index your organization's table schemas
   - Search for relevant context when you ask questions
   - Provide AI responses with your organizational data context

Your question: "${question}"`}
        annotationRenderers={defaultAnnotationRenderers}
      />
    )
  }

  let ragContext = ''

  // AIDEV-NOTE: Get organization RAG index if available
  try {
    if (session?.user?.id) {
      // Get or create default organization RAG index
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
          query: question,
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

  // Generate AI response with RAG context
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
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

const SAMPLE_TEXT = [
  `
Welcome to the demo of @llamaindex/chat-ui. Let me show you the different types of components that can be triggered from the server.

### Markdown with code block

\\\`\\\`\\\`js
const a = 1
const b = 2
const c = a + b
console.log(c)
\\\`\\\`\\\`

`,
  '\\n ### Demo inline annotations \\n',
  'Here are some steps to create a simple wiki app: \\n',
  '1. Create package.json file:',
  {
    type: 'artifact',
    data: {
      type: 'code',
      created_at: 1717334400000,
      data: {
        file_name: 'package.json',
        language: 'json',
        code: `{
  "name": "wiki-app",
  "version": "1.0.0",
  "description": "Wiki application",
  "main": "wiki.js",
  "dependencies": {
    "axios": "^1.0.0",
    "wiki-api": "^2.1.0"
  }
}`,
      },
    },
  },
  '2. Check the wiki fetching script:',
  {
    type: 'artifact',
    data: {
      created_at: 1717334500000,
      type: 'code',
      data: {
        file_name: 'wiki.js',
        language: 'javascript',
        code: `async function getWiki(search) {
    const response = await fetch("/api/wiki?search=" + search);
    const data = await response.json();
    return data;
  }`,
      },
    },
  },
  '3. Run getWiki with the search term:',
  {
    type: 'artifact',
    data: {
      created_at: 1717334600000,
      type: 'code',
      data: {
        file_name: 'wiki.js',
        language: 'javascript',
        code: `getWiki(\`What is \${search}?\`);`,
      },
    },
  },
  '#### 🎯 Demo generating a document artifact',
  {
    type: 'artifact',
    data: {
      type: 'document',
      data: {
        title: 'Sample document',
        content: `# Getting Started Guide

  ## Introduction
  This comprehensive guide will walk you through everything you need to know to get started with our platform. Whether you're a beginner or an experienced user, you'll find valuable information here.

  ## Key Features
  - **Easy Setup**: Get running in minutes
  - **Powerful Tools**: Access advanced capabilities
  - **Great Documentation**: Find answers quickly
  - **Active Community**: Get help when needed

  ## Setup Process
  1. Install Dependencies
     First, ensure you have all required dependencies installed on your system.

  2. Configuration
     Update your configuration files with the necessary settings:
     - API keys
     - Environment variables
     - User preferences

  3. First Steps
     Begin with basic operations to familiarize yourself with the platform.

  ## Best Practices
  - Always backup your data
  - Follow security guidelines
  - Keep your dependencies updated
  - Document your changes

  ## Troubleshooting
  If you encounter issues, try these steps:
  1. Check logs for errors
  2. Verify configurations
  3. Update to latest version
  4. Contact support if needed

  ## Additional Resources
  - [Documentation](https://docs.example.com)
  - [API Reference](https://api.example.com)
  - [Community Forums](https://community.example.com)

  Feel free to explore and reach out if you need assistance!`,
        type: 'markdown',
      },
    },
  },
  '\\n\\n Please feel free to open the document in the canvas and edit it. The document will be saved as a new version',
]

function fakeChatStream(question: string): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(`User question: ${question}. \\n `)

      for (const item of SAMPLE_TEXT) {
        if (typeof item === 'string') {
          for (const token of item.split(' ')) {
            await new Promise(resolve => setTimeout(resolve, TOKEN_DELAY))
            controller.enqueue(`${token} `)
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, ANNOTATION_DELAY))
          controller.enqueue(item)
        }
      }

      controller.close()
    },
  })
}

function toInlineAnnotationCode(item: any) {
  return `\\n\\\`\\\`\\\`${INLINE_ANNOTATION_KEY}\\n${JSON.stringify(item)}\\n\\\`\\\`\\\`\\n`
}
