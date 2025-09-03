import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRagIndexingApplicationService, getRagSearchApplicationService, getRagIndexRepository } from '@/ddd/application/di/container'
import type { CreateIndexCommand } from '@/ddd/application/services/rag/commands/create-index-command'
import { OrganizationId } from '@/ddd/domain/shared/value-objects'

// GET /api/rag - List RAG indexes for organization
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // AIDEV-TODO: Get organization from session
    const organizationId = 1

    // AIDEV-NOTE: Using DDD repository directly instead of legacy ragService
    const indexRepository = getRagIndexRepository();
    const indexes = await indexRepository.findByOrganization(OrganizationId.fromNumber(organizationId))
    
    // Convert domain entities to API response format
    const indexesData = indexes.map(index => ({
      id: index.id.toString(),
      name: index.name,
      description: index.description,
      domainTypes: index.domainTypes,
      domainFilters: index.domainFilters,
      status: index.status,
      documentCount: index.documentCount,
      createdAt: index.createdAt,
      // updatedAt: index.updatedAt // Property doesn't exist on RagIndex entity
    }))
    
    return NextResponse.json({ success: true, indexes: indexesData })
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

    const organizationId = OrganizationId.fromNumber(1) // AIDEV-TODO: Get from session

    // AIDEV-NOTE: Using DDD indexing application service instead of legacy ragService
    const createIndexCommand: CreateIndexCommand = {
      name,
      description,
      organizationId,
      domainTypes: domainTypes || ['tables'], // DDD uses plural 'tables'
      domainFilters,
      createdBy: session.user.id,
    };

    const indexingApplicationService = getRagIndexingApplicationService();
    const indexId = await indexingApplicationService.createIndex(createIndexCommand)

    return NextResponse.json({ success: true, indexId })
  } catch (error) {
    console.error('Failed to create RAG index:', error)
    return NextResponse.json({ error: 'Failed to create RAG index' }, { status: 500 })
  }
}