import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRagIndexingApplicationService } from '@/ddd/application/di/container'
import type { ReindexCommand } from '@/ddd/application/services/rag/commands/reindex-command'

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

    // AIDEV-NOTE: Using DDD indexing application service instead of legacy ragService
    const reindexCommand: ReindexCommand = {
      indexId,
      force: false // Default to incremental reindex
    };

    // Start reindexing in background (async)
    const indexingApplicationService = getRagIndexingApplicationService();
    indexingApplicationService.reindexData(reindexCommand).catch(console.error)

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