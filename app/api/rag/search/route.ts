import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { searchApplicationService } from '@/ddd/application/di/rag-container'
import type { SearchRagQuery } from '@/ddd/application/services/rag/queries/search-query'

// POST /api/rag/search - Search RAG index
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { indexId, query, limit = 10, threshold = 0.7 } = body

    if (!indexId || !query) {
      return NextResponse.json({ error: 'indexId and query are required' }, { status: 400 })
    }

    // AIDEV-NOTE: Using DDD search application service instead of legacy ragService
    const searchQuery: SearchRagQuery = {
      indexId,
      query,
      limit,
      threshold,
      userId: session.user.id
    };

    const result = await searchApplicationService.search(searchQuery)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('RAG search failed:', error)
    return NextResponse.json({ error: 'RAG search failed' }, { status: 500 })
  }
}