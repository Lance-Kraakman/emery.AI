import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ragService } from '@/lib/rag/service'

// GET /api/rag - List RAG indexes for organization
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // AIDEV-TODO: Get organization from session
    const organizationId = 1

    const indexes = await ragService.listIndexes({ organizationId })
    return NextResponse.json({ success: true, indexes })
  } catch (error) {
    console.error('Failed to list RAG indexes:', error)
    return NextResponse.json({ error: 'Failed to list RAG indexes' }, { status: 500 })
  }
}

// POST /api/rag - Create new RAG index
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, domainTypes, domainFilters } = body

    const organizationId = 1 // AIDEV-TODO: Get from session

    const indexId = await ragService.createIndex({
      name,
      description,
      organizationId,
      domainTypes: domainTypes || ['tables'],
      domainFilters,
      createdBy: session.user.id,
    })

    return NextResponse.json({ success: true, indexId })
  } catch (error) {
    console.error('Failed to create RAG index:', error)
    return NextResponse.json({ error: 'Failed to create RAG index' }, { status: 500 })
  }
}