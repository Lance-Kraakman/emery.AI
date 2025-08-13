import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ragService } from '@/lib/rag/service'

// POST /api/rag/[indexId]/reindex - Trigger reindexing
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ indexId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { indexId } = await context.params

    // Start reindexing in background (async)
    ragService.reindexData(indexId).catch(console.error)

    return NextResponse.json({ 
      success: true, 
      message: 'Reindexing started',
      indexId 
    })
  } catch (error) {
    console.error('Failed to start reindexing:', error)
    return NextResponse.json({ error: 'Failed to start reindexing' }, { status: 500 })
  }
}